import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { api, authService } from '../services/authService';
import { formatIsoDateToDmy } from '../utils/date';

type AmenityPublic = {
  id: string;
  name: string;
  description: string | null;
  openTime: string; // HH:mm
  closeTime: string; // HH:mm
  slotLength: number; // minutes
  imageUrl: string | null;
  daysAhead: number; // allowed days ahead
  maxPerPeriod: number | null;
  maxPerDay: number | null;
};

const placeholder = 'https://via.placeholder.com/120x80?text=Amenity';

export const BookingPage: React.FC = () => {
  const navigate = useNavigate();
  const [amenities, setAmenities] = useState<AmenityPublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AmenityPublic | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(''); // yyyy-mm-dd
  const [selectedTime, setSelectedTime] = useState<string>(''); // HH:mm
  const [myBookings, setMyBookings] = useState<Array<{ id: string; amenityId: string; date: string; startTime: string; slotLength: number }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const currentUser = authService.getCurrentUser();
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; bookingId: string | null }>(() => ({ open: false, bookingId: null }));
  const [infoMessage, setInfoMessage] = useState<string>('');
  const [upcoming, setUpcoming] = useState<Array<{ id: string; amenityName: string; date: string; startTime: string; slotLength: number; userName: string; building: string; apartmentNumber: string }>>([]);
  const periodLimitReached = useMemo(() => {
    if (!selected) return false;
    if (selected.maxPerPeriod == null || selected.maxPerPeriod <= 0) return false;
    const now = new Date();
    const startKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const end = new Date(now);
    end.setDate(end.getDate() + selected.daysAhead);
    const endKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    const inRange = (d: string) => d >= startKey && d <= endKey;
    const count = myBookings.filter((b) => b.amenityId === selected.id && inRange(b.date)).length;
    return count >= (selected.maxPerPeriod || 0);
  }, [selected, myBookings]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/amenities');
        setAmenities(data);
      } catch (e: any) {
        setError(e.response?.data?.message || 'Failed to load amenities');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadUpcoming = async () => {
      if (!(currentUser?.role === 'admin' || currentUser?.role === 'super')) return;
      try {
        const { data } = await api.get('/bookings/upcoming');
        setUpcoming(data);
      } catch {}
    };
    loadUpcoming();
  }, [currentUser]);

  const refreshUpcomingIfAdmin = async () => {
    if (!(currentUser?.role === 'admin' || currentUser?.role === 'super')) return;
    try {
      const { data } = await api.get('/bookings/upcoming');
      setUpcoming(data);
    } catch {}
  };

  // Lightweight polling to keep Upcoming bookings fresh for admins
  useEffect(() => {
    if (!(currentUser?.role === 'admin' || currentUser?.role === 'super')) return;
    const id = setInterval(() => {
      refreshUpcomingIfAdmin();
    }, 10000); // every 10s
    return () => clearInterval(id);
  }, [currentUser]);

  // Build calendar weeks (Mon-Sun) from today to today+daysAhead
  const calendarWeeks = useMemo(() => {
    if (!selected) return [] as Array<Array<string | null>>;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + selected.daysAhead);
    const end = new Date(cutoff);
    end.setHours(0, 0, 0, 0); // include the cutoff date (time handled when generating slots)

    const dayOfWeek = (d: Date) => (d.getDay() === 0 ? 7 : d.getDay()); // Mon=1..Sun=7
    const formatDateLocal = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${da}`;
    };
    const getMonday = (d: Date) => {
      const x = new Date(d);
      const dow = dayOfWeek(x);
      x.setDate(x.getDate() - (dow - 1));
      x.setHours(0, 0, 0, 0);
      return x;
    };

    const weeks: Array<Array<string | null>> = [];
    let cursor = getMonday(today);
    while (cursor <= end) {
      // build one week Mon..Sun
      const row: Array<string | null> = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(cursor);
        d.setDate(cursor.getDate() + i);
        if ((weeks.length === 0 && d < today) || d > end) {
          row.push(null); // out of selectable range for first/last week
        } else {
          row.push(formatDateLocal(d));
        }
      }
      weeks.push(row);
      cursor.setDate(cursor.getDate() + 7);
    }
    return weeks;
  }, [selected]);

  const slots = useMemo(() => {
    if (!selected || !selectedDate) return [] as string[];
    const [openH, openM] = selected.openTime.split(':').map(Number);
    const [closeH, closeM] = selected.closeTime.split(':').map(Number);
    const start = new Date(`${selectedDate}T00:00:00`);
    start.setHours(openH, openM, 0, 0);
    const end = new Date(`${selectedDate}T00:00:00`);
    end.setHours(closeH, closeM, 0, 0);
    // cutoff within the last allowed day (rolling window now + daysAhead)
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + selected.daysAhead);
    const cutoffDateStr = (() => {
      const y = cutoff.getFullYear();
      const m = String(cutoff.getMonth() + 1).padStart(2, '0');
      const da = String(cutoff.getDate()).padStart(2, '0');
      return `${y}-${m}-${da}`;
    })();
    const todayDateStr = (() => {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const da = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${da}`;
    })();

    const out: string[] = [];
    const cur = new Date(start);
    while (cur < end) {
      const next = new Date(cur);
      next.setMinutes(cur.getMinutes() + selected.slotLength);
      let withinCutoff = true;
      if (selectedDate === cutoffDateStr) {
        // Only allow slots starting before or at cutoff time
        const curMinutes = cur.getHours() * 60 + cur.getMinutes();
        const cutoffMinutes = cutoff.getHours() * 60 + cutoff.getMinutes();
        withinCutoff = curMinutes <= cutoffMinutes;
      }
      let notInPastToday = true;
      if (selectedDate === todayDateStr) {
        const curMinutes = cur.getHours() * 60 + cur.getMinutes();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        notInPastToday = curMinutes >= nowMinutes;
      }
      if (next <= end && withinCutoff && notInPastToday) {
        out.push(cur.toTimeString().slice(0, 5));
      }
      cur.setMinutes(cur.getMinutes() + selected.slotLength);
    }
    return out;
  }, [selected, selectedDate]);

  useEffect(() => {
    const loadBooked = async () => {
      if (!selected || !selectedDate) { setBookedTimes([]); return; }
      try {
        const { data } = await api.get(`/bookings/amenity/${selected.id}`, { params: { date: selectedDate } });
        setBookedTimes(data);
      } catch {
        setBookedTimes([]);
      }
    };
    loadBooked();
  }, [selected, selectedDate]);

  useEffect(() => {
    const loadMine = async () => {
      try {
        const { data } = await api.get('/bookings/me');
        setMyBookings(data);
      } catch {}
    };
    loadMine();
  }, []);

  const confirmBooking = async () => {
    if (!selected || !selectedDate || !selectedTime) return;
    setIsSubmitting(true);
    setInfoMessage('');
    try {
      const { data: created } = await api.post('/bookings', {
        amenityId: selected.id,
        date: selectedDate,
        startTime: selectedTime,
        slotLength: selected.slotLength,
      });
      if (currentUser?.role === 'admin' || currentUser?.role === 'super') {
        setUpcoming((prev) => {
          const next = [
            ...prev,
            {
              id: created.id,
              amenityName: selected.name,
              date: selectedDate,
              startTime: selectedTime,
              slotLength: selected.slotLength,
              userName: currentUser?.name || '',
              building: currentUser?.building || '',
              apartmentNumber: currentUser?.apartmentNumber || '',
            },
          ];
          next.sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)));
          return next.slice(0, 10);
        });
      }
      // refresh my bookings
      const mine = await api.get('/bookings/me');
      setMyBookings(mine.data);
      // refresh upcoming for admins
      await refreshUpcomingIfAdmin();
      setSelected(null);
      setSelectedDate('');
      setSelectedTime('');
      setStep('select');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to create booking';
      setInfoMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteBooking = async (id: string) => {
    try {
      await api.delete(`/bookings/${id}`);
      if (currentUser?.role === 'admin' || currentUser?.role === 'super') {
        setUpcoming((prev) => prev.filter((u) => u.id !== id));
      }
      const mine = await api.get('/bookings/me');
      setMyBookings(mine.data);
      await refreshUpcomingIfAdmin();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to delete booking');
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Booking</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {currentUser?.name} ({currentUser?.email})</span>
              {currentUser?.role === 'admin' && (
                <Button onClick={() => navigate('/admin')}>Admin Dashboard</Button>
              )}
              <Button variant="secondary" onClick={handleLogout}>Logout</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="sr-only">Book an Amenity</h1>

        {(currentUser?.role === 'admin' || currentUser?.role === 'super') && (
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Upcoming bookings (next 10)</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-600">No upcoming bookings.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amenity</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Building</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Apartment</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {upcoming.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-2 text-sm text-gray-700">{u.amenityName}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{formatIsoDateToDmy(u.date)} {u.startTime} ({u.slotLength} min)</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{u.userName}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{u.building}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{u.apartmentNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        <div className="mt-8">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">My bookings</h2>
          {myBookings.length === 0 ? (
            <p className="text-sm text-gray-600">You have no bookings yet.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {myBookings.map((b) => (
                <li key={b.id} className="py-3 text-sm text-gray-700 flex items-center justify-between">
                  <div>
                    <span className="font-medium">{amenities.find((a) => a.id === b.amenityId)?.name || 'Amenity'}</span>
                    <span className="ml-2">{formatIsoDateToDmy(b.date)} {b.startTime} ({b.slotLength} min)</span>
                  </div>
                  <Button variant="secondary" onClick={() => setDeleteConfirm({ open: true, bookingId: b.id })}>Delete</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4 text-sm text-red-700">{error}</div>
        )}

        <div className="mt-8">
        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading amenities...</p>
          </div>
        ) : amenities.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-600">No amenities are currently available for booking.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {amenities.map((a) => (
              <Card key={a.id}>
                <div className="flex items-start space-x-4">
                  <img alt="amenity" src={a.imageUrl || placeholder} className="h-20 w-32 object-cover rounded" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{a.name}</h3>
                    <p className="mt-1 text-sm text-gray-600">{a.description}</p>
                    <div className="mt-3">
                      <Button variant="secondary" onClick={() => { setSelected(a); setSelectedDate(''); setSelectedTime(''); setStep('select'); }}>Book</Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        </div>

        {selected && (
          <div className="fixed inset-0 z-50">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSelected(null)} />
              <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{selected.name}</h3>
                    <p className="text-sm text-gray-600">Select a date and time slot</p>
                  </div>
                  <button className="text-gray-500 hover:text-gray-700" onClick={() => setSelected(null)}>✕</button>
                </div>

                {step === 'select' ? (
                  periodLimitReached ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-sm text-yellow-800">
                      Sorry! You have reached the limit of bookings as per the restrictions set for the amenity.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Select date</h4>
                        {selected?.maxPerPeriod != null && selected?.maxPerDay != null && (
                          <p className="text-xs text-gray-600 mb-3">
                            Bookings can only be created {selected.daysAhead} days ahead of today. Only {selected.maxPerPeriod} bookings per user within this time period and only {selected.maxPerDay} bookings per user per day.
                          </p>
                        )}
                        <div className="border border-gray-200 rounded-md p-3 max-h-80 overflow-y-auto">
                          <div className="grid grid-cols-7 gap-2 mb-2 text-xs font-medium text-gray-600">
                            <div className="text-center">Mon</div>
                            <div className="text-center">Tue</div>
                            <div className="text-center">Wed</div>
                            <div className="text-center">Thu</div>
                            <div className="text-center">Fri</div>
                            <div className="text-center">Sat</div>
                            <div className="text-center">Sun</div>
                          </div>
                          <div className="space-y-2">
                            {calendarWeeks.map((week, wi) => (
                              <div key={wi} className="grid grid-cols-7 gap-2">
                                {week.map((d, di) => {
                                  if (!d) return (<div key={`empty-${wi}-${di}`} className="py-2 text-xs text-center text-gray-300 border border-transparent">—</div>);
                                  const dayBookingsCount = myBookings.filter((b) => b.amenityId === (selected?.id || '') && b.date === d).length;
                                  const dayDisabled = selected?.maxPerDay != null && dayBookingsCount >= (selected?.maxPerDay || 0);
                                  return (
                                    <button
                                      key={d}
                                      disabled={dayDisabled}
                                      className={`border rounded-md py-2 text-xs text-center ${
                                        dayDisabled
                                          ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                                          : selectedDate === d
                                          ? 'border-primary-600 text-primary-700'
                                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                      }`}
                                      onClick={() => {
                                        if (dayDisabled) {
                                          setInfoMessage('You have already made a booking this day');
                                          return;
                                        }
                                        setSelectedDate(d);
                                      }}
                                    >
                                      {new Date(d).getDate()}
                                    </button>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Available time slots</h4>
                        {!selectedDate ? (
                          <p className="text-sm text-gray-500">Select a date to see slots.</p>
                        ) : slots.length === 0 ? (
                          <div>
                            <p className="text-sm text-gray-500">Sorry! - No available time slots</p>
                            <div className="mt-3"><Button variant="secondary" onClick={() => setSelected(null)}>Close</Button></div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                            {slots.map((t) => {
                              const isBooked = bookedTimes.includes(t);
                              return (
                                <button
                                  key={t}
                                  disabled={isBooked}
                                  className={`border rounded-md py-2 px-2 text-sm ${
                                    isBooked
                                      ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                                      : selectedTime === t
                                      ? 'border-primary-600 text-primary-700'
                                      : 'border-gray-200 text-gray-700 hover:border-primary-600'
                                  }`}
                                  onClick={() => !isBooked && setSelectedTime(t)}
                                >
                                  {t}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                ) : (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-4">Confirm your booking</h4>
                    <div className="space-y-2 text-sm text-gray-700">
                      <div><span className="font-medium">Amenity:</span> {selected.name}</div>
                      <div><span className="font-medium">Date:</span> {formatIsoDateToDmy(selectedDate)}</div>
                      <div><span className="font-medium">Time:</span> {selectedTime} ({selected.slotLength} min)</div>
                    </div>
                  </div>
                )}

                {infoMessage && (
                  <div className="mt-4 text-sm text-red-600">{infoMessage}</div>
                )}
                <div className="mt-6 flex justify-end space-x-3">
                  <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
                  {step === 'select' ? (
                    <Button disabled={periodLimitReached || !selectedDate || !selectedTime} onClick={() => setStep('confirm')}>Continue</Button>
                  ) : (
                    <Button disabled={isSubmitting} onClick={confirmBooking}>{isSubmitting ? 'Booking...' : 'Confirm booking'}</Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {deleteConfirm.open && (
          <div className="fixed inset-0 z-50">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setDeleteConfirm({ open: false, bookingId: null })} />
              <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete booking</h3>
                <p className="text-sm text-gray-600">Are you sure you want to delete this booking?</p>
                <div className="mt-6 flex justify-end space-x-3">
                  <Button variant="secondary" onClick={() => setDeleteConfirm({ open: false, bookingId: null })}>Cancel</Button>
                  <Button onClick={async () => { if (deleteConfirm.bookingId) { await deleteBooking(deleteConfirm.bookingId); } setDeleteConfirm({ open: false, bookingId: null }); }}>Delete</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


