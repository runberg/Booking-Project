import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { authService, api } from '../services/authService';
import type { RegisterData } from '../types/auth';

const registerSchema = yup.object({
  email: yup.string().email('Invalid email address').required('Email is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    )
    .required('Password is required'),
  name: yup.string().min(2, 'Name must be at least 2 characters').required('Name is required'),
  building: yup.string().min(1, 'Building is required').required('Building is required'),
  apartmentNumber: yup.string().min(1, 'Apartment number is required').required('Apartment number is required'),
});

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterData>({
    resolver: yupResolver(registerSchema),
  });

  useEffect(() => {
    const loadBuildings = async () => {
      try {
        const { data } = await api.get('/buildings');
        setBuildings(data);
      } catch (e: any) {
        setError(e.response?.data?.message || 'Failed to load buildings');
      } finally {
        setIsLoadingBuildings(false);
      }
    };
    loadBuildings();
  }, []);

  const onSubmit = async (data: RegisterData) => {
    setIsLoading(true);
    setError('');

    try {
      await authService.register(data);
      navigate('/verify-email', { 
        state: { 
          message: 'Registration successful! Please check your email to verify your account.' 
        } 
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Join our booking platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Input
              label="Full Name"
              placeholder="Enter your full name"
              error={errors.name?.message}
              required
              {...register('name')}
            />

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Building</label>
              <select
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={isLoadingBuildings}
                {...register('building')}
                defaultValue=""
             >
                <option value="" disabled>
                  {isLoadingBuildings ? 'Loading buildings...' : 'Select a building'}
                </option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
              {errors.building?.message && (
                <p className="mt-1 text-sm text-red-600">{errors.building.message}</p>
              )}
            </div>

            <Input
              label="Apartment Number"
              placeholder="Enter your apartment number"
              error={errors.apartmentNumber?.message}
              required
              {...register('apartmentNumber')}
            />

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Already have an account?</span>
              </div>
            </div>

            <div className="mt-6">
              <Button
                variant="secondary"
                onClick={() => navigate('/login')}
                className="w-full"
              >
                Sign in
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
