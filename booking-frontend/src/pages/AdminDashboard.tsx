import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Notification } from '../components/Notification';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { Users, LogOut, Trash2, Mail, Menu, X, ChevronDown, ChevronUp } from 'lucide-react';
import { AmenitiesAdmin } from './AmenitiesAdmin';
import { RichEmailEditor } from '../components/RichEmailEditor';
import { authService, api, API_BASE_URL } from '../services/authService';
import { formatIsoDateToDmy, formatDateTimeDmy } from '../utils/date';

interface User {
  id: string;
  email: string;
  name: string;
  building: string;
  apartmentNumber: string;
  isEmailVerified: boolean;
  role: 'user' | 'admin' | 'super' | 'security';
  isActive: boolean;
  createdAt: string;
}

interface Building {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

interface SmtpSettings {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_from: string;
  smtp_pass_set: boolean;
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
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
  const [activeTab, setActiveTab] = useState<'users' | 'buildings' | 'amenities' | 'logs' | 'emails' | 'settings'>('users');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Buildings state
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState<boolean>(false);
  const [newBuildingName, setNewBuildingName] = useState<string>('');
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [editingActive, setEditingActive] = useState<boolean>(true);

  // Building units state
  const [expandedBuildingId, setExpandedBuildingId] = useState<string | null>(null);
  const [buildingUnits, setBuildingUnits] = useState<Record<string, string[]>>({});
  const [unitInputs, setUnitInputs] = useState<Record<string, string>>({});
  const [isSavingUnits, setIsSavingUnits] = useState<Record<string, boolean>>({});
  const [isLoadingUnits, setIsLoadingUnits] = useState<Record<string, boolean>>({});

  // SMTP settings state
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>({
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_from: '',
    smtp_pass_set: false,
  });
  const [smtpPass, setSmtpPass] = useState('');
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [createSuperOpen, setCreateSuperOpen] = useState(false);
  const [newSuper, setNewSuper] = useState<{ name: string; email: string; password: string; building: string; apartmentNumber: string }>({ name: '', email: '', password: '', building: '', apartmentNumber: '' });

  const [createSecurityOpen, setCreateSecurityOpen] = useState(false);
  const [newSecurity, setNewSecurity] = useState<{ username: string; password: string }>({ username: '', password: '' });

  // Logs state
  type LogEntry = {
    id: string;
    action: 'create' | 'delete' | 'login' | 'reminder_sent' | 'reminder_failed' | 'checkin_email_sent' | 'checkin_email_failed' | 'checked_in' | 'confirmation_failed' | 'no_show';
    amenityName: string | null;
    date: string | null;
    startTime: string | null;
    slotLength: number | null;
    userName: string;
    building: string;
    apartmentNumber: string;
    userEmail: string;
    ipAddress: string | null;
    createdAt: string;
  };
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize] = useState(25);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsSortBy, setLogsSortBy] = useState('createdAt');
  const [logsSortDir, setLogsSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [logsFilters, setLogsFilters] = useState<{
    action?: string;
    userEmail?: string;
    amenityName?: string;
    dateFrom?: string;
    dateTo?: string;
  }>({});
  const [logsDraftFilters, setLogsDraftFilters] = useState<typeof logsFilters>({});

  // Users tab sorting, search, and role info panel
  const [usersSortBy, setUsersSortBy] = useState<'name' | 'email' | 'building' | 'role' | 'isEmailVerified' | 'createdAt'>('createdAt');
  const [usersSortDir, setUsersSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [usersQuery, setUsersQuery] = useState<string>('');
  const [roleInfoOpen, setRoleInfoOpen] = useState(false);

  // Setup warnings
  const [setupWarnings, setSetupWarnings] = useState<{ smtp: boolean; amenities: boolean }>({ smtp: false, amenities: false });
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());

  // Content tab sub-tab
  const [contentSubTab, setContentSubTab] = useState<'rules' | 'mail'>('rules');
  const editorDomRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Email templates state
  const [emailTemplates, setEmailTemplates] = useState<Array<{ key: string; subject: string | null; body: string }>>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [reminderHoursBefore, setReminderHoursBefore] = useState('24');
  const [checkinMinutesBefore, setCheckinMinutesBefore] = useState('30');

  const fetchEmailTemplates = async () => {
    try {
      setIsLoadingEmails(true);
      const [{ data: templates }, { data: reminder }] = await Promise.all([
        api.get('/admin/email-templates'),
        api.get('/admin/settings/reminder').catch(() => ({ data: { reminder_hours_before: '24' } })),
      ]);
      setEmailTemplates(templates || []);
      setReminderHoursBefore(reminder?.reminder_hours_before ?? '24');
      setCheckinMinutesBefore(reminder?.checkin_minutes_before ?? '30');
    } catch (e: any) {
      setNotification({ type: 'error', message: e.response?.data?.message || 'Failed to load email templates' });
    } finally {
      setIsLoadingEmails(false);
    }
  };

  const fetchSmtpSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const { data } = await api.get('/admin/settings/smtp');
      setSmtpSettings(data);
      setSmtpPass('');
    } catch (e: any) {
      setNotification({ type: 'error', message: e.response?.data?.message || 'Failed to load SMTP settings' });
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const saveSmtpSettings = async () => {
    setIsSavingSettings(true);
    try {
      const payload: Record<string, string> = {
        smtp_host: smtpSettings.smtp_host,
        smtp_port: smtpSettings.smtp_port,
        smtp_user: smtpSettings.smtp_user,
        smtp_from: smtpSettings.smtp_from,
      };
      if (smtpPass) payload.smtp_pass = smtpPass;
      await api.put('/admin/settings/smtp', payload);
      setNotification({ type: 'success', message: 'SMTP settings saved' });
      await fetchSmtpSettings();
      checkSetup();
    } catch (e: any) {
      setNotification({ type: 'error', message: e.response?.data?.message || 'Failed to save SMTP settings' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      const [smtpRes, amenitiesRes] = await Promise.all([
        isAdmin ? api.get('/admin/settings/smtp').catch(() => null) : Promise.resolve(null),
        api.get('/amenities').catch(() => null),
      ]);
      const smtp = smtpRes?.data;
      const smtpMissing = isAdmin && (!smtp?.smtp_host || !smtp?.smtp_pass_set);
      const amenitiesMissing = !amenitiesRes?.data?.length;
      setSetupWarnings({ smtp: smtpMissing, amenities: amenitiesMissing });
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'buildings') fetchBuildings();
    if (activeTab === 'logs') fetchLogs();
    if (activeTab === 'emails') fetchEmailTemplates();
    if (activeTab === 'settings' && isAdmin) fetchSmtpSettings();
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
      setNotification({ type: 'success', message: 'User deleted successfully' });
      fetchUsers();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to delete user',
      });
    }
  };

  const handleDeleteClick = (userId: string, userName: string) => {
    setDeleteConfirmation({ isOpen: true, userId, userName });
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmation.userId) {
      await deleteUser(deleteConfirmation.userId);
      setDeleteConfirmation({ isOpen: false, userId: null, userName: '' });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmation({ isOpen: false, userId: null, userName: '' });
  };

  const resendVerificationEmail = async (userId: string) => {
    if (resendingEmail) return;
    try {
      setResendingEmail(userId);
      await api.post(`/admin/users/${userId}/resend-verification`);
      setNotification({ type: 'success', message: 'Verification email sent successfully!' });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to resend verification email',
      });
    } finally {
      setResendingEmail(null);
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
      if (expandedBuildingId === id) setExpandedBuildingId(null);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.message || 'Failed to delete building' });
    }
  };

  const toggleBuildingUnits = async (buildingId: string) => {
    if (expandedBuildingId === buildingId) {
      setExpandedBuildingId(null);
      return;
    }
    setExpandedBuildingId(buildingId);
    if (buildingUnits[buildingId]) return; // already loaded
    setIsLoadingUnits((s) => ({ ...s, [buildingId]: true }));
    try {
      const { data } = await api.get(`/admin/buildings/${buildingId}/units`);
      const units = (data as Array<{ unitNumber: string }>).map((u) => u.unitNumber);
      setBuildingUnits((s) => ({ ...s, [buildingId]: units }));
      setUnitInputs((s) => ({ ...s, [buildingId]: units.join('\n') }));
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.message || 'Failed to load units' });
    } finally {
      setIsLoadingUnits((s) => ({ ...s, [buildingId]: false }));
    }
  };

  const saveUnits = async (buildingId: string) => {
    const raw = unitInputs[buildingId] || '';
    const units = raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setIsSavingUnits((s) => ({ ...s, [buildingId]: true }));
    try {
      await api.put(`/admin/buildings/${buildingId}/units`, { units });
      setBuildingUnits((s) => ({ ...s, [buildingId]: units }));
      setNotification({ type: 'success', message: 'Units saved' });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.message || 'Failed to save units' });
    } finally {
      setIsSavingUnits((s) => ({ ...s, [buildingId]: false }));
    }
  };

  // Logs
  const fetchLogs = async (overrides?: Partial<{ page: number; sortBy: string; sortDir: 'ASC' | 'DESC'; filters: typeof logsFilters }>) => {
    try {
      const nextPage = overrides?.page ?? logsPage;
      const nextSortBy = overrides?.sortBy ?? logsSortBy;
      const nextSortDir = overrides?.sortDir ?? logsSortDir;
      const nextFilters = overrides?.filters ?? logsFilters;

      // No-shows use a different endpoint
      if (nextFilters.action === 'no_show') {
        const params = new URLSearchParams({ page: String(nextPage), pageSize: String(logsPageSize) });
        const res = await fetch(`${API_BASE_URL}/bookings/logs/no-shows?${params.toString()}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        });
        if (!res.ok) throw new Error('Failed to fetch no-shows');
        const data = await res.json();
        setLogs(data.items);
        setLogsTotal(data.total);
        return;
      }

      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(logsPageSize),
        sortBy: nextSortBy,
        sortDir: nextSortDir,
      });
      if (nextFilters.action) params.set('action', nextFilters.action);
      if (nextFilters.userEmail) params.set('userEmail', nextFilters.userEmail);
      if (nextFilters.amenityName) params.set('amenityName', nextFilters.amenityName);
      if (nextFilters.dateFrom) params.set('dateFrom', nextFilters.dateFrom);
      if (nextFilters.dateTo) params.set('dateTo', nextFilters.dateTo);
      const res = await fetch(`${API_BASE_URL}/bookings/logs?${params.toString()}`, {
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

  const applyLogsFilters = () => {
    setLogsFilters(logsDraftFilters);
    setLogsPage(1);
    fetchLogs({ page: 1, filters: logsDraftFilters });
  };

  const clearLogsFilters = () => {
    setLogsDraftFilters({});
    setLogsFilters({});
    setLogsPage(1);
    fetchLogs({ page: 1, filters: {} });
  };

  const filterByUser = (email: string) => {
    const f = { ...logsDraftFilters, userEmail: email };
    setLogsDraftFilters(f);
    setLogsFilters(f);
    setLogsPage(1);
    fetchLogs({ page: 1, filters: f });
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const isSuper = currentUser?.role === 'super';

  const tabs: Array<{ key: typeof activeTab; label: string }> = [
    { key: 'users', label: 'Users' },
    { key: 'buildings', label: 'Buildings and Units' },
    { key: 'logs', label: 'Logs' },
    { key: 'amenities', label: 'Amenities' },
    { key: 'emails', label: 'Content' },
    ...(isAdmin ? [{ key: 'settings' as typeof activeTab, label: 'Settings' }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
          autoDismiss={notification.type === 'success'}
        />
      )}

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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-6 gap-4">
            <div className="flex items-center">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600" />
              <h1 className="ml-2 sm:ml-3 text-xl sm:text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <span className="text-xs sm:text-sm text-gray-600 truncate">Welcome, {currentUser?.name}</span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => navigate('/bookings')} className="text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-3 flex-1 sm:flex-initial">
                  Back to Bookings
                </Button>
                <Button variant="secondary" onClick={handleLogout} className="text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-3">
                  <LogOut className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          {/* Setup warnings */}
          {[
            {
              key: 'smtp',
              show: setupWarnings.smtp,
              message: 'Email is not configured. Users will not receive verification emails and cannot self-register until SMTP is set up.',
              action: 'Go to Settings',
              tab: 'settings' as typeof activeTab,
            },
            {
              key: 'amenities',
              show: setupWarnings.amenities,
              message: 'No active amenities found. Users will not be able to make any bookings until at least one amenity is added and activated.',
              action: 'Go to Amenities',
              tab: 'amenities' as typeof activeTab,
            },
          ]
            .filter((w) => w.show && !dismissedWarnings.has(w.key))
            .map((w) => (
              <div key={w.key} className="flex items-start justify-between gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 mb-4 text-sm text-amber-900">
                <span>{w.message}</span>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    className="font-medium underline hover:no-underline whitespace-nowrap"
                    onClick={() => { setActiveTab(w.tab); setMobileMenuOpen(false); }}
                  >
                    {w.action}
                  </button>
                  <button
                    className="text-amber-600 hover:text-amber-900"
                    onClick={() => setDismissedWarnings((s) => new Set([...s, w.key]))}
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200">
            {/* Mobile burger menu */}
            <div className="sm:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex items-center justify-between w-full py-3 px-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <span>{tabs.find((t) => t.key === activeTab)?.label ?? activeTab}</span>
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              {mobileMenuOpen && (
                <div className="border-t border-gray-200 py-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      className={`w-full text-left py-2 px-4 text-sm font-medium ${
                        activeTab === tab.key
                          ? 'bg-primary-50 text-primary-600 border-l-4 border-primary-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => { setActiveTab(tab.key); setMobileMenuOpen(false); }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Desktop tabs */}
            <nav className="hidden sm:flex -mb-px space-x-4 sm:space-x-6 flex-wrap" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 text-xs sm:text-sm font-medium ${
                    activeTab === tab.key
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Users tab */}
          {activeTab === 'users' && (
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">All Users</h2>
                <div className="flex items-center space-x-3">
                  <span className="text-xs sm:text-sm text-gray-600">{users.length} users</span>
                  {isAdmin && (
                    <Button variant="secondary" onClick={() => setCreateSuperOpen(true)} className="text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-3">Create Super User</Button>
                  )}
                  {(isAdmin || isSuper) && (
                    <Button variant="secondary" onClick={() => setCreateSecurityOpen(true)} className="text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-3">Create Security User</Button>
                  )}
                </div>
              </div>

              {/* Role reference */}
              <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors"
                  onClick={() => setRoleInfoOpen((s) => !s)}
                >
                  <span>User roles</span>
                  <span className="text-gray-400 text-xs">{roleInfoOpen ? '▲ hide' : '▼ show'}</span>
                </button>
                {roleInfoOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 border-t border-gray-200">
                    {[
                      {
                        badge: 'bg-blue-100 text-blue-800',
                        label: 'User',
                        description: 'Regular resident. Can create and cancel their own bookings within the configured restrictions.',
                      },
                      {
                        badge: 'bg-indigo-100 text-indigo-800',
                        label: 'Super',
                        description: 'Trusted staff. Full read and manage access — buildings, amenities, logs, settings — but cannot create or promote user accounts.',
                      },
                      {
                        badge: 'bg-purple-100 text-purple-800',
                        label: 'Admin',
                        description: 'Full access. Can create and manage all user accounts, assign roles, and configure every part of the system.',
                      },
                      {
                        badge: 'bg-orange-100 text-orange-800',
                        label: 'Security',
                        description: 'Read-only view of the security dashboard. Can see the current and next booking for every amenity with full resident details. Cannot make bookings.',
                      },
                    ].map(({ badge, label, description }) => (
                      <div key={label} className="px-4 py-3 space-y-1.5">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${badge}`}>{label}</span>
                        <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    className="w-full rounded-md border border-gray-300 py-2 px-3 text-xs sm:text-sm"
                    placeholder="Search users..."
                    value={usersQuery}
                    onChange={(e) => setUsersQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setUsersQuery((s) => s.trim()); }}
                  />
                  <Button variant="secondary" onClick={() => setUsersQuery((s) => s.trim())} className="text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-3 w-full sm:w-auto">Search</Button>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading users...</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 sm:mx-0">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => { const key = 'name'; const dir = usersSortBy === key && usersSortDir === 'ASC' ? 'DESC' : 'ASC'; setUsersSortBy(key); setUsersSortDir(dir); }}>User</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hidden sm:table-cell" onClick={() => { const key = 'building'; const dir = usersSortBy === key && usersSortDir === 'ASC' ? 'DESC' : 'ASC'; setUsersSortBy(key); setUsersSortDir(dir); }}>Building</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => { const key = 'isEmailVerified'; const dir = usersSortBy === key && usersSortDir === 'ASC' ? 'DESC' : 'ASC'; setUsersSortBy(key); setUsersSortDir(dir); }}>Status</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hidden md:table-cell" onClick={() => { const key = 'role'; const dir = usersSortBy === key && usersSortDir === 'ASC' ? 'DESC' : 'ASC'; setUsersSortBy(key); setUsersSortDir(dir); }}>Role</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hidden sm:table-cell" onClick={() => { const key = 'createdAt'; const dir = usersSortBy === key && usersSortDir === 'ASC' ? 'DESC' : 'ASC'; setUsersSortBy(key); setUsersSortDir(dir); }}>Created</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
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
                              case 'building': return `${a.building || ''} ${a.apartmentNumber || ''}`.localeCompare(`${b.building || ''} ${b.apartmentNumber || ''}`);
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
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              <div className="text-xs sm:text-sm font-medium text-gray-900">{user.name}</div>
                              {user.role !== 'security' && <div className="text-xs sm:text-sm text-gray-500">{user.email}</div>}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                              {user.role === 'security' ? (
                                <div className="text-xs sm:text-sm text-gray-400">—</div>
                              ) : (
                                <>
                                  <div className="text-xs sm:text-sm text-gray-900">{user.building}</div>
                                  <div className="text-xs sm:text-sm text-gray-500">Apt {user.apartmentNumber}</div>
                                </>
                              )}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.isEmailVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {user.isEmailVerified ? 'Verified' : 'Pending'}
                              </span>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : user.role === 'super' ? 'bg-indigo-100 text-indigo-800' : user.role === 'security' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 hidden sm:table-cell">
                              {formatDateTimeDmy(user.createdAt).split(' ')[0]}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                              <div className="flex space-x-1 sm:space-x-2">
                                {!user.isEmailVerified && (
                                  <Button variant="secondary" onClick={() => resendVerificationEmail(user.id)} disabled={resendingEmail === user.id} title="Resend verification email" className="text-blue-600 hover:text-blue-900 p-1 sm:p-2">
                                    <Mail className={`h-3 w-3 sm:h-4 sm:w-4 ${resendingEmail === user.id ? 'animate-pulse' : ''}`} />
                                  </Button>
                                )}
                                {user.role !== 'admin' && user.role !== 'super' && user.role !== 'security' && (
                                  <Button variant="secondary" onClick={() => handleDeleteClick(user.id, user.name)} title="Delete user" className="text-red-600 hover:text-red-900 p-1 sm:p-2">
                                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                  </Button>
                                )}
                                {currentUser?.role === 'admin' && user.role !== 'admin' && (
                                  user.role === 'super' ? (
                                    <Button variant="secondary" onClick={async () => {
                                      try {
                                        await api.post(`/admin/users/${user.id}/role`, { role: 'user' });
                                        setNotification({ type: 'success', message: `Removed Super from ${user.name}` });
                                        fetchUsers();
                                      } catch (e: any) {
                                        setNotification({ type: 'error', message: e.response?.data?.message || 'Failed to change role' });
                                      }
                                    }}>Remove Super</Button>
                                  ) : user.role === 'security' ? (
                                    <Button variant="secondary" onClick={async () => {
                                      try {
                                        await api.post(`/admin/users/${user.id}/role`, { role: 'user' });
                                        setNotification({ type: 'success', message: `Removed Security from ${user.name}` });
                                        fetchUsers();
                                      } catch (e: any) {
                                        setNotification({ type: 'error', message: e.response?.data?.message || 'Failed to change role' });
                                      }
                                    }}>Remove Security</Button>
                                  ) : (
                                    <Button variant="secondary" onClick={async () => {
                                      try {
                                        await api.post(`/admin/users/${user.id}/role`, { role: 'super' });
                                        setNotification({ type: 'success', message: `Promoted ${user.name} to Super` });
                                        fetchUsers();
                                      } catch (e: any) {
                                        setNotification({ type: 'error', message: e.response?.data?.message || 'Failed to change role' });
                                      }
                                    }}>Make Super</Button>
                                  )
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

          {/* Buildings and Units tab */}
          {activeTab === 'buildings' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Buildings and Units</h2>
                <span className="text-sm text-gray-600">{buildings.length} buildings</span>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-3 sm:space-y-0">
                  <input
                    type="text"
                    value={newBuildingName}
                    onChange={(e) => setNewBuildingName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') createBuilding(); }}
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
              ) : buildings.length === 0 ? (
                <p className="text-sm text-gray-600">No buildings yet. Add one above.</p>
              ) : (
                <div className="space-y-3">
                  {buildings.map((b) => (
                    <div key={b.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Building header row */}
                      <div className="flex flex-wrap items-center gap-3 p-4">
                        {editingBuilding?.id === b.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="flex-1 min-w-0 rounded-md border border-gray-300 py-1 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        ) : (
                          <span className="font-medium text-gray-900 flex-1 min-w-0">{b.name}</span>
                        )}

                        {editingBuilding?.id === b.id ? (
                          <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editingActive}
                              onChange={(e) => setEditingActive(e.target.checked)}
                              className="rounded"
                            />
                            Active
                          </label>
                        ) : (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${b.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {b.isActive ? 'Active' : 'Inactive'}
                          </span>
                        )}

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {editingBuilding?.id === b.id ? (
                            <>
                              <Button variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setEditingBuilding(null)}>Cancel</Button>
                              <Button className="text-xs px-3 py-1.5" onClick={saveBuilding}>Save</Button>
                            </>
                          ) : (
                            <>
                              <Button variant="secondary" className="text-xs px-3 py-1.5" onClick={() => startEditBuilding(b)}>Edit</Button>
                              <Button variant="secondary" className="text-xs px-3 py-1.5 text-red-600 hover:text-red-900" onClick={() => deleteBuilding(b.id)}>Delete</Button>
                            </>
                          )}
                          <button
                            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium px-2 py-1.5 rounded border border-primary-200 hover:border-primary-400 transition-colors"
                            onClick={() => toggleBuildingUnits(b.id)}
                          >
                            Units
                            {expandedBuildingId === b.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded units section */}
                      {expandedBuildingId === b.id && (
                        <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-3">
                          {isLoadingUnits[b.id] ? (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                              Loading units...
                            </div>
                          ) : (
                            <>
                              {buildingUnits[b.id]?.length > 0 ? (
                                <div>
                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Current units ({buildingUnits[b.id].length})</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {buildingUnits[b.id].sort().map((u) => (
                                      <span key={u} className="inline-flex px-2 py-0.5 text-xs bg-white border border-gray-300 rounded text-gray-700">{u}</span>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">No units added yet. This building cannot be activated until units are added.</p>
                              )}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Replace units — paste numbers separated by newlines or commas
                                </label>
                                <textarea
                                  className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[100px] font-mono"
                                  placeholder={'101\n102\n103\n201\n202'}
                                  value={unitInputs[b.id] ?? ''}
                                  onChange={(e) => setUnitInputs((s) => ({ ...s, [b.id]: e.target.value }))}
                                />
                              </div>
                              <div className="flex justify-end">
                                <Button
                                  className="text-sm"
                                  disabled={isSavingUnits[b.id]}
                                  onClick={() => saveUnits(b.id)}
                                >
                                  {isSavingUnits[b.id] ? 'Saving...' : 'Save Units'}
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Amenities tab */}
          {activeTab === 'amenities' && (
            <div>
              <AmenitiesAdmin />
            </div>
          )}

          {/* Content tab */}
          {activeTab === 'emails' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Content Management</h2>
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-1 mb-6 border-b border-gray-200">
                {([
                  { key: 'rules', label: 'Rules & Regulations' },
                  { key: 'mail', label: 'Mail Content' },
                ] as const).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setContentSubTab(t.key)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                      contentSubTab === t.key
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {isLoadingEmails ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading templates...</p>
                </div>
              ) : contentSubTab === 'rules' ? (
                <Card>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-1">Rules and Regulations</h3>
                    <p className="text-sm text-gray-600">Legal texts shown to users during registration and booking. Plain text only.</p>
                  </div>
                  <div className="space-y-6">
                    {[
                      {
                        key: 'registration_legal_text',
                        title: 'Registration Legal Text',
                        description: 'Shown above the "Create account" button on the registration page.',
                        defaultBody: 'Legal note - Account creation',
                      },
                      {
                        key: 'booking_legal_text',
                        title: 'Booking Confirmation Legal Text',
                        description: 'Shown above the "Confirm booking" button when confirming a booking.',
                        defaultBody: 'Legal note - Booking confirmation',
                      },
                      {
                        key: 'cancel_page_confirm_text',
                        title: 'Cancellation page — confirmation text',
                        description: 'Shown on the cancel booking page before the user confirms cancellation.',
                        defaultBody: 'Are you sure you want to cancel this booking? This will free the slot for other residents.',
                      },
                      {
                        key: 'cancel_page_success_text',
                        title: 'Cancellation page — success message',
                        description: 'Shown after a booking has been successfully cancelled.',
                        defaultBody: 'Your booking has been cancelled and the slot is now available for others.',
                      },
                      {
                        key: 'checkin_page_instructions',
                        title: 'Check-in page — instructions',
                        description: 'Shown on the check-in page before the user scans the QR code.',
                        defaultBody: 'Point your camera at the QR code posted at the amenity to confirm your attendance.',
                      },
                      {
                        key: 'checkin_success_text',
                        title: 'Check-in page — success message',
                        description: 'Shown after a successful QR scan.',
                        defaultBody: 'You have successfully checked in. Enjoy your booking!',
                      },
                      {
                        key: 'checkin_mismatch_text',
                        title: 'Check-in page — mismatch message',
                        description: 'Shown when the scanned QR code does not match the booked amenity.',
                        defaultBody: 'The QR code does not match your booked amenity. Please make sure you are at the correct location.',
                      },
                    ].map(({ key, title, description, defaultBody }) => (
                      <div key={key}>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">{title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{description}</p>
                        <textarea
                          className="w-full min-h-[100px] rounded-md border border-gray-300 p-3 text-sm font-mono"
                          value={emailTemplates.find((x) => x.key === key)?.body || defaultBody}
                          onChange={(e) => setEmailTemplates((prev) => {
                            const copy = [...prev];
                            const idx = copy.findIndex((x) => x.key === key);
                            if (idx >= 0) copy[idx] = { ...copy[idx], body: e.target.value };
                            else copy.push({ key, body: e.target.value });
                            return copy;
                          })}
                        />
                        <div className="mt-2 flex justify-end">
                          <Button onClick={async () => {
                            try {
                              const body = emailTemplates.find((x) => x.key === key)?.body ?? defaultBody;
                              await api.put(`/admin/email-templates/${key}`, { body });
                              setNotification({ type: 'success', message: 'Legal text saved' });
                            } catch (e: any) {
                              setNotification({ type: 'error', message: e.response?.data?.message || 'Failed to save' });
                            }
                          }}>Save</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : (
                <div className="space-y-6">
                  {[
                    {
                      key: 'registration',
                      title: 'Registration email',
                      description: 'Sent to users after they register to verify their email address.',
                      variables: [
                        { tag: '{{name}}', desc: 'Full name of the user' },
                        { tag: '{{verificationUrl}}', desc: 'Email verification link' },
                      ],
                    },
                    {
                      key: 'booking_confirmation',
                      title: 'Booking confirmation email',
                      description: 'Sent to users after they successfully confirm a booking.',
                      variables: [
                        { tag: '{{name}}', desc: 'Full name of the user' },
                        { tag: '{{amenity}}', desc: 'Name of the booked amenity' },
                        { tag: '{{date}}', desc: 'Booking date' },
                        { tag: '{{time}}', desc: 'Booking start time' },
                      ],
                    },
                    {
                      key: 'booking_reminder',
                      title: 'Booking reminder email',
                      description: 'Sent automatically before an upcoming booking. Includes a one-click cancel link.',
                      variables: [
                        { tag: '{{name}}', desc: 'Full name of the user' },
                        { tag: '{{amenity}}', desc: 'Name of the booked amenity' },
                        { tag: '{{date}}', desc: 'Booking date' },
                        { tag: '{{time}}', desc: 'Booking start time' },
                        { tag: '{{cancelUrl}}', desc: 'One-click cancel link (no login required)' },
                      ],
                    },
                    {
                      key: 'booking_checkin',
                      title: 'Check-in email',
                      description: 'Sent shortly before the booking starts. Includes a link to open the QR scanner.',
                      variables: [
                        { tag: '{{name}}', desc: 'Full name of the user' },
                        { tag: '{{amenity}}', desc: 'Name of the booked amenity' },
                        { tag: '{{date}}', desc: 'Booking date' },
                        { tag: '{{time}}', desc: 'Booking start time' },
                        { tag: '{{checkinUrl}}', desc: 'Link to open the QR check-in page' },
                      ],
                    },
                  ].map(({ key, title, description, variables }) => {
                    const tpl = emailTemplates.find((x) => x.key === key);
                    const subject = tpl?.subject ?? '';
                    const setSubject = (val: string) => setEmailTemplates((prev) => {
                      const copy = [...prev];
                      const idx = copy.findIndex((x) => x.key === key);
                      if (idx >= 0) copy[idx] = { ...copy[idx], subject: val };
                      else copy.push({ key, subject: val, body: '' });
                      return copy;
                    });

                    return (
                      <Card key={key}>
                        <h3 className="text-base font-medium text-gray-900 mb-1">{title}</h3>
                        <p className="text-sm text-gray-600 mb-4">{description}</p>

                        {/* Timing controls */}
                        {key === 'booking_reminder' && (
                          <div className="mb-4 flex flex-wrap items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                            <label className="text-sm font-medium text-amber-900 whitespace-nowrap">Send</label>
                            <input type="number" min={1} max={168} className="w-16 rounded-md border border-amber-300 py-1.5 px-2 text-sm text-center" value={reminderHoursBefore} onChange={(e) => setReminderHoursBefore(e.target.value)} />
                            <span className="text-sm text-amber-900">hours before the booking</span>
                            <button className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900 underline whitespace-nowrap" onClick={async () => {
                              try { await api.put('/admin/settings/reminder', { reminder_hours_before: reminderHoursBefore }); setNotification({ type: 'success', message: 'Timing saved' }); }
                              catch (e: any) { setNotification({ type: 'error', message: e.response?.data?.message || 'Failed to save' }); }
                            }}>Save</button>
                          </div>
                        )}
                        {key === 'booking_checkin' && (
                          <div className="mb-4 flex flex-wrap items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                            <label className="text-sm font-medium text-amber-900 whitespace-nowrap">Send</label>
                            <input type="number" min={0} max={120} className="w-16 rounded-md border border-amber-300 py-1.5 px-2 text-sm text-center" value={checkinMinutesBefore} onChange={(e) => setCheckinMinutesBefore(e.target.value)} />
                            <span className="text-sm text-amber-900">minutes before the booking</span>
                            <button className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900 underline whitespace-nowrap" onClick={async () => {
                              try { await api.put('/admin/settings/reminder', { checkin_minutes_before: checkinMinutesBefore }); setNotification({ type: 'success', message: 'Timing saved' }); }
                              catch (e: any) { setNotification({ type: 'error', message: e.response?.data?.message || 'Failed to save' }); }
                            }}>Save</button>
                            <p className="w-full text-xs text-amber-700 mt-1">Note: exact send time depends on the scheduler interval (default every 10 min).</p>
                          </div>
                        )}

                        {/* Subject line */}
                        <div className="mb-4">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Subject line</label>
                          <input
                            type="text"
                            className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                            placeholder="Email subject…"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                          />
                          <p className="mt-1 text-xs text-gray-400">Variables like {'{{amenity}}'} are also supported in the subject.</p>
                        </div>

                        {/* WYSIWYG editor */}
                        <RichEmailEditor
                          initialValue={tpl?.body ?? ''}
                          variables={variables.map(v => ({ tag: v.tag, label: v.desc.split(' ').slice(0, 2).join(' ') }))}
                          showCancelButton={key === 'booking_reminder'}
                          onMount={(el) => { editorDomRefs.current[key] = el; }}
                        />

                        <div className="mt-3 flex justify-end">
                          <Button onClick={async () => {
                            try {
                              const body = editorDomRefs.current[key]?.innerHTML ?? '';
                              await api.put(`/admin/email-templates/${key}`, { body, subject });
                              setNotification({ type: 'success', message: 'Template saved' });
                            } catch (e: any) {
                              setNotification({ type: 'error', message: e.response?.data?.message || 'Failed to save template' });
                            }
                          }}>Save</Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Settings tab */}
          {activeTab === 'settings' && isAdmin && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
              </div>

              {isLoadingSettings ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading settings...</p>
                </div>
              ) : (
                <Card>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">SMTP / Email</h3>
                  <p className="text-sm text-gray-600 mb-6">Configure the outgoing mail server. Leave the password blank to keep the current password.</p>
                  <div className="space-y-4 max-w-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="smtp.gmail.com"
                        value={smtpSettings.smtp_host}
                        onChange={(e) => setSmtpSettings((s) => ({ ...s, smtp_host: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                      <input
                        type="number"
                        className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="587"
                        value={smtpSettings.smtp_port}
                        onChange={(e) => setSmtpSettings((s) => ({ ...s, smtp_port: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Username</label>
                      <input
                        type="text"
                        className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="user@example.com"
                        value={smtpSettings.smtp_user}
                        onChange={(e) => setSmtpSettings((s) => ({ ...s, smtp_user: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Password</label>
                      <input
                        type="password"
                        className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder={smtpSettings.smtp_pass_set ? '••••••••  (password set — enter new to change)' : 'Enter password'}
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">From Address</label>
                      <input
                        type="email"
                        className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="noreply@example.com"
                        value={smtpSettings.smtp_from}
                        onChange={(e) => setSmtpSettings((s) => ({ ...s, smtp_from: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2 gap-3 flex-wrap">
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          try {
                            const { data } = await api.post('/admin/settings/smtp/test');
                            if (data.ok) {
                              setNotification({ type: 'success', message: 'Test email sent successfully to your account.' });
                            } else {
                              setNotification({ type: 'error', message: `SMTP error: ${data.error || 'Unknown error'}` });
                            }
                          } catch (e: any) {
                            setNotification({ type: 'error', message: e.response?.data?.message || 'Test failed' });
                          }
                        }}
                      >
                        Send test email
                      </Button>
                      <Button onClick={saveSmtpSettings} disabled={isSavingSettings}>
                        {isSavingSettings ? 'Saving...' : 'Save Settings'}
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Logs tab */}
          {activeTab === 'logs' && (
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Activity Logs</h2>

                {/* Filter bar */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Event type</label>
                      <select
                        className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm bg-white"
                        value={logsDraftFilters.action || ''}
                        onChange={(e) => setLogsDraftFilters((s) => ({ ...s, action: e.target.value || undefined }))}
                      >
                        <option value="">All events</option>
                        <option value="login">Login</option>
                        <option value="create">Booking created</option>
                        <option value="delete">Booking cancelled</option>
                        <option value="reminder_sent">Reminder sent</option>
                        <option value="reminder_failed">Reminder failed</option>
                        <option value="checkin_email_sent">Check-in email sent</option>
                        <option value="checkin_email_failed">Check-in email failed</option>
                        <option value="confirmation_failed">Confirmation email failed</option>
                        <option value="checked_in">Checked in</option>
                        <option value="no_show">No-shows (missed check-in)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">User (email)</label>
                      <input
                        className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                        placeholder="Filter by email..."
                        value={logsDraftFilters.userEmail || ''}
                        onChange={(e) => setLogsDraftFilters((s) => ({ ...s, userEmail: e.target.value || undefined }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyLogsFilters(); }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Amenity</label>
                      <input
                        className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                        placeholder="Filter by amenity..."
                        value={logsDraftFilters.amenityName || ''}
                        onChange={(e) => setLogsDraftFilters((s) => ({ ...s, amenityName: e.target.value || undefined }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyLogsFilters(); }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                        <input
                          type="date"
                          className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                          value={logsDraftFilters.dateFrom || ''}
                          onChange={(e) => setLogsDraftFilters((s) => ({ ...s, dateFrom: e.target.value || undefined }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                        <input
                          type="date"
                          className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                          value={logsDraftFilters.dateTo || ''}
                          onChange={(e) => setLogsDraftFilters((s) => ({ ...s, dateTo: e.target.value || undefined }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" onClick={clearLogsFilters}>Clear</Button>
                    <Button onClick={applyLogsFilters}>Apply filters</Button>
                  </div>
                </div>

                {/* Active filter pills */}
                {Object.values(logsFilters).some(Boolean) && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {logsFilters.action && (
                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        Type: {logsFilters.action}
                        <button onClick={() => { const f = { ...logsFilters, action: undefined }; setLogsFilters(f); setLogsDraftFilters(f); fetchLogs({ page: 1, filters: f }); }} className="ml-1 hover:text-blue-600"><X className="h-3 w-3" /></button>
                      </span>
                    )}
                    {logsFilters.userEmail && (
                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        User: {logsFilters.userEmail}
                        <button onClick={() => { const f = { ...logsFilters, userEmail: undefined }; setLogsFilters(f); setLogsDraftFilters(f); fetchLogs({ page: 1, filters: f }); }} className="ml-1 hover:text-blue-600"><X className="h-3 w-3" /></button>
                      </span>
                    )}
                    {logsFilters.amenityName && (
                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        Amenity: {logsFilters.amenityName}
                        <button onClick={() => { const f = { ...logsFilters, amenityName: undefined }; setLogsFilters(f); setLogsDraftFilters(f); fetchLogs({ page: 1, filters: f }); }} className="ml-1 hover:text-blue-600"><X className="h-3 w-3" /></button>
                      </span>
                    )}
                    {(logsFilters.dateFrom || logsFilters.dateTo) && (
                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                        Date: {logsFilters.dateFrom || '…'} – {logsFilters.dateTo || '…'}
                        <button onClick={() => { const f = { ...logsFilters, dateFrom: undefined, dateTo: undefined }; setLogsFilters(f); setLogsDraftFilters(f); fetchLogs({ page: 1, filters: f }); }} className="ml-1 hover:text-blue-600"><X className="h-3 w-3" /></button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        { key: 'createdAt', label: 'Time' },
                        { key: 'action', label: 'Event' },
                        { key: 'userName', label: 'User' },
                        { key: null, label: 'IP address' },
                        { key: 'amenityName', label: 'Amenity' },
                        { key: 'date', label: 'Booking date' },
                        { key: 'startTime', label: 'Slot' },
                      ].map((col) => (
                        <th
                          key={col.key ?? col.label}
                          className={`px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide ${col.key ? 'cursor-pointer hover:text-gray-700' : ''}`}
                          onClick={() => {
                            if (!col.key) return;
                            const nextSortDir = logsSortBy === col.key && logsSortDir === 'ASC' ? 'DESC' : 'ASC';
                            setLogsSortBy(col.key);
                            setLogsSortDir(nextSortDir);
                            setLogsPage(1);
                            fetchLogs({ sortBy: col.key, sortDir: nextSortDir, page: 1 });
                          }}
                        >
                          {col.label}
                          {col.key && logsSortBy === col.key && (
                            <span className="ml-1">{logsSortDir === 'ASC' ? '↑' : '↓'}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {logs.map((l) => {
                      const isLogin = l.action === 'login';
                      const isCreate = l.action === 'create';
                      const isDelete = l.action === 'delete';
                      return (
                        <tr key={l.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{formatDateTimeDmy(l.createdAt)}</td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {isLogin && <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">Login</span>}
                            {isCreate && <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">Booked</span>}
                            {isDelete && <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">Cancelled</span>}
                            {l.action === 'reminder_sent' && <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">Reminder sent</span>}
                            {l.action === 'reminder_failed' && <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">Reminder failed</span>}
                            {l.action === 'checkin_email_sent' && <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-cyan-100 text-cyan-800">Check-in email</span>}
                            {l.action === 'checkin_email_failed' && <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">Check-in email failed</span>}
                            {l.action === 'confirmation_failed' && <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">Confirmation failed</span>}
                            {l.action === 'checked_in' && <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-teal-100 text-teal-800">Checked in</span>}
                            {l.action === 'no_show' && <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">No-show</span>}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <button
                              className="text-left hover:underline text-gray-900 font-medium"
                              title={`Filter by ${l.userEmail}`}
                              onClick={() => filterByUser(l.userEmail)}
                            >
                              {l.userName}
                            </button>
                            <div className="text-xs text-gray-500">{l.building}{l.apartmentNumber ? ` / ${l.apartmentNumber}` : ''}</div>
                          </td>
                          <td className="px-4 py-2 text-gray-500 whitespace-nowrap font-mono text-xs">{l.ipAddress || '—'}</td>
                          <td className="px-4 py-2 text-gray-700">{l.amenityName || '—'}</td>
                          <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{l.date ? formatIsoDateToDmy(l.date) : '—'}</td>
                          <td className="px-4 py-2 text-gray-700 whitespace-nowrap">{l.startTime ? `${l.startTime} (${l.slotLength} min)` : '—'}</td>
                        </tr>
                      );
                    })}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No log entries found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    {logsTotal} {logsTotal === 1 ? 'entry' : 'entries'} — page {logsPage} of {Math.max(1, Math.ceil(logsTotal / logsPageSize))}
                  </span>
                  <div className="flex space-x-2">
                    <Button variant="secondary" onClick={() => { if (logsPage > 1) { const p = logsPage - 1; setLogsPage(p); fetchLogs({ page: p }); }}}>Prev</Button>
                    <Button variant="secondary" onClick={() => { const max = Math.max(1, Math.ceil(logsTotal / logsPageSize)); if (logsPage < max) { const p = logsPage + 1; setLogsPage(p); fetchLogs({ page: p }); }}}>Next</Button>
                  </div>
                </div>
                <Button variant="secondary" onClick={async () => {
                  try {
                    const params = new URLSearchParams({ sortBy: logsSortBy, sortDir: logsSortDir });
                    if (logsFilters.action) params.set('action', logsFilters.action);
                    if (logsFilters.userEmail) params.set('userEmail', logsFilters.userEmail);
                    if (logsFilters.amenityName) params.set('amenityName', logsFilters.amenityName);
                    if (logsFilters.dateFrom) params.set('dateFrom', logsFilters.dateFrom);
                    if (logsFilters.dateTo) params.set('dateTo', logsFilters.dateTo);
                    const res = await fetch(`${API_BASE_URL}/bookings/logs/export?${params.toString()}`, {
                      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
                    });
                    if (!res.ok) throw new Error('Failed to export CSV');
                    const text = await res.text();
                    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    const dlUrl = URL.createObjectURL(blob);
                    link.href = dlUrl;
                    link.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
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
          )}
        </Card>
      </div>

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
                    await api.post('/admin/users', { ...newSuper, isSuper: true });
                    setNotification({ type: 'success', message: 'Super user created' });
                    setCreateSuperOpen(false);
                    setNewSuper({ name: '', email: '', password: '', building: '', apartmentNumber: '' });
                    fetchUsers();
                  } catch (e: any) {
                    setNotification({ type: 'error', message: e.response?.data?.message || 'Failed to create super user' });
                  }
                }}>Create</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {createSecurityOpen && (
        <div className="fixed inset-0 z-50">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setCreateSecurityOpen(false)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Create Security User</h3>
              <p className="text-sm text-gray-500 mb-4">Security users log in with their username and password. They have read-only access to the security dashboard.</p>
              <div className="space-y-3">
                <input className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm" placeholder="Username" value={newSecurity.username} onChange={(e) => setNewSecurity({ ...newSecurity, username: e.target.value })} />
                <input className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm" placeholder="Password" type="password" value={newSecurity.password} onChange={(e) => setNewSecurity({ ...newSecurity, password: e.target.value })} />
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <Button variant="secondary" onClick={() => setCreateSecurityOpen(false)}>Cancel</Button>
                <Button onClick={async () => {
                  try {
                    await api.post('/admin/users', { ...newSecurity, isSecurity: true });
                    setNotification({ type: 'success', message: 'Security user created' });
                    setCreateSecurityOpen(false);
                    setNewSecurity({ username: '', password: '' });
                    fetchUsers();
                  } catch (e: any) {
                    setNotification({ type: 'error', message: e.response?.data?.message || 'Failed to create security user' });
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
