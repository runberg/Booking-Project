import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '../components/Button';
import { api } from '../services/authService';
import { TabLoadingSpinner } from '../components/TabLoadingSpinner';

interface Amenity {
  id: string;
  name: string;
  description: string | null;
  openTime: string;
  closeTime: string;
  imageUrl: string | null;
  isActive: boolean;
  bookingRestrictionId?: string | null;
  slotLength: number;
  qrToken: string | null;
}

const placeholder = 'https://via.placeholder.com/80x80?text=Amenity';

export const AmenitiesAdmin: React.FC = () => {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [newAmenity, setNewAmenity] = useState<Partial<Amenity>>({ name: '', description: '', openTime: '09:00', closeTime: '22:00', slotLength: 60, imageUrl: '', bookingRestrictionId: '' as any });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Amenity>>({});
  const [error, setError] = useState<string>('');
  const [createOpen, setCreateOpen] = useState<boolean>(false);
  // Restrictions state
  const [restrictions, setRestrictions] = useState<Array<{ id: string; name: string; daysAhead: number; maxPerPeriod: number; maxPerDay: number; isActive: boolean }>>([]);
  const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
  const [qrModal, setQrModal] = useState<{ amenity: Amenity; dataUrl: string } | null>(null);
  const [createRestrictionOpen, setCreateRestrictionOpen] = useState<boolean>(false);
  const [newRestriction, setNewRestriction] = useState<{ name: string; daysAhead: number; maxPerPeriod: number; maxPerDay: number }>({ name: '', daysAhead: 14, maxPerPeriod: 2, maxPerDay: 1 });

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
    } catch { // NOSONAR — intentionally silent; UI handles empty-list state
    }
  };

  const handleCreate = async () => {
    if (!newAmenity.name?.trim()) return;
    try {
      const payload = {
        name: (newAmenity.name ?? '').trim(),
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

  const openQrModal = async (a: Amenity) => {
    const token = a.qrToken;
    if (!token) return;
    const dataUrl = await QRCode.toDataURL(token, { width: 300, margin: 2 });
    setQrModal({ amenity: a, dataUrl });
  };

  const downloadQr = (dataUrl: string, amenityName: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `qr-${amenityName.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.click();
  };

  const regenerateQr = async (a: Amenity) => {
    try {
      const { data } = await api.post(`/admin/amenities/${a.id}/qr/regenerate`);
      setAmenities((prev) => prev.map((x) => (x.id === data.id ? data : x)));
      const dataUrl = await QRCode.toDataURL(data.qrToken, { width: 300, margin: 2 });
      setQrModal({ amenity: data, dataUrl });
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to regenerate QR code');
    }
  };

  const patchEditing = (patch: Partial<Amenity>) => setEditing((s) => ({ ...s, ...patch }));

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image is too large. Max size is 2 MB.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => patchEditing({ imageUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const renderAmenitiesContent = () => {
    if (isLoading) {
      return (
        <TabLoadingSpinner message="Loading amenities..." />
      );
    }
    if (amenities.length === 0) {
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center text-gray-600">
          No amenities yet. Click "Add Amenity" to create one.
        </div>
      );
    }
    return (
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
                      <input className="rounded-md border border-gray-300 py-1 px-2" value={editing.name as string} onChange={(e) => patchEditing({ name: e.target.value })} />
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
                      <input type="time" className="rounded-md border border-gray-300 py-1 px-2" value={(editing.openTime as string) || a.openTime} onChange={(e) => patchEditing({ openTime: e.target.value })} />
                      <span>-</span>
                      <input type="time" className="rounded-md border border-gray-300 py-1 px-2" value={(editing.closeTime as string) || a.closeTime} onChange={(e) => patchEditing({ closeTime: e.target.value })} />
                    </div>
                  ) : (
                    `${a.openTime} - ${a.closeTime}`
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingId === a.id ? (
                    <select className="rounded-md border border-gray-300 py-1 px-2" value={(editing.slotLength as number) ?? a.slotLength} onChange={(e) => patchEditing({ slotLength: Number(e.target.value) })}>
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
                      onChange={(e) => patchEditing({ bookingRestrictionId: e.target.value || null })}
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
                      <input type="checkbox" checked={editing.isActive ?? a.isActive} onChange={(e) => patchEditing({ isActive: e.target.checked })} />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
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
                      <Button variant="secondary" onClick={() => a.qrToken ? openQrModal(a) : regenerateQr(a)} title={a.qrToken ? 'View QR code' : 'Generate QR code'}>QR</Button>
                      <Button variant="secondary" className="text-red-600 hover:text-red-900" onClick={() => deleteAmenity(a.id)}>Delete</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Amenities</h2>
      </div>

      {/* Restrictions */}
      <div className="bg-white border border-gray-200 rounded-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3">
          <h3 className="text-md font-semibold text-gray-900 mb-2 sm:mb-0">Amenity Booking Restrictions</h3>
        </div>
        <div className="mb-4">
          <Button variant="secondary" onClick={() => setCreateRestrictionOpen(true)}>Add Restriction</Button>
        </div>
        {restrictions.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center text-gray-600">
            No restrictions yet. Click "Add Restriction" to create one.
          </div>
        ) : (
          <RestrictionsAdmin
            restrictions={restrictions}
            onRefresh={fetchRestrictions}
            onError={(msg) => setError(msg)}
            hideCreate
          />
        )}
      </div>
      {/* Create Amenity Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50">
          <div className="flex min-h-screen items-center justify-center p-4">
            <button type="button" aria-label="Close" className="fixed inset-0 bg-black bg-opacity-50 cursor-default" onClick={() => setCreateOpen(false)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Add Amenity</h3>
                <p className="text-sm text-gray-600">Provide details for the new amenity.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor="amenity-new-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input id="amenity-new-name" className="w-full rounded-md border border-gray-300 py-2 px-3" value={newAmenity.name || ''} onChange={(e) => setNewAmenity((s) => ({ ...s, name: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="amenity-new-desc" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input id="amenity-new-desc" className="w-full rounded-md border border-gray-300 py-2 px-3" value={newAmenity.description || ''} onChange={(e) => setNewAmenity((s) => ({ ...s, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="amenity-new-open" className="block text-sm font-medium text-gray-700 mb-1">Open time</label>
                    <input id="amenity-new-open" className="w-full rounded-md border border-gray-300 py-2 px-3" type="time" value={newAmenity.openTime || '09:00'} onChange={(e) => setNewAmenity((s) => ({ ...s, openTime: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="amenity-new-close" className="block text-sm font-medium text-gray-700 mb-1">Close time</label>
                    <input id="amenity-new-close" className="w-full rounded-md border border-gray-300 py-2 px-3" type="time" value={newAmenity.closeTime || '22:00'} onChange={(e) => setNewAmenity((s) => ({ ...s, closeTime: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label htmlFor="amenity-new-slot" className="block text-sm font-medium text-gray-700 mb-1">Slot length</label>
                  <select id="amenity-new-slot" className="w-full rounded-md border border-gray-300 py-2 px-3" value={newAmenity.slotLength || 60} onChange={(e) => setNewAmenity((s) => ({ ...s, slotLength: Number(e.target.value) }))}>
                    <option value={30}>30 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>120 min</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="amenity-new-restriction" className="block text-sm font-medium text-gray-700 mb-1">Restriction</label>
                  <select id="amenity-new-restriction" className="w-full rounded-md border border-gray-300 py-2 px-3" value={(newAmenity.bookingRestrictionId as any) || ''} onChange={(e) => setNewAmenity((s) => ({ ...s, bookingRestrictionId: e.target.value }))}>
                    <option value="" disabled>Select restriction</option>
                    {restrictions.map((r) => (
                      <option key={r.id} value={r.id}>{r.name} (D{r.daysAhead}/P{r.maxPerPeriod}/D{r.maxPerDay})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="amenity-new-imageurl" className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
                  <input id="amenity-new-imageurl" className="w-full rounded-md border border-gray-300 py-2 px-3" value={newAmenity.imageUrl || ''} onChange={(e) => setNewAmenity((s) => ({ ...s, imageUrl: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="amenity-new-upload" className="block text-sm font-medium text-gray-700 mb-1">Upload Image (optional)</label>
                  <input
                    id="amenity-new-upload"
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
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={async () => { await handleCreate(); setCreateOpen(false); }}>Create</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {!restrictions.length && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">Create a booking restriction first to add an amenity.</div>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-md p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3">
          <h3 className="text-md font-semibold text-gray-900 mb-2 sm:mb-0">Amenities</h3>
        </div>
        <div className="mb-4">
          <Button onClick={() => setCreateOpen(true)} variant="secondary" disabled={!restrictions.length}>Add Amenity</Button>
        </div>
        {renderAmenitiesContent()}
      </div>
      {/* QR Code Modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="fixed inset-0 bg-black bg-opacity-50 cursor-default" onClick={() => setQrModal(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{qrModal.amenity.name}</h3>
            <p className="text-xs text-gray-500 mb-4">Print and place this QR code at the amenity. Residents scan it to check in.</p>
            <img src={qrModal.dataUrl} alt="QR code" className="mx-auto mb-4 w-52 h-52" />
            <div className="flex gap-2 justify-center mb-4">
              <Button onClick={() => downloadQr(qrModal.dataUrl, qrModal.amenity.name)}>Download PNG</Button>
              <Button variant="secondary" onClick={() => regenerateQr(qrModal.amenity)}>Regenerate</Button>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              Regenerating creates a new QR code and invalidates any previously printed ones.
            </p>
            <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl" onClick={() => setQrModal(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Create Restriction Modal */}
      {createRestrictionOpen && (
        <div className="fixed inset-0 z-50">
          <div className="flex min-h-screen items-center justify-center p-4">
            <button type="button" aria-label="Close" className="fixed inset-0 bg-black bg-opacity-50 cursor-default" onClick={() => setCreateRestrictionOpen(false)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Add Restriction</h3>
                <p className="text-sm text-gray-600">Define the booking limits for amenities.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor="restriction-new-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input id="restriction-new-name" className="w-full rounded-md border border-gray-300 py-2 px-3" value={newRestriction.name} onChange={(e) => setNewRestriction((s) => ({ ...s, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="restriction-new-days" className="block text-sm font-medium text-gray-700 mb-1">Days ahead</label>
                    <input id="restriction-new-days" className="w-full rounded-md border border-gray-300 py-2 px-3" type="number" min={1} value={newRestriction.daysAhead} onChange={(e) => setNewRestriction((s) => ({ ...s, daysAhead: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label htmlFor="restriction-new-per-period" className="block text-sm font-medium text-gray-700 mb-1">Max per period</label>
                    <input id="restriction-new-per-period" className="w-full rounded-md border border-gray-300 py-2 px-3" type="number" min={0} value={newRestriction.maxPerPeriod} onChange={(e) => setNewRestriction((s) => ({ ...s, maxPerPeriod: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label htmlFor="restriction-new-per-day" className="block text-sm font-medium text-gray-700 mb-1">Max per day</label>
                    <input id="restriction-new-per-day" className="w-full rounded-md border border-gray-300 py-2 px-3" type="number" min={0} value={newRestriction.maxPerDay} onChange={(e) => setNewRestriction((s) => ({ ...s, maxPerDay: Number(e.target.value) }))} />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <Button variant="secondary" onClick={() => setCreateRestrictionOpen(false)}>Cancel</Button>
                <Button onClick={async () => {
                  if (!newRestriction.name.trim()) { setError('Name is required'); return; }
                  try {
                    await api.post('/admin/restrictions', newRestriction);
                    setNewRestriction({ name: '', daysAhead: 14, maxPerPeriod: 2, maxPerDay: 1 });
                    setCreateRestrictionOpen(false);
                    fetchRestrictions();
                  } catch (e: any) {
                    setError(e.response?.data?.message || 'Failed to create restriction');
                  }
                }}>Create</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RestrictionsAdmin: React.FC<{
  restrictions: Array<{ id: string; name: string; daysAhead: number; maxPerPeriod: number; maxPerDay: number; isActive: boolean }>;
  onRefresh: () => void;
  onError: (msg: string) => void;
  hideCreate?: boolean;
}> = ({ restrictions, onRefresh, onError, hideCreate }) => {
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
      {!hideCreate && (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-3">
          <input className="rounded-md border border-gray-300 py-2 px-3" placeholder="Name" value={creating.name} onChange={(e) => setCreating((s) => ({ ...s, name: e.target.value }))} />
          <input className="rounded-md border border-gray-300 py-2 px-3" type="number" min={1} placeholder="Days Ahead" value={creating.daysAhead} onChange={(e) => setCreating((s) => ({ ...s, daysAhead: Number(e.target.value) }))} />
          <input className="rounded-md border border-gray-300 py-2 px-3" type="number" min={0} placeholder="Max Per Period" value={creating.maxPerPeriod} onChange={(e) => setCreating((s) => ({ ...s, maxPerPeriod: Number(e.target.value) }))} />
          <input className="rounded-md border border-gray-300 py-2 px-3" type="number" min={0} placeholder="Max Per Day" value={creating.maxPerDay} onChange={(e) => setCreating((s) => ({ ...s, maxPerDay: Number(e.target.value) }))} />
          <div className="flex items-center"><Button onClick={createRestriction}>Add Restriction</Button></div>
        </div>
      )}

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
                    <input className="rounded-md border border-gray-300 py-1 px-2" value={editing.name ?? r.name} onChange={(e) => patchEditing({ name: e.target.value })} />
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
                    <input type="checkbox" checked={editing.isActive ?? r.isActive} onChange={(e) => patchEditing({ isActive: e.target.checked })} />
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


