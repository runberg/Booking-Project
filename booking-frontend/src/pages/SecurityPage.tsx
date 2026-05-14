import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, api } from '../services/authService';

interface BookingInfo {
  userName: string;
  userEmail: string;
  building: string;
  apartmentNumber: string;
  startTime: string;
  slotLength: number;
  date: string;
}

interface AmenityStatus {
  id: string;
  name: string;
  currentBooking: BookingInfo | null;
  nextBooking: BookingInfo | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

const formatTime = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

const formatDateDmy = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
};

const isToday = (isoDate: string) => {
  const now = new Date();
  return isoDate === `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const BookingCard: React.FC<{ booking: BookingInfo; showDate?: boolean }> = ({ booking, showDate }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-1">
    <div className="flex items-center justify-between">
      <span className="font-medium text-gray-900 text-sm">{booking.userName}</span>
      <span className="text-xs text-gray-500">{booking.startTime} ({booking.slotLength} min)</span>
    </div>
    <div className="text-xs text-gray-600">{booking.userEmail}</div>
    <div className="flex items-center gap-3 text-xs text-gray-700">
      <span>Building {booking.building}</span>
      <span>Apt {booking.apartmentNumber}</span>
      {showDate && <span className="font-medium text-primary-700">{formatDateDmy(booking.date)}</span>}
    </div>
  </div>
);

export const SecurityPage: React.FC = () => {
  const navigate = useNavigate();
  const [amenities, setAmenities] = useState<AmenityStatus[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    try {
      const { data } = await api.get('/security/dashboard');
      setAmenities(data);
      setError('');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const dataInterval = setInterval(fetchDashboard, 60_000);
    return () => clearInterval(dataInterval);
  }, [fetchDashboard]);

  useEffect(() => {
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1_000);
    return () => clearInterval(clockInterval);
  }, []);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const now = currentTime;
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Security Dashboard</h1>
              <p className="text-sm text-gray-500 mt-0.5">{dateStr} &mdash; {formatTime(now)}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-3 text-sm text-gray-600">Loading dashboard...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-700">{error}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {amenities.map((amenity) => (
              <div key={amenity.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-800 px-4 py-3">
                  <h2 className="text-base font-semibold text-white">{amenity.name}</h2>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Current booking</p>
                    {amenity.currentBooking ? (
                      <BookingCard booking={amenity.currentBooking} />
                    ) : (
                      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                        No current booking
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Next booking</p>
                    {amenity.nextBooking ? (
                      <BookingCard
                        booking={amenity.nextBooking}
                        showDate={!isToday(amenity.nextBooking.date)}
                      />
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500">
                        No upcoming bookings
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
