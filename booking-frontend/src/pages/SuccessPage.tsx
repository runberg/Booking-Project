import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { CheckCircle, Settings } from 'lucide-react';
import { authService } from '../services/authService';

export const SuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Successfully registered and logged in!
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Welcome to our booking platform
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <div className="text-center space-y-6">
            {user && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900">User Information</h3>
                  <div className="mt-2 text-sm text-gray-600 space-y-1">
                    <p><strong>Name:</strong> {user.name}</p>
                    <p><strong>Email:</strong> {user.email}</p>
                    <p><strong>Building:</strong> {user.building}</p>
                    <p><strong>Apartment:</strong> {user.apartmentNumber}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Your account has been successfully created and you are now logged in.
                You can start booking amenities like badminton, tennis, and paddle courts.
              </p>
              
              <p className="text-sm text-gray-500">
                (Booking functionality will be added in the next phase)
              </p>
            </div>

            <div className="flex flex-col space-y-3">
              {(user?.role === 'admin' || user?.role === 'super') && (
                <Button
                  variant="secondary"
                  onClick={() => navigate('/admin')}
                  className="w-full"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Admin Dashboard
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={handleLogout}
                className="w-full"
              >
                Sign out
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
