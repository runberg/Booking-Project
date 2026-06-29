import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Mail, CheckCircle, XCircle } from 'lucide-react';
import { authService, api } from '../services/authService';

type PageState = 'idle' | 'verifying' | 'pending' | 'verified' | 'error';

function getStatusDisplay(state: PageState): { icon: React.ReactNode; heading: string; sub: string } {
  if (state === 'pending') {
    return {
      icon: <Mail className="mx-auto h-16 w-16 text-amber-500" />,
      heading: 'Awaiting Approval',
      sub: 'Your email has been verified.',
    };
  }
  if (state === 'verified') {
    return {
      icon: <CheckCircle className="mx-auto h-16 w-16 text-green-500" />,
      heading: 'Email Verified!',
      sub: 'Your email has been successfully verified.',
    };
  }
  if (state === 'error') {
    return {
      icon: <XCircle className="mx-auto h-16 w-16 text-red-500" />,
      heading: 'Verification Failed',
      sub: 'There was an issue verifying your email.',
    };
  }
  return {
    icon: <Mail className="mx-auto h-16 w-16 text-primary-500" />,
    heading: 'Check your email',
    sub: "We've sent you a verification link",
  };
}

const CardContent: React.FC<{
  state: PageState;
  idleMessage: string;
  pendingMessage: string;
  error: string;
  onNavigate: (path: string) => void;
}> = ({ state, idleMessage, pendingMessage, error, onNavigate }) => {
  if (state === 'verifying') {
    return (
      <div className="space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        <p className="text-sm text-gray-600">Verifying your email...</p>
      </div>
    );
  }
  if (state === 'pending') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 text-left">
          {pendingMessage || 'Your account is awaiting admin approval. You will be notified by email once approved.'}
        </div>
        <Button variant="secondary" onClick={() => onNavigate('/login')} className="w-full">
          Back to sign in
        </Button>
      </div>
    );
  }
  if (state === 'verified') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Your account is now verified and ready to use!</p>
        <Button onClick={() => onNavigate('/login')} className="w-full">Sign in</Button>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">{error}</p>
        <Button variant="secondary" onClick={() => onNavigate('/login')} className="w-full">
          Back to login
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Mail className="mx-auto h-12 w-12 text-primary-500" />
      <p className="text-sm text-gray-600">{idleMessage}</p>
      <p className="text-sm text-gray-500">Click the link in your email to complete your registration.</p>
      <Button variant="secondary" onClick={() => onNavigate('/login')} className="w-full">
        Back to login
      </Button>
    </div>
  );
};

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [pageState, setPageState] = useState<PageState>('idle');
  const [pendingMessage, setPendingMessage] = useState('');
  const [error, setError] = useState('');

  const idleMessage = location.state?.message || 'Registration successful! Please check your email to verify your account.';
  const token = new URLSearchParams(location.search).get('token');

  useEffect(() => {
    if (token) {
      doVerify();
    }
  }, [token]);

  const doVerify = async () => {
    setPageState('verifying');
    try {
      const result = await authService.verifyEmail(token!);
      if (result.pendingApproval) {
        setPageState('pending');
        try {
          const { data } = await api.get('/email-templates/approval-content');
          setPendingMessage(data.pendingMessage || '');
        } catch {
          // use default text
        }
      } else {
        setPageState('verified');
      }
    } catch (err: any) {
      setError(err.message);
      setPageState('error');
    }
  };

  const { icon, heading, sub } = getStatusDisplay(pageState);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          {icon}
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">{heading}</h2>
          <p className="mt-2 text-center text-sm text-gray-600">{sub}</p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <div className="text-center space-y-6">
            <CardContent
              state={pageState}
              idleMessage={idleMessage}
              pendingMessage={pendingMessage}
              error={error}
              onNavigate={navigate}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};
