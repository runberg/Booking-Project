import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { api, authService } from '../services/authService';
import { formatIsoDateToDmy } from '../utils/date';
import { Trash2 } from 'lucide-react';

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

function dayButtonClass(disabled: boolean, isSelected: boolean): string {
  if (disabled) return 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50';
  if (isSelected) return 'border-primary-600 text-primary-700';
  return 'border-gray-200 text-gray-700 hover:border-gray-300';
}

type CalendarDay = string | null;

function CalendarGrid({ calendarWeeks, myBookings, selected, selectedDate, setSelectedDate, setSelectedTime, setInfoMessage }: Readonly<{
  calendarWeeks: CalendarDay[][];
  myBookings: Array<{ amenityId: string; date: string }>;
  selected: AmenityPublic | null;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  setSelectedTime: (time: string) => void;
  setInfoMessage: (msg: string) => void;
}>) {
  return (
    <div className="border border-gray-200 rounded-md p-2 sm:p-3 max-h-80 overflow-y-auto">
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-xs font-medium text-gray-600">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="text-center">{day}</div>
        ))}
      </div>
      <div className="space-y-1 sm:space-y-2">
        {calendarWeeks.map((week, wi) => (
          <div key={week.find((d) => d !== null) ?? `week-${wi}`} className="grid grid-cols-7 gap-1 sm:gap-2">
            {week.map((d, di) => {
              if (!d) return <div key={`empty-${wi}-${di}`} className="py-2 text-xs text-center text-gray-300 border border-transparent">—</div>;
              const dayBookingsCount = myBookings.filter((b) => b.amenityId === (selected?.id || '') && b.date === d).length;
              const dayDisabled = selected?.maxPerDay != null && dayBookingsCount >= (selected?.maxPerDay || 0);
              const handleDayClick = () => {
                if (dayDisabled) {
                  setInfoMessage('You have already made a booking this day');
                  return;
                }
                setSelectedDate(d);
                setSelectedTime('');
              };
              return (
                <button
                  key={d}
                  disabled={dayDisabled}
                  className={`border rounded-md py-2 text-xs text-center ${dayButtonClass(dayDisabled, selectedDate === d)}`}
                  onClick={handleDayClick}
                >
                  {new Date(d).getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const isPendingApproval = currentUser?.isApproved === false;
  const [pendingApprovalMessage, setPendingApprovalMessage] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; bookingId: string | null }>(() => ({ open: false, bookingId: null }));
  const [infoMessage, setInfoMessage] = useState<string>('');
  const [upcoming, setUpcoming] = useState<Array<{ id: string; amenityName: string; date: string; startTime: string; slotLength: number; userName: string; building: string; apartmentNumber: string }>>([]);
  const [bookingLegalText, setBookingLegalText] = useState<string>('Legal note - Booking confirmation');
  const [showPast, setShowPast] = useState(false);
  const [pastBookings, setPastBookings] = useState<Array<{ id: string; amenityId: string; date: string; startTime: string; slotLength: number }>>([]);
  const [pastTotal, setPastTotal] = useState(0);
  const [pastPage, setPastPage] = useState(1);
  const [isLoadingPast, setIsLoadingPast] = useState(false);
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

  // Helper function to find next booking for an amenity (for admins)
  const getNextBookingForAmenity = (amenityId: string) => {
    if (!(currentUser?.role === 'admin' || currentUser?.role === 'super')) return null;
    const amenity = amenities.find((a) => a.id === amenityId);
    if (!amenity) return null;
    
    // Find the next booking for this amenity by matching amenity name
    const now = new Date();
    const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Filter upcoming bookings for this amenity that are in the future
    const futureBookings = upcoming
      .filter((b) => b.amenityName === amenity.name)
      .filter((b) => {
        // Check if booking is in the future
        if (b.date > nowStr) return true;
        if (b.date === nowStr && b.startTime >= nowTime) return true;
        return false;
      })
      .sort((a, b) => {
        // Sort by date first, then time
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
      });
    
    return futureBookings.length > 0 ? futureBookings[0] : null;
  };

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

  const loadUpcoming = async () => {
    if (!(currentUser?.role === 'admin' || currentUser?.role === 'super')) return;
    try {
      const { data } = await api.get('/bookings/upcoming');
      setUpcoming(data);
    } catch {}
  };

  useEffect(() => {
    loadUpcoming();
  }, [currentUser]);

  const loadPastBookings = async (page = 1) => {
    setIsLoadingPast(true);
    try {
      const { data } = await api.get('/bookings/me/past', { params: { page, pageSize: 10 } });
      setPastBookings(data.items);
      setPastTotal(data.total);
      setPastPage(page);
    } catch {}
    finally {
      setIsLoadingPast(false);
    }
  };

  useEffect(() => {
    const loadBookingLegalText = async () => {
      try {
        const { data } = await api.get('/email-templates/booking-legal-text');
        if (data?.text) {
          setBookingLegalText(data.text);
        }
      } catch {
        // If it fails, just use the default
      }
    };
    loadBookingLegalText();
  }, []);

  useEffect(() => {
    if (!isPendingApproval) return;
    api.get('/email-templates/approval-content')
      .then(({ data }) => { if (data?.loggedInMessage) setPendingApprovalMessage(data.loggedInMessage); })
      .catch(() => {});
  }, [isPendingApproval]);

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
      await loadUpcoming();
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
      await loadUpcoming();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to delete booking');
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const slotButtonClass = (booked: boolean, isSelected: boolean): string => {
    if (booked) return 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50';
    if (isSelected) return 'border-primary-600 text-primary-700';
    return 'border-gray-200 text-gray-700 hover:border-primary-600';
  };

  const renderPastBookingsContent = () => {
    if (isLoadingPast) {
      return (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      );
    }
    if (pastBookings.length === 0) {
      return <p className="text-sm text-gray-600">No past bookings.</p>;
    }
    return (
      <>
        <ul className="divide-y divide-gray-200">
          {pastBookings.map((b) => (
            <li key={b.id} className="py-3">
              <div className="font-semibold text-gray-900">{amenities.find((a) => a.id === b.amenityId)?.name || 'Amenity'}</div>
              <div className="text-sm text-gray-600 mt-1">{formatIsoDateToDmy(b.date)} {b.startTime} ({b.slotLength} min)</div>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
          <div className="text-sm text-gray-600">Page {pastPage} of {Math.max(1, Math.ceil(pastTotal / 10))}</div>
          <div className="flex gap-2">
            <Button variant="secondary" className="text-xs px-3 py-2" disabled={pastPage <= 1} onClick={() => loadPastBookings(pastPage - 1)}>Prev</Button>
            <Button variant="secondary" className="text-xs px-3 py-2" disabled={pastPage >= Math.ceil(pastTotal / 10)} onClick={() => loadPastBookings(pastPage + 1)}>Next</Button>
          </div>
        </div>
      </>
    );
  };

  const renderBookingStep = (): React.ReactNode => {
    if (!selected) return null;
    if (step !== 'select') {
      return (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-4">Confirm your booking</h4>
          <div className="space-y-2 text-sm text-gray-700">
            <div><span className="font-semibold">{selected.name}</span></div>
            <div><span className="font-medium">Date:</span> {formatIsoDateToDmy(selectedDate)}</div>
            <div><span className="font-medium">Time:</span> {selectedTime} ({selected.slotLength} min)</div>
          </div>
        </div>
      );
    }
    if (periodLimitReached) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-sm text-yellow-800">
          Sorry! You have reached the limit of bookings as per the restrictions set for the amenity.
        </div>
      );
    }
    return (
      <div className="space-y-6">
        {selected?.maxPerPeriod != null && selected?.maxPerDay != null && (
          <p className="text-xs sm:text-sm text-gray-600">
            Bookings can only be created {selected.daysAhead} days ahead of today. Only {selected.maxPerPeriod} bookings per user within this time period and only {selected.maxPerDay} bookings per user per day.
          </p>
        )}
        <div>
          <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Select date</h4>
          <CalendarGrid
            calendarWeeks={calendarWeeks}
            myBookings={myBookings}
            selected={selected}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            setSelectedTime={setSelectedTime}
            setInfoMessage={setInfoMessage}
          />
        </div>
        {selectedDate && (
          <div>
            <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Available time slots</h4>
            {slots.length === 0 ? (
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Sorry! - No available time slots</p>
                <div className="mt-3"><Button variant="secondary" onClick={() => setSelected(null)} className="text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-3">Close</Button></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                {slots.map((t) => {
                  const isBooked = bookedTimes.includes(t);
                  return (
                    <button
                      key={t}
                      disabled={isBooked}
                      className={`border rounded-md py-2 px-2 text-sm ${slotButtonClass(isBooked, selectedTime === t)}`}
                      onClick={() => !isBooked && setSelectedTime(t)}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAmenitiesSection = () => {
    if (isLoading) {
      return (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading amenities...</p>
        </div>
      );
    }
    if (amenities.length === 0) {
      return (
        <Card>
          <p className="text-sm text-gray-600">No amenities are currently available for booking.</p>
        </Card>
      );
    }
    return (
      <div className="space-y-4">
        {amenities.map((a) => {
          const nextBooking = getNextBookingForAmenity(a.id);
          return (
            <Card key={a.id}>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-shrink-0 w-full sm:w-48">
                  <img alt="amenity" src={a.imageUrl || placeholder} className="w-full h-32 sm:h-36 object-cover rounded" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{a.name}</h3>
                      {a.description && <p className="text-sm text-gray-600 mt-1">{a.description}</p>}
                    </div>
                    <div className="flex-shrink-0">
                      <Button variant="secondary" onClick={() => { setSelected(a); setSelectedDate(''); setSelectedTime(''); setStep('select'); }} className="w-full sm:w-auto">Book</Button>
                    </div>
                  </div>
                  {(currentUser?.role === 'admin' || currentUser?.role === 'super') && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      {nextBooking ? (
                        <div className="text-xs sm:text-sm">
                          <span className="font-medium text-gray-700">Next booking: </span>
                          <span className="text-gray-600">{formatIsoDateToDmy(nextBooking.date)} {nextBooking.startTime} ({nextBooking.slotLength} min)</span>
                          <span className="text-gray-500 ml-2">- {nextBooking.userName} ({nextBooking.building}, Apt {nextBooking.apartmentNumber})</span>
                        </div>
                      ) : (
                        <div className="text-xs sm:text-sm text-gray-500">No upcoming bookings</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-6 gap-4">
            <div className="flex items-center">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Booking</h1>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <span className="text-xs sm:text-sm text-gray-600 truncate">Welcome, {currentUser?.name}</span>
              <div className="flex gap-2">
                {(currentUser?.role === 'admin' || currentUser?.role === 'super') && (
                  <Button onClick={() => navigate('/admin')} className="text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-3">Admin</Button>
                )}
                <Button variant="secondary" onClick={() => navigate('/profile')} className="text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-3">Profile</Button>
                <Button variant="secondary" onClick={handleLogout} className="text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-3">Logout</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="sr-only">Book an Amenity</h1>

        {isPendingApproval && (
          <Card>
            <div className="py-2">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Account Pending Approval</h2>
              <p className="text-sm text-gray-600">
                {pendingApprovalMessage || 'Your account is pending admin approval. You will be notified by email once your account has been approved and you can start making bookings.'}
              </p>
            </div>
          </Card>
        )}

        {!isPendingApproval && error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4 text-sm text-red-700">{error}</div>
        )}

        {/* My Upcoming Bookings + Past Bookings */}
        {!isPendingApproval && (
          <>
            <div className="mt-6">
              <Card>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">My upcoming bookings</h2>
                {myBookings.length === 0 ? (
                  <p className="text-sm text-gray-600">You have no upcoming bookings.</p>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {myBookings.map((b) => (
                      <li key={b.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900">{amenities.find((a) => a.id === b.amenityId)?.name || 'Amenity'}</div>
                          <div className="text-sm text-gray-600 mt-1">{formatIsoDateToDmy(b.date)} {b.startTime} ({b.slotLength} min)</div>
                        </div>
                        <button
                          onClick={() => setDeleteConfirm({ open: true, bookingId: b.id })}
                          className="flex-shrink-0 p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                          aria-label="Delete booking"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {/* Past Bookings Section */}
            <div className="mt-3">
              <button
                className="text-sm font-medium text-primary-600 hover:text-primary-800 flex items-center gap-1 py-1"
                onClick={() => {
                  if (!showPast) loadPastBookings(1);
                  setShowPast((s) => !s);
                }}
              >
                <span>{showPast ? '▲' : '▼'}</span>
                <span>{showPast ? 'Hide past bookings' : 'Show past bookings'}</span>
              </button>
              {showPast && (
                <div className="mt-3">
                  <Card>
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Past bookings</h2>
                    {renderPastBookingsContent()}
                  </Card>
                </div>
              )}
            </div>
          </>
        )}

        {/* Amenities Section */}
        {!isPendingApproval && (
          <div className="mt-8">
            {renderAmenitiesSection()}
          </div>
        )}

        {selected && (
          <div className="fixed inset-0 z-50">
            <div className="flex min-h-screen items-center justify-center p-4">
              <button type="button" aria-label="Close" className="fixed inset-0 bg-black bg-opacity-50 cursor-default" onClick={() => setSelected(null)} />
              <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900">{selected.name}</h3>
                  </div>
                  <button className="text-gray-500 hover:text-gray-700 text-xl sm:text-2xl leading-none flex-shrink-0" onClick={() => setSelected(null)} aria-label="Close">✕</button>
                </div>

                {renderBookingStep()}

                {infoMessage && (
                  <div className="mt-4 text-sm text-red-600">{infoMessage}</div>
                )}

                {step === 'confirm' && bookingLegalText && (
                  <div className="mt-4 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-3">
                    {bookingLegalText}
                  </div>
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
              <button type="button" aria-label="Close" className="fixed inset-0 bg-black bg-opacity-50 cursor-default" onClick={() => setDeleteConfirm({ open: false, bookingId: null })} />
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


