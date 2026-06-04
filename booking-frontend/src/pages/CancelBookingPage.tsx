import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { API_BASE_URL } from '../services/authService';
import { formatDateTimeDmy, formatIsoDateToDmy } from '../utils/date';

type Preview = {
  amenityName: string;
  date: string;
  startTime: string;
  slotLength: number;
  userName: string;
};

type Stage = 'loading' | 'confirm' | 'cancelled' | 'error';

export const CancelBookingPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('loading');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!token) { setStage('error'); setErrorMsg('Invalid link.'); return; }
    fetch(`${API_BASE_URL}/bookings/cancel-preview/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'This cancel link is invalid or has expired.');
        }
        return res.json();
      })
      .then((data: Preview) => {
        setPreview(data);
        setStage('confirm');
      })
      .catch((e) => {
        setErrorMsg(e.message);
        setStage('error');
      });
  }, [token]);

  const handleCancel = async () => {
    if (!token || isCancelling) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`${API_BASE_URL}/bookings/cancel-by-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Cancellation failed.');
      }
      setStage('cancelled');
    } catch (e: any) {
      setErrorMsg(e.message);
      setStage('error');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-center text-2xl font-bold text-gray-900 mb-6">Booking System</h1>

        <Card>
          {stage === 'loading' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
              <p className="mt-3 text-sm text-gray-600">Loading booking details…</p>
            </div>
          )}

          {stage === 'confirm' && preview && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Cancel your booking</h2>
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-6 space-y-2 text-sm text-gray-700">
                <div><span className="font-medium">Amenity:</span> {preview.amenityName}</div>
                <div><span className="font-medium">Date:</span> {formatIsoDateToDmy(preview.date)}</div>
                <div><span className="font-medium">Time:</span> {preview.startTime} ({preview.slotLength} min)</div>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to cancel this booking? This will free the slot for other residents.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => navigate('/login')}
                  className="flex-1"
                >
                  Keep booking
                </Button>
                <Button
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {isCancelling ? 'Cancelling…' : 'Confirm cancellation'}
                </Button>
              </div>
            </div>
          )}

          {stage === 'cancelled' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Booking cancelled</h2>
              <p className="text-sm text-gray-600 mb-6">
                Your booking has been cancelled and the slot is now available for others.
              </p>
              <Button onClick={() => navigate('/login')} className="w-full">
                Back to login
              </Button>
            </div>
          )}

          {stage === 'error' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Link unavailable</h2>
              <p className="text-sm text-gray-600 mb-6">{errorMsg}</p>
              <Button onClick={() => navigate('/login')} className="w-full">
                Back to login
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
