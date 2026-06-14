import React, { useEffect, useState } from 'react';
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
  email: yup.string().required('Email or username is required'),
  password: yup.string().required('Password is required'),
});

type AmenityStatus = {
  id: string;
  name: string;
  status: 'free' | 'booked' | 'closed';
  freeUntil?: string | null;
  nextAvailable?: string | null;
  availableForDays?: number | null;
};

function getAvailabilityLabel(a: AmenityStatus): string {
  if (a.status === 'free' && a.availableForDays) return `Free for ${a.availableForDays} days`;
  if (a.status === 'free' && a.freeUntil) return `Until ${formatDateTimeDmy(a.freeUntil)}`;
  if (a.status === 'booked' && a.nextAvailable) return `Next: ${formatDateTimeDmy(a.nextAvailable)}`;
  if (a.status === 'booked') return 'No slots in window';
  if (a.nextAvailable) return `Opens ${formatDateTimeDmy(a.nextAvailable)}`;
  return '';
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionMsg, setSessionMsg] = useState('');
  const [amenities, setAmenities] = useState<AmenityStatus[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get('reason') === 'expired';
    const fromFlag = (() => {
      try { return sessionStorage.getItem('sessionExpired') === '1'; } catch { return false; }
    })();
    setSessionMsg(fromQuery || fromFlag ? 'Your session has expired. Please sign in again.' : '');
    try { sessionStorage.removeItem('sessionExpired'); } catch {}
  }, [location.search]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [amenitiesRes, availabilityRes] = await Promise.all([
          api.get('/amenities'),
          api.get('/amenities/availability'),
        ]);
        if (!mounted) return;
        const availById: Record<string, any> = {};
        for (const row of availabilityRes.data || []) {
          availById[row.id] = row;
        }
        setAmenities(
          (amenitiesRes.data || []).map((a: any) => ({
            id: a.id,
            name: a.name,
            status: availById[a.id]?.status ?? 'closed',
            freeUntil: availById[a.id]?.freeUntil,
            nextAvailable: availById[a.id]?.nextAvailable,
            availableForDays: availById[a.id]?.availableForDays,
          })),
        );
      } catch {}
    };
    load();
    return () => { mounted = false; };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({ resolver: yupResolver(loginSchema) });

  const onSubmit = async (data: LoginData) => {
    setIsLoading(true);
    setError('');
    setSessionMsg('');
    try {
      const result = await authService.login(data);
      if (result.user?.role === 'security') {
        navigate('/security');
      } else {
        navigate('/bookings');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">

        {/* Page title */}
        <h1 className="text-center text-2xl font-bold text-gray-900 mb-5">
          Booking System
        </h1>

        {/* Login card */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sign in</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {(error || sessionMsg) && (
              <div className={`border rounded-md p-3 text-sm ${sessionMsg && !error ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-600'}`}>
                {error || sessionMsg}
              </div>
            )}

            <Input
              label="Email or username"
              type="text"
              placeholder="Enter your email or username"
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

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">New resident?</span>
            <Button variant="secondary" onClick={() => navigate('/register')} className="text-sm py-1.5 px-4">
              Create account
            </Button>
          </div>
        </Card>

        {/* Amenity availability — compact status list */}
        {amenities.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
              Current availability
            </p>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {amenities.map((a) => {
                const isFree = a.status === 'free';
                const isBooked = a.status === 'booked';
                return (
                  <div key={a.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <span className="text-sm font-medium text-gray-900 truncate">{a.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500 text-right max-w-[180px] truncate">
                        {getAvailabilityLabel(a)}
                      </span>
                      {isFree && (
                        <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded whitespace-nowrap">Free</span>
                      )}
                      {isBooked && (
                        <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded whitespace-nowrap">Booked</span>
                      )}
                      {a.status === 'closed' && (
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">Closed</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
