import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Mail, CheckCircle, XCircle } from 'lucide-react';
import { authService } from '../services/authService';

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState('');
  
  const message = location.state?.message || 'Registration successful! Please check your email to verify your account.';
  const token = new URLSearchParams(location.search).get('token');

  useEffect(() => {
    if (token) {
      verifyEmail();
    }
  }, [token]);

  const verifyEmail = async () => {
    setIsVerifying(true);
    setError('');
    
    try {
      await authService.verifyEmail(token!);
      setIsVerified(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  let statusIcon: React.ReactNode;
  if (isVerified) statusIcon = <CheckCircle className="mx-auto h-16 w-16 text-green-500" />;
  else if (error) statusIcon = <XCircle className="mx-auto h-16 w-16 text-red-500" />;
  else statusIcon = <Mail className="mx-auto h-16 w-16 text-primary-500" />;

  let statusHeading: string;
  if (isVerified) statusHeading = 'Email Verified!';
  else if (error) statusHeading = 'Verification Failed';
  else statusHeading = 'Check your email';

  let statusSub: string;
  if (isVerified) statusSub = 'Your email has been successfully verified.';
  else if (error) statusSub = 'There was an issue verifying your email.';
  else statusSub = "We've sent you a verification link";

  let cardContent: React.ReactNode;
  if (isVerifying) {
    cardContent = (
      <div className="space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="text-sm text-gray-600">Verifying your email...</p>
      </div>
    );
  } else if (isVerified) {
    cardContent = (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Your account is now verified and ready to use!
        </p>
        <Button onClick={() => navigate('/login')} className="w-full">
          Sign in
        </Button>
      </div>
    );
  } else if (error) {
    cardContent = (
      <div className="space-y-4">
        <p className="text-sm text-red-600">{error}</p>
        <Button variant="secondary" onClick={() => navigate('/login')} className="w-full">
          Back to login
        </Button>
      </div>
    );
  } else {
    cardContent = (
      <div className="space-y-4">
        <Mail className="mx-auto h-12 w-12 text-primary-500" />
        <p className="text-sm text-gray-600">{message}</p>
        <p className="text-sm text-gray-500">
          Click the link in your email to complete your registration.
        </p>
        <Button variant="secondary" onClick={() => navigate('/login')} className="w-full">
          Back to login
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          {statusIcon}
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {statusHeading}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {statusSub}
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <div className="text-center space-y-6">
            {cardContent}
          </div>
        </Card>
      </div>
    </div>
  );
};
