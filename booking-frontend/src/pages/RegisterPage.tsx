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
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
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
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [units, setUnits] = useState<string[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [legalText, setLegalText] = useState<string>('Legal note - Account creation');

  // Shown when registration returns 409 (unit already registered)
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactData, setContactData] = useState({ name: '', email: '', building: '', unit: '', message: '' });
  const [isContactLoading, setIsContactLoading] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
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

  useEffect(() => {
    const loadLegalText = async () => {
      try {
        const { data } = await api.get('/email-templates/registration-legal-text');
        if (data?.text) {
          setLegalText(data.text);
        }
      } catch (e: any) {
        console.warn('Failed to load legal text:', e);
      }
    };
    loadLegalText();
  }, []);

  const handleBuildingChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const buildingName = e.target.value;
    const building = buildings.find((b) => b.name === buildingName);
    setValue('building', buildingName, { shouldValidate: true });
    setValue('apartmentNumber', '', { shouldValidate: false });
    setSelectedBuildingId(building?.id || '');
    setUnits([]);

    if (building?.id) {
      setIsLoadingUnits(true);
      try {
        const { data } = await api.get(`/buildings/${building.id}/units`);
        setUnits((data as Array<{ unitNumber: string }>).map((u) => u.unitNumber));
      } catch {
        setUnits([]);
      } finally {
        setIsLoadingUnits(false);
      }
    }
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setValue('apartmentNumber', e.target.value, { shouldValidate: true });
  };

  const onSubmit = async (data: RegisterData) => {
    setIsLoading(true);
    setError('');
    try {
      await authService.register(data);
      navigate('/verify-email', {
        state: {
          message: 'Registration successful! Please check your email to verify your account.',
        },
      });
    } catch (err: any) {
      if (err.statusCode === 409) {
        setShowContactForm(true);
        setContactData({
          name: data.name,
          email: data.email,
          building: data.building,
          unit: data.apartmentNumber,
          message: '',
        });
      } else {
        setError(err.message || 'Registration failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactSubmit = async () => {
    if (!contactData.message.trim()) return;
    setIsContactLoading(true);
    setContactError('');
    try {
      await api.post('/auth/contact-admin', contactData);
      setContactSent(true);
    } catch (e: any) {
      setContactError(e.response?.data?.message || 'Failed to send message. Please try again later.');
    } finally {
      setIsContactLoading(false);
    }
  };

  if (showContactForm) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Unit already registered
          </h2>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <Card>
            {contactSent ? (
              <div>
                <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                  <p className="text-sm text-green-700">
                    Your message has been sent to the administrator. They will be in touch with you shortly.
                  </p>
                </div>
                <Button variant="secondary" onClick={() => navigate('/login')} className="w-full">
                  Back to login
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  The unit <strong>{contactData.building}, {contactData.unit}</strong> is already registered. If you believe this is an error or you need access, please send a message to the administrator below.
                </p>
                {contactError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                    <p className="text-sm text-red-600">{contactError}</p>
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your message</label>
                    <textarea
                      className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[120px]"
                      placeholder="Describe your situation..."
                      value={contactData.message}
                      onChange={(e) => setContactData((d) => ({ ...d, message: e.target.value }))}
                    />
                  </div>
                  <Button
                    onClick={handleContactSubmit}
                    disabled={isContactLoading || !contactData.message.trim()}
                    className="w-full"
                  >
                    {isContactLoading ? 'Sending...' : 'Send message to admin'}
                  </Button>
                  <Button variant="secondary" onClick={() => setShowContactForm(false)} className="w-full">
                    Go back and try again
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Building <span className="text-red-500">*</span>
              </label>
              <select
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={isLoadingBuildings}
                defaultValue=""
                onChange={handleBuildingChange}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Apartment Number <span className="text-red-500">*</span>
              </label>
              <select
                key={selectedBuildingId}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                disabled={!selectedBuildingId || isLoadingUnits}
                defaultValue=""
                onChange={handleUnitChange}
              >
                <option value="" disabled>
                  {!selectedBuildingId
                    ? 'Select a building first'
                    : isLoadingUnits
                    ? 'Loading units...'
                    : 'Select apartment number'}
                </option>
                {units.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              {errors.apartmentNumber?.message && (
                <p className="mt-1 text-sm text-red-600">{errors.apartmentNumber.message}</p>
              )}
            </div>

            {legalText && (
              <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-3">
                {legalText}
              </div>
            )}

            <Button type="submit" disabled={isLoading} className="w-full">
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
              <Button variant="secondary" onClick={() => navigate('/login')} className="w-full">
                Sign in
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
