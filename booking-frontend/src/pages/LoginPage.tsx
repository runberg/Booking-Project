import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { authService, api } from '../services/authService';
import { formatDateTimeDmy } from '../utils/date';
import type { LoginData } from '../types/auth';

const loginSchema = yup.object({
  email: yup.string().email('Invalid email address').required('Email is required'),
  password: yup.string().required('Password is required'),
});

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionMsg, setSessionMsg] = useState('');
  const [amenities, setAmenities] = useState<Array<{ id: string; name: string; description?: string; imageUrl?: string }>>([]);
  const [availability, setAvailability] = useState<Record<string, { status: 'free' | 'booked' | 'closed'; freeUntil?: string | null; nextAvailable?: string | null; availableForDays?: number | null }>>({});

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get('reason') === 'expired';
    const fromFlag = (() => {
      try { return sessionStorage.getItem('sessionExpired') === '1'; } catch { return false; }
    })();
    if (fromQuery || fromFlag) {
      setSessionMsg('Your session has expired. Please sign in again.');
    } else {
      setSessionMsg('');
    }
    // Clear the one-shot flag so direct visits won't show it
    try { sessionStorage.removeItem('sessionExpired'); } catch {}
  }, [location.search]);

  // Load public amenities and availability for landing page
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [amenitiesRes, availabilityRes] = await Promise.all([
          api.get('/amenities'),
          api.get('/amenities/availability'),
        ]);
        if (!mounted) return;
        const ams = (amenitiesRes.data || []).map((a: any) => ({ id: a.id, name: a.name, description: a.description, imageUrl: a.imageUrl }));
        setAmenities(ams);
        const availById: Record<string, any> = {};
        for (const row of availabilityRes.data || []) {
          availById[row.id] = { status: row.status, freeUntil: row.freeUntil, nextAvailable: row.nextAvailable, availableForDays: row.availableForDays };
        }
        setAvailability(availById);
      } catch {}
    };
    load();
    return () => { mounted = false; };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({
    resolver: yupResolver(loginSchema),
  });

  const onSubmit = async (data: LoginData) => {
    setIsLoading(true);
    setError('');

    try {
      await authService.login(data);
      navigate('/bookings');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8">
        <h1 className="text-center text-3xl font-extrabold text-gray-900">
          Booking System
        </h1>
      </div>

      {/* Public Amenity Availability */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-4 mb-8">
        {amenities.map((a) => {
          const v = availability[a.id];
          const isFree = v?.status === 'free';
          const isBooked = v?.status === 'booked';
          const isClosed = v?.status === 'closed';
          return (
            <Card key={a.id}>
              <div className="flex items-start space-x-3">
                {a.imageUrl ? (
                  <img src={a.imageUrl} alt={a.name} className="w-12 h-12 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center text-gray-500 text-xs flex-shrink-0">Img</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-medium text-gray-900 truncate">{a.name}</h3>
                    {isFree && <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded">Free</span>}
                    {isBooked && <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded">Booked</span>}
                    {isClosed && <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">Closed</span>}
                  </div>
                  {a.description && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">{a.description}</p>
                  )}
                  <p className="mt-2 text-sm text-gray-700">
                    {isFree && v?.availableForDays ? (
                      <>Currently free — available for the next <span className="font-medium">{v.availableForDays}</span> days</>
                    ) : isFree ? (
                      <>Currently free — available until <span className="font-medium">{v?.freeUntil ? formatDateTimeDmy(v.freeUntil) : ''}</span></>
                    ) : null}
                    {isBooked && (
                      <>Currently booked — next available <span className="font-medium">{v?.nextAvailable ? formatDateTimeDmy(v.nextAvailable) : 'No free slots within window'}</span></>
                    )}
                    {isClosed && (
                      <>Closed now — opens at <span className="font-medium">{v?.nextAvailable ? formatDateTimeDmy(v.nextAvailable) : ''}</span></>
                    )}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Sign In Options */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <h2 className="text-center text-2xl font-semibold text-gray-900 mb-4">
            Sign in to your account
          </h2>
          <p className="text-center text-sm text-gray-600 mb-6">
            Welcome back to our booking platform
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {(error || sessionMsg) && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-600">{error || sessionMsg}</p>
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="Enter your email"
              error={errors.email?.message}
              required
              {...register('email')}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              error={errors.password?.message}
              required
              {...register('password')}
            />

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <a href="#" className="font-medium text-primary-600 hover:text-primary-500">
                  Forgot your password?
                </a>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Don't have an account?</span>
              </div>
            </div>

            <div className="mt-6">
              <Button
                variant="secondary"
                onClick={() => navigate('/register')}
                className="w-full"
              >
                Create account
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
