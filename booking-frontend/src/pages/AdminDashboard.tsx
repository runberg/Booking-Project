import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Notification } from '../components/Notification';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { Users, LogOut, Trash2, Mail } from 'lucide-react';
import { AmenitiesAdmin } from './AmenitiesAdmin';
import { authService, api } from '../services/authService';
import { formatIsoDateToDmy, formatDateTimeDmy } from '../utils/date';

interface User {
  id: string;
  email: string;
  name: string;
  building: string;
  apartmentNumber: string;
  isEmailVerified: boolean;
  role: 'user' | 'admin' | 'super';
  isActive: boolean;
  createdAt: string;
}

interface Building {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    userId: string | null;
    userName: string;
  }>({
    isOpen: false,
    userId: null,
    userName: '',
  });
  const [activeTab, setActiveTab] = useState<'users' | 'buildings' | 'amenities' | 'logs' | 'emails'>('users');

  // Buildings state
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState<boolean>(false);
  const [newBuildingName, setNewBuildingName] = useState<string>('');
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [editingActive, setEditingActive] = useState<boolean>(true);
  // Create Super User modal
  const [createSuperOpen, setCreateSuperOpen] = useState(false);
  const [newSuper, setNewSuper] = useState<{ name: string; email: string; password: string; building: string; apartmentNumber: string }>({ name: '', email: '', password: '', building: '', apartmentNumber: '' });
  // Logs state
  const [logs, setLogs] = useState<Array<{ id: string; action: string; amenityName: string; date: string; startTime: string; slotLength: number; userName: string; building: string; apartmentNumber: string; userEmail: string; createdAt: string }>>([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize] = useState(20);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsSortBy, setLogsSortBy] = useState('createdAt');
  const [logsSortDir, setLogsSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [logsFilters, setLogsFilters] = useState<{ action?: string; userEmail?: string; userName?: string; amenityName?: string; building?: string; apartmentNumber?: string; date?: string; startTime?: string; slotLength?: string; dateFrom?: string; dateTo?: string }>({});

  // Users tab sorting and search
  const [usersSortBy, setUsersSortBy] = useState<'name' | 'email' | 'building' | 'role' | 'isEmailVerified' | 'createdAt'>('createdAt');
  const [usersSortDir, setUsersSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [usersQuery, setUsersQuery] = useState<string>('');

  // Email templates state
  const [emailTemplates, setEmailTemplates] = useState<Array<{ key: string; body: string }>>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const fetchEmailTemplates = async () => {
    try {
      setIsLoadingEmails(true);
      const { data } = await api.get('/admin/email-templates');
      setEmailTemplates(data || []);
    } catch (e: any) {
      setNotification({ type: 'error', message: e.response?.data?.message || 'Failed to load email templates' });
    } finally {
      setIsLoadingEmails(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'buildings') {
      fetchBuildings();
    }
    if (activeTab === 'logs') {
      fetchLogs();
    }
    if (activeTab === 'emails') {
      fetchEmailTemplates();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to fetch users',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      setNotification({
        type: 'success',
        message: 'User deleted successfully',
      });
      fetchUsers();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to delete user',
      });
    }
  };

  const handleDeleteClick = (userId: string, userName: string) => {
    setDeleteConfirmation({
      isOpen: true,
      userId,
      userName,
    });
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmation.userId) {
      await deleteUser(deleteConfirmation.userId);
      setDeleteConfirmation({
        isOpen: false,
        userId: null,
        userName: '',
      });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmation({
      isOpen: false,
      userId: null,
      userName: '',
    });
  };

  const resendVerificationEmail = async (userId: string) => {
    try {
      await api.post(`/admin/users/${userId}/resend-verification`);
      setNotification({
        type: 'success',
        message: 'Verification email sent successfully!',
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to resend verification email',
      });
    }
  };

  // Buildings logic
  const fetchBuildings = async () => {
    try {
      setIsLoadingBuildings(true);
      const { data } = await api.get('/admin/buildings');
      setBuildings(data);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.message || 'Failed to load buildings' });
    } finally {
      setIsLoadingBuildings(false);
    }
  };

  const createBuilding = async () => {
    if (!newBuildingName.trim()) return;
    try {
      const { data } = await api.post('/admin/buildings', { name: newBuildingName.trim() });
      setNotification({ type: 'success', message: 'Building created' });
      setNewBuildingName('');
      setBuildings((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.message || 'Failed to create building' });
    }
  };

  const startEditBuilding = (b: Building) => {
    setEditingBuilding(b);
    setEditingName(b.name);
    setEditingActive(b.isActive);
  };

  const saveBuilding = async () => {
    if (!editingBuilding) return;
    try {
      const { data } = await api.put(`/admin/buildings/${editingBuilding.id}`, { name: editingName.trim(), isActive: editingActive });
      setNotification({ type: 'success', message: 'Building updated' });
      setEditingBuilding(null);
      setBuildings((prev) => prev.map((x) => (x.id === data.id ? data : x)).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.message || 'Failed to update building' });
    }
  };

  const deleteBuilding = async (id: string) => {
    try {
      await api.delete(`/admin/buildings/${id}`);
      setNotification({ type: 'success', message: 'Building deleted' });
      setBuildings((prev) => prev.filter((b) => b.id !== id));
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.message || 'Failed to delete building' });
    }
  };

  // Logs
  const fetchLogs = async (overrides?: Partial<{ page: number; pageSize: number; sortBy: string; sortDir: 'ASC' | 'DESC'; q: string }>) => {
    try {
      const nextPage = overrides?.page ?? logsPage;
      const nextPageSize = overrides?.pageSize ?? logsPageSize;
      const nextSortBy = overrides?.sortBy ?? logsSortBy;
      const nextSortDir = overrides?.sortDir ?? logsSortDir;
      const nextQ = overrides?.q ?? (logsFilters as any).q;
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(nextPageSize),
        sortBy: nextSortBy,
        sortDir: nextSortDir,
      });
      if (nextQ) params.set('q', String(nextQ));
      const res = await fetch(`http://localhost:3000/bookings/logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });
      if (!res.ok) throw new Error('Failed to fetch logs');
      const data = await res.json();
      setLogs(data.items);
      setLogsTotal(data.total);
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message });
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const currentUser = authService.getCurrentUser();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
          autoDismiss={notification.type === 'success'}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        title="Delete User"
        message={`Are you sure you want to delete "${deleteConfirmation.userName}"? This action cannot be undone.`}
        confirmText="Delete User"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        type="danger"
      />

      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary-600" />
              <h1 className="ml-3 text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {currentUser?.name} ({currentUser?.email})
              </span>
              <Button variant="secondary" onClick={() => navigate('/bookings')}>
                Back to Bookings
              </Button>
              <Button variant="secondary" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
              <button
                className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${activeTab === 'users' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                onClick={() => setActiveTab('users')}
              >
                User Administration
              </button>
              <button
                className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${activeTab === 'buildings' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                onClick={() => setActiveTab('buildings')}
              >
                Buildings
              </button>
              <button
                className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${activeTab === 'logs' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                onClick={() => setActiveTab('logs')}
              >
                Logs
              </button>
              <button
                className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${activeTab === 'amenities' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                onClick={() => setActiveTab('amenities')}
              >
                Amenities
              </button>
              <button
                className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${activeTab === 'emails' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                onClick={() => setActiveTab('emails')}
              >
                Emails
              </button>
            </nav>
          </div>

          {activeTab === 'users' && (
            <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">All Users</h2>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">{users.length} users</span>
              {currentUser?.role === 'admin' && (
                <Button variant="secondary" onClick={() => setCreateSuperOpen(true)}>Create Super User</Button>
              )}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center space-x-2">
              <input
                className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                placeholder="Search users by name, email, building, apartment, role..."
                value={usersQuery}
                onChange={(e) => setUsersQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // no-op; filtering is live, but keep behavior consistent with logs
                    setUsersQuery((s) => s.trim());
                  }
                }}
              />
              <Button variant="secondary" onClick={() => setUsersQuery((s) => s.trim())}>Search</Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading users...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => {
                        const key: typeof usersSortBy = 'name';
                        const dir = usersSortBy === key && usersSortDir === 'ASC' ? 'DESC' : 'ASC';
                        setUsersSortBy(key); setUsersSortDir(dir);
                      }}
                    >
                      User
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => {
                        const key: typeof usersSortBy = 'building';
                        const dir = usersSortBy === key && usersSortDir === 'ASC' ? 'DESC' : 'ASC';
                        setUsersSortBy(key); setUsersSortDir(dir);
                      }}
                    >
                      Building
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => {
                        const key: typeof usersSortBy = 'isEmailVerified';
                        const dir = usersSortBy === key && usersSortDir === 'ASC' ? 'DESC' : 'ASC';
                        setUsersSortBy(key); setUsersSortDir(dir);
                      }}
                    >
                      Status
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => {
                        const key: typeof usersSortBy = 'role';
                        const dir = usersSortBy === key && usersSortDir === 'ASC' ? 'DESC' : 'ASC';
                        setUsersSortBy(key); setUsersSortDir(dir);
                      }}
                    >
                      Role
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => {
                        const key: typeof usersSortBy = 'createdAt';
                        const dir = usersSortBy === key && usersSortDir === 'ASC' ? 'DESC' : 'ASC';
                        setUsersSortBy(key); setUsersSortDir(dir);
                      }}
                    >
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users
                    .filter((u) => {
                      const q = usersQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        (u.name || '').toLowerCase().includes(q) ||
                        (u.email || '').toLowerCase().includes(q) ||
                        (u.building || '').toLowerCase().includes(q) ||
                        (u.apartmentNumber || '').toLowerCase().includes(q) ||
                        (u.role || '').toLowerCase().includes(q) ||
                        (u.isEmailVerified ? 'verified' : 'pending').includes(q)
                      );
                    })
                    .sort((a, b) => {
                      const dir = usersSortDir === 'ASC' ? 1 : -1;
                      const val = (key: typeof usersSortBy) => {
                        switch (key) {
                          case 'name': return (a.name || '').localeCompare(b.name || '');
                          case 'email': return (a.email || '').localeCompare(b.email || '');
                          case 'building': {
                            const ab = `${a.building || ''} ${a.apartmentNumber || ''}`;
                            const bb = `${b.building || ''} ${b.apartmentNumber || ''}`;
                            return ab.localeCompare(bb);
                          }
                          case 'role': return (a.role || '').localeCompare(b.role || '');
                          case 'isEmailVerified': return Number(a.isEmailVerified) - Number(b.isEmailVerified);
                          case 'createdAt': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                          default: return 0;
                        }
                      };
                      return dir * val(usersSortBy);
                    })
                    .map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{user.building}</div>
                        <div className="text-sm text-gray-500">Apt {user.apartmentNumber}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.isEmailVerified 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {user.isEmailVerified ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTimeDmy(user.createdAt).split(' ')[0]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {!user.isEmailVerified && (
                            <Button
                              variant="secondary"
                              onClick={() => resendVerificationEmail(user.id)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          )}
                          {user.role !== 'admin' && user.role !== 'super' && (
                             <Button
                               variant="secondary"
                               onClick={() => handleDeleteClick(user.id, user.name)}
                               className="text-red-600 hover:text-red-900"
                             >
                               <Trash2 className="h-4 w-4" />
                             </Button>
                           )}
                          {/* Admin-only role management */}
                          {currentUser?.role === 'admin' && user.role !== 'admin' && (
                            <>
                              {user.role !== 'super' ? (
                                <Button
                                  variant="secondary"
                                  onClick={async () => {
                                    try {
                                      await fetch(`http://localhost:3000/admin/users/${user.id}/role`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
                                        body: JSON.stringify({ role: 'super' }),
                                      });
                                      setNotification({ type: 'success', message: `Promoted ${user.name} to Super` });
                                      fetchUsers();
                                    } catch (e: any) {
                                      setNotification({ type: 'error', message: e.message || 'Failed to change role' });
                                    }
                                  }}
                                >
                                  Make Super
                                </Button>
                              ) : (
                                <Button
                                  variant="secondary"
                                  onClick={async () => {
                                    try {
                                      await fetch(`http://localhost:3000/admin/users/${user.id}/role`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
                                        body: JSON.stringify({ role: 'user' }),
                                      });
                                      setNotification({ type: 'success', message: `Removed Super from ${user.name}` });
                                      fetchUsers();
                                    } catch (e: any) {
                                      setNotification({ type: 'error', message: e.message || 'Failed to change role' });
                                    }
                                  }}
                                >
                                  Remove Super
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
            </div>
          )}

          {activeTab === 'buildings' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Buildings</h2>
                <span className="text-sm text-gray-600">{buildings.length} buildings</span>
              </div>

              
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-3 sm:space-y-0">
                  <input
                    type="text"
                    value={newBuildingName}
                    onChange={(e) => setNewBuildingName(e.target.value)}
                    placeholder="New building name"
                    className="flex-1 rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <Button onClick={createBuilding}>Add Building</Button>
                </div>
              </div>

              
              {isLoadingBuildings ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading buildings...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {buildings.map((b) => (
                        <tr key={b.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {editingBuilding?.id === b.id ? (
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="rounded-md border border-gray-300 py-1 px-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              />
                            ) : (
                              b.name
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {editingBuilding?.id === b.id ? (
                              <input
                                type="checkbox"
                                checked={editingActive}
                                onChange={(e) => setEditingActive(e.target.checked)}
                              />
                            ) : (
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${b.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {b.isActive ? 'Active' : 'Inactive'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            {editingBuilding?.id === b.id ? (
                              <>
                                <Button variant="secondary" onClick={() => setEditingBuilding(null)}>Cancel</Button>
                                <Button onClick={saveBuilding}>Save</Button>
                              </>
                            ) : (
                              <>
                                <Button variant="secondary" onClick={() => startEditBuilding(b)}>Edit</Button>
                                <Button variant="secondary" className="text-red-600 hover:text-red-900" onClick={() => deleteBuilding(b.id)}>Delete</Button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'amenities' && (
            <div>
              <AmenitiesAdmin />
            </div>
          )}

          {activeTab === 'emails' && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Email Templates</h2>
                <p className="text-sm text-gray-600">
                  Customize the messages sent to users. You can use placeholders like
                  <span> {'{{name}}'}, {'{{amenity}}'}, {'{{date}}'}, {'{{time}}'} </span>
                  where applicable.
                </p>
              </div>

              {isLoadingEmails ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading templates...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {['registration', 'booking_confirmation'].map((k) => {
                    const t = emailTemplates.find((x) => x.key === k) || { key: k, body: '' };
                    const title = k === 'registration' ? 'User registration email' : 'Booking confirmation email';
                    return (
                      <Card key={k}>
                        <div className="mb-3">
                          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
                        </div>
                        <textarea
                          className="w-full min-h-[200px] rounded-md border border-gray-300 p-3 text-sm"
                          value={t.body}
                          onChange={(e) => setEmailTemplates((prev) => {
                            const copy = [...prev];
                            const idx = copy.findIndex((x) => x.key === k);
                            if (idx >= 0) copy[idx] = { ...copy[idx], body: e.target.value };
                            else copy.push({ key: k, body: e.target.value });
                            return copy;
                          })}
                        />
                        <div className="mt-3 flex justify-end">
                          <Button
                            onClick={async () => {
                              try {
                                const body = (emailTemplates.find((x) => x.key === k)?.body) ?? '';
                                await api.put(`/admin/email-templates/${k}`, { body });
                                setNotification({ type: 'success', message: 'Template saved' });
                              } catch (e: any) {
                                setNotification({ type: 'error', message: e.response?.data?.message || 'Failed to save template' });
                              }
                            }}
                          >Save</Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Logs</h2>
                <div className="flex items-center space-x-2">
                  <input
                    className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                    placeholder="Search across all log fields..."
                    value={(logsFilters as any).q || ''}
                    onChange={(e) => setLogsFilters((s) => ({ ...(s as any), q: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setLogsPage(1);
                        fetchLogs({ page: 1 });
                      }
                    }}
                  />
                  <Button variant="secondary" onClick={() => { setLogsPage(1); fetchLogs({ page: 1 }); }}>Search</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        { key: 'createdAt', label: 'Time' },
                        { key: 'action', label: 'Action' },
                        { key: 'amenityName', label: 'Amenity' },
                        { key: 'date', label: 'Date' },
                        { key: 'startTime', label: 'Start' },
                        { key: 'slotLength', label: 'Length' },
                        { key: 'userName', label: 'User' },
                        { key: 'userEmail', label: 'Email' },
                        { key: 'building', label: 'Building' },
                        { key: 'apartmentNumber', label: 'Apartment' },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer"
                          onClick={() => {
                            const nextSortBy = col.key as any;
                            const nextSortDir = logsSortBy === nextSortBy && logsSortDir === 'ASC' ? 'DESC' : 'ASC';
                            setLogsSortBy(nextSortBy);
                            setLogsSortDir(nextSortDir);
                            setLogsPage(1);
                            fetchLogs({ sortBy: nextSortBy, sortDir: nextSortDir, page: 1 });
                          }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-2 text-sm text-gray-700">{formatDateTimeDmy(l.createdAt)}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{l.action}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{l.amenityName}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{formatIsoDateToDmy(l.date)}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{l.startTime}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{l.slotLength} min</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{l.userName}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{l.userEmail}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{l.building}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{l.apartmentNumber}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-600">No logs found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">Page {logsPage} of {Math.max(1, Math.ceil(logsTotal / logsPageSize))}</div>
                <div className="space-x-2">
                  <Button variant="secondary" onClick={() => { if (logsPage > 1) { const newPage = logsPage - 1; setLogsPage(newPage); fetchLogs({ page: newPage }); }}}>
                    Prev
                  </Button>
                  <Button variant="secondary" onClick={() => { const maxPage = Math.max(1, Math.ceil(logsTotal / logsPageSize)); if (logsPage < maxPage) { const newPage = logsPage + 1; setLogsPage(newPage); fetchLogs({ page: newPage }); }}}>
                    Next
                  </Button>
                  <Button variant="secondary" onClick={async () => {
                    try {
                      const params = new URLSearchParams();
                      if ((logsFilters as any).q) params.set('q', String((logsFilters as any).q));
                      params.set('sortBy', logsSortBy);
                      params.set('sortDir', logsSortDir);
                      const url = `http://localhost:3000/bookings/logs/export?${params.toString()}`;
                      const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });
                      if (!res.ok) throw new Error('Failed to export CSV');
                      const text = await res.text();
                      const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement('a');
                      const dlUrl = URL.createObjectURL(blob);
                      link.href = dlUrl;
                      link.download = 'booking-logs.csv';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(dlUrl);
                    } catch (e: any) {
                      setNotification({ type: 'error', message: e.message || 'Failed to export CSV' });
                    }
                  }}>
                    Export CSV
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
      {/* Create Super User Modal */}
      {createSuperOpen && (
        <div className="fixed inset-0 z-50">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setCreateSuperOpen(false)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Super User</h3>
              <div className="space-y-3">
                <input className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm" placeholder="Full name" value={newSuper.name} onChange={(e) => setNewSuper({ ...newSuper, name: e.target.value })} />
                <input className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm" placeholder="Email" value={newSuper.email} onChange={(e) => setNewSuper({ ...newSuper, email: e.target.value })} />
                <input className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm" placeholder="Password" type="password" value={newSuper.password} onChange={(e) => setNewSuper({ ...newSuper, password: e.target.value })} />
                <input className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm" placeholder="Building" value={newSuper.building} onChange={(e) => setNewSuper({ ...newSuper, building: e.target.value })} />
                <input className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm" placeholder="Apartment number" value={newSuper.apartmentNumber} onChange={(e) => setNewSuper({ ...newSuper, apartmentNumber: e.target.value })} />
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <Button variant="secondary" onClick={() => setCreateSuperOpen(false)}>Cancel</Button>
                <Button onClick={async () => {
                  try {
                    const res = await fetch('http://localhost:3000/admin/users', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
                      body: JSON.stringify({ ...newSuper, isSuper: true }),
                    });
                    if (!res.ok) throw new Error('Failed to create super user');
                    setNotification({ type: 'success', message: 'Super user created' });
                    setCreateSuperOpen(false);
                    setNewSuper({ name: '', email: '', password: '', building: '', apartmentNumber: '' });
                    fetchUsers();
                  } catch (e: any) {
                    setNotification({ type: 'error', message: e.message || 'Failed to create super user' });
                  }
                }}>Create</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
