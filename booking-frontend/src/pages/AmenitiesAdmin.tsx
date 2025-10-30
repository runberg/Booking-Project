import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { api } from '../services/authService';

interface Amenity {
  id: string;
  name: string;
  description: string | null;
  openTime: string; // HH:mm
  closeTime: string; // HH:mm
  imageUrl: string | null;
  isActive: boolean;
  bookingRestrictionId?: string | null;
  slotLength: number;
}

const placeholder = 'https://via.placeholder.com/80x80?text=Amenity';

export const AmenitiesAdmin: React.FC = () => {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [newAmenity, setNewAmenity] = useState<Partial<Amenity>>({ name: '', description: '', openTime: '09:00', closeTime: '22:00', slotLength: 60, imageUrl: '', bookingRestrictionId: '' as any });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Amenity>>({});
  const [error, setError] = useState<string>('');
  // Restrictions state
  const [restrictions, setRestrictions] = useState<Array<{ id: string; name: string; daysAhead: number; maxPerPeriod: number; maxPerDay: number; isActive: boolean }>>([]);
  const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

  useEffect(() => {
    fetchAmenities();
    fetchRestrictions();
  }, []);

  const fetchAmenities = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get('/admin/amenities');
      setAmenities(data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load amenities');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRestrictions = async () => {
    try {
      const { data } = await api.get('/admin/restrictions');
      setRestrictions(data);
    } catch (e: any) {
      // ignore silently on first load; UI shows empty list message
    }
  };

  const handleCreate = async () => {
    if (!newAmenity.name?.trim()) return;
    try {
      const payload = {
        name: newAmenity.name!.trim(),
        description: newAmenity.description || '',
        openTime: newAmenity.openTime || '09:00',
        closeTime: newAmenity.closeTime || '22:00',
        slotLength: newAmenity.slotLength || 60,
        imageUrl: newAmenity.imageUrl || '',
        bookingRestrictionId: newAmenity.bookingRestrictionId,
      };
      const { data } = await api.post('/admin/amenities', payload);
      setAmenities((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewAmenity({ name: '', description: '', openTime: '09:00', closeTime: '22:00', slotLength: 60, imageUrl: '', bookingRestrictionId: '' as any });
    } catch (e: any) {
      if (e.response?.status === 413) {
        setError('Image is too large. Max size is 2 MB.');
      } else {
        setError(e.response?.data?.message || 'Failed to create amenity');
      }
    }
  };

  const startEdit = (a: Amenity) => {
    setEditingId(a.id);
    setEditing({ ...a });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const { data } = await api.put(`/admin/amenities/${editingId}`, editing);
      setAmenities((prev) => prev.map((x) => (x.id === data.id ? data : x)).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingId(null);
      setEditing({});
    } catch (e: any) {
      if (e.response?.status === 413) {
        setError('Image is too large. Max size is 2 MB.');
      } else {
        setError(e.response?.data?.message || 'Failed to update amenity');
      }
    }
  };

  const deleteAmenity = async (id: string) => {
    try {
      await api.delete(`/admin/amenities/${id}`);
      setAmenities((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to delete amenity');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Amenities</h2>
        <span className="text-sm text-gray-600">{amenities.length} amenities</span>
      </div>

      {/* Restrictions Management */}
      <div className="bg-white border border-gray-200 rounded-md p-4 mb-6">
        <h3 className="text-md font-semibold text-gray-900 mb-3">Amenity Booking Restrictions</h3>
        <RestrictionsAdmin
          restrictions={restrictions}
          onRefresh={fetchRestrictions}
          onError={(msg) => setError(msg)}
        />
      </div>

      {/* Create */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3">
          <input className="rounded-md border border-gray-300 py-2 px-3" placeholder="Name" value={newAmenity.name || ''} onChange={(e) => setNewAmenity((s) => ({ ...s, name: e.target.value }))} />
          <input className="rounded-md border border-gray-300 py-2 px-3" placeholder="Description" value={newAmenity.description || ''} onChange={(e) => setNewAmenity((s) => ({ ...s, description: e.target.value }))} />
          <input className="rounded-md border border-gray-300 py-2 px-3" type="time" value={newAmenity.openTime || '09:00'} onChange={(e) => setNewAmenity((s) => ({ ...s, openTime: e.target.value }))} />
          <input className="rounded-md border border-gray-300 py-2 px-3" type="time" value={newAmenity.closeTime || '22:00'} onChange={(e) => setNewAmenity((s) => ({ ...s, closeTime: e.target.value }))} />
          <select className="rounded-md border border-gray-300 py-2 px-3" value={newAmenity.slotLength || 60} onChange={(e) => setNewAmenity((s) => ({ ...s, slotLength: Number(e.target.value) }))}>
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
            <option value={90}>90 min</option>
            <option value={120}>120 min</option>
          </select>
          <select className="rounded-md border border-gray-300 py-2 px-3" value={(newAmenity.bookingRestrictionId as any) || ''} onChange={(e) => setNewAmenity((s) => ({ ...s, bookingRestrictionId: e.target.value }))}>
            <option value="" disabled>Select restriction</option>
            {restrictions.map((r) => (
              <option key={r.id} value={r.id}>{r.name} (D{r.daysAhead}/P{r.maxPerPeriod}/D{r.maxPerDay})</option>
            ))}
          </select>
          <div className="flex items-center space-x-2">
            <input className="flex-1 rounded-md border border-gray-300 py-2 px-3" placeholder="Image URL (optional)" value={newAmenity.imageUrl || ''} onChange={(e) => setNewAmenity((s) => ({ ...s, imageUrl: e.target.value }))} />
          </div>
          <div className="flex items-center">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > MAX_IMAGE_BYTES) {
                  setError('Image is too large. Max size is 2 MB.');
                  return;
                }
                setError('');
                const reader = new FileReader();
                reader.onload = () => setNewAmenity((s) => ({ ...s, imageUrl: reader.result as string }));
                reader.readAsDataURL(file);
              }}
            />
          </div>
          <div className="flex items-center"><Button onClick={handleCreate} disabled={!restrictions.length || !newAmenity.bookingRestrictionId}>Add Amenity</Button></div>
        </div>
      </div>
      {!restrictions.length && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">Create a booking restriction first to add an amenity.</div>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading amenities...</p>
        </div>
      ) : amenities.length === 0 ? (
        <div className="text-center py-10 text-gray-600">No amenities yet. Add Amenity.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amenity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slot</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Restriction</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {amenities.map((a) => (
                <tr key={a.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <img src={a.imageUrl || placeholder} alt="amenity" className="h-10 w-10 rounded object-cover" />
                      {editingId === a.id ? (
                        <input className="rounded-md border border-gray-300 py-1 px-2" value={editing.name as string} onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))} />
                      ) : (
                        <div>
                          <div className="text-sm font-medium text-gray-900">{a.name}</div>
                          <div className="text-sm text-gray-500">{a.description}</div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingId === a.id ? (
                      <div className="flex items-center space-x-2">
                        <input type="time" className="rounded-md border border-gray-300 py-1 px-2" value={(editing.openTime as string) || a.openTime} onChange={(e) => setEditing((s) => ({ ...s, openTime: e.target.value }))} />
                        <span>-</span>
                        <input type="time" className="rounded-md border border-gray-300 py-1 px-2" value={(editing.closeTime as string) || a.closeTime} onChange={(e) => setEditing((s) => ({ ...s, closeTime: e.target.value }))} />
                      </div>
                    ) : (
                      `${a.openTime} - ${a.closeTime}`
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingId === a.id ? (
                      <select className="rounded-md border border-gray-300 py-1 px-2" value={(editing.slotLength as number) ?? a.slotLength} onChange={(e) => setEditing((s) => ({ ...s, slotLength: Number(e.target.value) }))}>
                        <option value={30}>30</option>
                        <option value={60}>60</option>
                        <option value={90}>90</option>
                        <option value={120}>120</option>
                      </select>
                    ) : (
                      `${a.slotLength} min`
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingId === a.id ? (
                      <select
                        className="rounded-md border border-gray-300 py-1 px-2"
                        value={(editing.bookingRestrictionId as string) ?? a.bookingRestrictionId ?? ''}
                        onChange={(e) => setEditing((s) => ({ ...s, bookingRestrictionId: e.target.value || null }))}
                      >
                        <option value="">No restriction</option>
                        {restrictions.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} (D{r.daysAhead} / P{r.maxPerPeriod} / D{r.maxPerDay})
                          </option>
                        ))}
                      </select>
                    ) : (
                      restrictions.find((r) => r.id === a.bookingRestrictionId)?.name || '—'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingId === a.id ? (
                      <div className="flex items-center space-x-3">
                        <input type="checkbox" checked={editing.isActive ?? a.isActive} onChange={(e) => setEditing((s) => ({ ...s, isActive: e.target.checked }))} />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > MAX_IMAGE_BYTES) {
                              setError('Image is too large. Max size is 2 MB.');
                              return;
                            }
                            setError('');
                            const reader = new FileReader();
                            reader.onload = () => setEditing((s) => ({ ...s, imageUrl: reader.result as string }));
                            reader.readAsDataURL(file);
                          }}
                        />
                      </div>
                    ) : (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${a.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{a.isActive ? 'Active' : 'Inactive'}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {editingId === a.id ? (
                      <>
                        <Button variant="secondary" onClick={() => { setEditingId(null); setEditing({}); }}>Cancel</Button>
                        <Button onClick={saveEdit}>Save</Button>
                      </>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={() => startEdit(a)}>Edit</Button>
                        <Button variant="secondary" className="text-red-600 hover:text-red-900" onClick={() => deleteAmenity(a.id)}>Delete</Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const RestrictionsAdmin: React.FC<{
  restrictions: Array<{ id: string; name: string; daysAhead: number; maxPerPeriod: number; maxPerDay: number; isActive: boolean }>;
  onRefresh: () => void;
  onError: (msg: string) => void;
}> = ({ restrictions, onRefresh, onError }) => {
  const [creating, setCreating] = useState({ name: '', daysAhead: 14, maxPerPeriod: 2, maxPerDay: 1 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ name?: string; daysAhead?: number; maxPerPeriod?: number; maxPerDay?: number; isActive?: boolean }>({});

  const createRestriction = async () => {
    if (!creating.name.trim()) return onError('Name is required');
    try {
      await api.post('/admin/restrictions', creating);
      setCreating({ name: '', daysAhead: 14, maxPerPeriod: 2, maxPerDay: 1 });
      onRefresh();
    } catch (e: any) {
      onError(e.response?.data?.message || 'Failed to create restriction');
    }
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await api.put(`/admin/restrictions/${editingId}`, editing);
      setEditingId(null);
      setEditing({});
      onRefresh();
    } catch (e: any) {
      onError(e.response?.data?.message || 'Failed to update restriction');
    }
  };

  const deleteRestriction = async (id: string) => {
    try {
      await api.delete(`/admin/restrictions/${id}`);
      onRefresh();
    } catch (e: any) {
      onError(e.response?.data?.message || 'Failed to delete restriction');
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-3">
        <input className="rounded-md border border-gray-300 py-2 px-3" placeholder="Name" value={creating.name} onChange={(e) => setCreating((s) => ({ ...s, name: e.target.value }))} />
        <input className="rounded-md border border-gray-300 py-2 px-3" type="number" min={1} placeholder="Days Ahead" value={creating.daysAhead} onChange={(e) => setCreating((s) => ({ ...s, daysAhead: Number(e.target.value) }))} />
        <input className="rounded-md border border-gray-300 py-2 px-3" type="number" min={0} placeholder="Max Per Period" value={creating.maxPerPeriod} onChange={(e) => setCreating((s) => ({ ...s, maxPerPeriod: Number(e.target.value) }))} />
        <input className="rounded-md border border-gray-300 py-2 px-3" type="number" min={0} placeholder="Max Per Day" value={creating.maxPerDay} onChange={(e) => setCreating((s) => ({ ...s, maxPerDay: Number(e.target.value) }))} />
        <div className="flex items-center"><Button onClick={createRestriction}>Add Restriction</Button></div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Ahead</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max/Period</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max/Day</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {restrictions.map((r) => (
              <tr key={r.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingId === r.id ? (
                    <input className="rounded-md border border-gray-300 py-1 px-2" value={editing.name ?? r.name} onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))} />
                  ) : (
                    r.name
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingId === r.id ? (
                    <input type="number" min={1} className="rounded-md border border-gray-300 py-1 px-2" value={editing.daysAhead ?? r.daysAhead} onChange={(e) => setEditing((s) => ({ ...s, daysAhead: Number(e.target.value) }))} />
                  ) : (
                    r.daysAhead
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingId === r.id ? (
                    <input type="number" min={0} className="rounded-md border border-gray-300 py-1 px-2" value={editing.maxPerPeriod ?? r.maxPerPeriod} onChange={(e) => setEditing((s) => ({ ...s, maxPerPeriod: Number(e.target.value) }))} />
                  ) : (
                    r.maxPerPeriod
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingId === r.id ? (
                    <input type="number" min={0} className="rounded-md border border-gray-300 py-1 px-2" value={editing.maxPerDay ?? r.maxPerDay} onChange={(e) => setEditing((s) => ({ ...s, maxPerDay: Number(e.target.value) }))} />
                  ) : (
                    r.maxPerDay
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingId === r.id ? (
                    <input type="checkbox" checked={editing.isActive ?? r.isActive} onChange={(e) => setEditing((s) => ({ ...s, isActive: e.target.checked }))} />
                  ) : (
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${r.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{r.isActive ? 'Active' : 'Inactive'}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  {editingId === r.id ? (
                    <>
                      <Button variant="secondary" onClick={() => { setEditingId(null); setEditing({}); }}>Cancel</Button>
                      <Button onClick={saveEdit}>Save</Button>
                    </>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={() => { setEditingId(r.id); setEditing({}); }}>Edit</Button>
                      <Button variant="secondary" className="text-red-600 hover:text-red-900" onClick={() => deleteRestriction(r.id)}>Delete</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


