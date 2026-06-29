import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { api, authService } from '../services/authService';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  const [name, setName] = useState<string>(currentUser?.name ?? '');
  const [nameError, setNameError] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword) { setPasswordError('Enter your current password'); return; }
    if (newPassword.length < 8) { setPasswordError('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return; }
    setPasswordSaving(true);
    setPasswordError('');
    setPasswordSuccess(false);
    try {
      await api.patch('/profile/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
    } catch (e: any) {
      setPasswordError(e.response?.data?.message || 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setNameError('Name cannot be empty'); return; }
    if (trimmed.length > 100) { setNameError('Name must be 100 characters or fewer'); return; }
    setNameSaving(true);
    setNameError('');
    setNameSuccess(false);
    try {
      const { data } = await api.patch('/profile/name', { name: trimmed });
      const stored = localStorage.getItem('user');
      if (stored) {
        const user = JSON.parse(stored);
        localStorage.setItem('user', JSON.stringify({ ...user, name: data.name }));
      }
      setName(data.name);
      setNameSuccess(true);
    } catch (e: any) {
      setNameError(e.response?.data?.message || 'Failed to save name');
    } finally {
      setNameSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) { setDeleteError('Please enter your password'); return; }
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete('/profile', { data: { password: deletePassword } });
      authService.logout();
      navigate('/login');
    } catch (e: any) {
      setDeleteError(e.response?.data?.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
            <Button variant="secondary" onClick={() => navigate('/bookings')} className="text-sm px-4 py-2">
              ← Back to bookings
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Account info */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Account information</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex gap-4">
              <dt className="w-36 shrink-0 text-gray-500">Email</dt>
              <dd className="text-gray-900">{currentUser?.email}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-36 shrink-0 text-gray-500">Building</dt>
              <dd className="text-gray-900">{currentUser?.building}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-36 shrink-0 text-gray-500">Apartment</dt>
              <dd className="text-gray-900">{currentUser?.apartmentNumber}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-gray-400">Email, building and apartment are managed by your administrator.</p>
        </Card>

        {/* Change name */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Display name</h2>
          <div className="space-y-3 max-w-sm">
            <div>
              <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                id="profile-name"
                type="text"
                className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(''); setNameSuccess(false); }}
                maxLength={100}
              />
            </div>
            {nameError && <p className="text-sm text-red-600">{nameError}</p>}
            {nameSuccess && <p className="text-sm text-green-600">Name updated successfully.</p>}
            <Button
              onClick={handleSaveName}
              disabled={nameSaving || name.trim() === (currentUser?.name ?? '')}
            >
              {nameSaving ? 'Saving…' : 'Save name'}
            </Button>
          </div>
        </Card>

        {/* Change password */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Change password</h2>
          <div className="space-y-3 max-w-sm">
            <div>
              <label htmlFor="pw-current" className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
              <input
                id="pw-current"
                type="password"
                className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={currentPassword}
                onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(''); setPasswordSuccess(false); }}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label htmlFor="pw-new" className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                id="pw-new"
                type="password"
                className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); setPasswordSuccess(false); }}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="pw-confirm" className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input
                id="pw-confirm"
                type="password"
                className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Repeat your new password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); setPasswordSuccess(false); }}
                autoComplete="new-password"
              />
            </div>
            {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
            {passwordSuccess && <p className="text-sm text-green-600">Password updated successfully.</p>}
            <Button onClick={handleChangePassword} disabled={passwordSaving}>
              {passwordSaving ? 'Saving…' : 'Update password'}
            </Button>
          </div>
        </Card>

        {/* Delete account */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Delete account</h2>
          <p className="text-sm text-gray-600 mb-4">
            Permanently deletes your account and all your bookings. This cannot be undone.
            You can create a new account at any time.
          </p>

          {!deleteOpen && (
            <Button variant="secondary" onClick={() => setDeleteOpen(true)} className="border-red-300 text-red-600 hover:bg-red-50">
              Delete my account
            </Button>
          )}

          {deleteOpen && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 space-y-3">
              <p className="text-sm font-medium text-red-800">
                Are you sure? This will permanently delete your account and cancel all upcoming bookings.
              </p>
              <div>
                <label htmlFor="delete-password" className="block text-sm font-medium text-red-800 mb-1">
                  Enter your password to confirm
                </label>
                <input
                  id="delete-password"
                  type="password"
                  className="w-full max-w-sm rounded-md border border-red-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="Your current password"
                  value={deletePassword}
                  onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(''); }}
                  autoComplete="current-password"
                />
              </div>
              {deleteError && <p className="text-sm text-red-700">{deleteError}</p>}
              <div className="flex gap-3">
                <Button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                >
                  {deleting ? 'Deleting…' : 'Yes, delete my account'}
                </Button>
                <Button variant="secondary" onClick={() => { setDeleteOpen(false); setDeletePassword(''); setDeleteError(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>

      </div>
    </div>
  );
};
