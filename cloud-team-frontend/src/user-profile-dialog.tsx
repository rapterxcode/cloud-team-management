import { useState, useEffect } from 'react';
import { User, Lock, History, Shield, Check, AlertCircle, Laptop, Smartphone, Globe } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { api, patch, post } from '@/lib/api';
import type { Me, AccessLogItem } from '@/lib/types';

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: Me;
  onUserUpdated: (user: Me) => void;
}

export default function UserProfileDialog({
  open,
  onOpenChange,
  currentUser,
  onUserUpdated,
}: UserProfileDialogProps) {
  const [tab, setTab] = useState<'profile' | 'security' | 'activity'>('profile');

  // Profile form state
  const [name, setName] = useState(currentUser.name);
  const [title, setTitle] = useState(currentUser.title || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Activity state
  const [recentLogins, setRecentLogins] = useState<AccessLogItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  useEffect(() => {
    if (open) {
      setName(currentUser.name);
      setTitle(currentUser.title || '');
      setProfileNotice('');
      setProfileError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordNotice('');
      setPasswordError('');

      // Fetch recent logins
      setLoadingActivity(true);
      api<AccessLogItem[]>('/auth/recent-logins')
        .then((logs) => setRecentLogins(logs))
        .catch(() => setRecentLogins([]))
        .finally(() => setLoadingActivity(false));
    }
  }, [open, currentUser]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileNotice('');
    setProfileError('');
    try {
      const updated = await patch<Me>('/auth/profile', {
        name: name.trim(),
        title: title.trim(),
      });
      onUserUpdated({ ...currentUser, ...updated });
      setProfileNotice('Profile updated successfully.');
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    setPasswordSaving(true);
    setPasswordNotice('');
    setPasswordError('');
    try {
      await post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setPasswordNotice('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const initials = (nameStr: string) =>
    nameStr
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Account & Security Settings</DialogTitle>
          <DialogDescription>
            Manage your personal profile, credentials, and monitor recent authentication sessions.
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 mt-2">
          <button
            type="button"
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              tab === 'profile'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
            onClick={() => setTab('profile')}
          >
            <User size={14} />
            Profile Details
          </button>
          <button
            type="button"
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              tab === 'security'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
            onClick={() => setTab('security')}
          >
            <Lock size={14} />
            Password & Security
          </button>
          <button
            type="button"
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              tab === 'activity'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
            onClick={() => setTab('activity')}
          >
            <History size={14} />
            Recent Logins
          </button>
        </div>

        {/* Tab 1: Profile */}
        {tab === 'profile' && (
          <form onSubmit={handleUpdateProfile} className="space-y-4 pt-3">
            <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="avatar large bg-purple-100 text-purple-700 text-base font-bold w-14 h-14 rounded-full flex items-center justify-center">
                {initials(name || currentUser.name)}
              </span>
              <div>
                <strong className="text-sm block text-slate-900">{name || currentUser.name}</strong>
                <span className="text-xs text-slate-500 block">{currentUser.email}</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded mt-1">
                  <Shield size={11} />
                  {currentUser.role === 'admin'
                    ? 'Platform Admin'
                    : currentUser.role === 'auditor'
                    ? 'Compliance Auditor'
                    : 'Team Member'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-700">
                Display Name
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 text-sm border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Job Title / Specialization
                <input
                  type="text"
                  placeholder="e.g. Lead Platform Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 text-sm border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Email Address
                <input
                  type="email"
                  disabled
                  value={currentUser.email}
                  className="mt-1 block w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-slate-100 text-slate-500 cursor-not-allowed"
                />
              </label>
            </div>

            {profileNotice && (
              <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs rounded border border-emerald-200 flex items-center gap-2">
                <Check size={14} className="text-emerald-600" />
                {profileNotice}
              </div>
            )}
            {profileError && (
              <div className="p-2.5 bg-rose-50 text-rose-800 text-xs rounded border border-rose-200 flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-600" />
                {profileError}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button type="submit" className="primary text-xs" disabled={profileSaving}>
                {profileSaving ? 'Saving…' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Security & Password */}
        {tab === 'security' && (
          <form onSubmit={handleChangePassword} className="space-y-4 pt-3">
            <div className="text-xs text-slate-500 bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2">
              <Shield size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                Passwords must be at least 8 characters. Changing your password will be logged in the immutable audit
                trail under ISO 27001 / BOT security standards.
              </span>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-700">
                Current Password
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 text-sm border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                New Password (minimum 8 characters)
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 text-sm border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </label>

              <label className="block text-xs font-medium text-slate-700">
                Confirm New Password
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 text-sm border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </label>
            </div>

            {passwordNotice && (
              <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs rounded border border-emerald-200 flex items-center gap-2">
                <Check size={14} className="text-emerald-600" />
                {passwordNotice}
              </div>
            )}
            {passwordError && (
              <div className="p-2.5 bg-rose-50 text-rose-800 text-xs rounded border border-rose-200 flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-600" />
                {passwordError}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button type="submit" className="primary text-xs" disabled={passwordSaving}>
                {passwordSaving ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Recent Activity */}
        {tab === 'activity' && (
          <div className="space-y-3 pt-3">
            <div className="text-xs text-slate-500">
              Audit log of your last 5 authentication attempts from all devices and browsers:
            </div>

            {loadingActivity ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading access activity…</div>
            ) : recentLogins.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No recent login records found.</div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                {recentLogins.map((log) => (
                  <div key={log.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          log.action === 'LOGIN_SUCCESS'
                            ? 'bg-emerald-100 text-emerald-700'
                            : log.action === 'LOGIN_FAILURE'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {log.action === 'LOGIN_SUCCESS' ? (
                          <Check size={14} />
                        ) : log.action === 'LOGIN_FAILURE' ? (
                          <AlertCircle size={14} />
                        ) : (
                          <Globe size={14} />
                        )}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 font-semibold text-slate-800">
                          <span>{log.action.replace('_', ' ')}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                              log.action === 'LOGIN_SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {log.action === 'LOGIN_SUCCESS' ? 'Success' : 'Denied'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>IP: {log.ipAddress || '127.0.0.1'}</span>
                          <span>•</span>
                          <span className="truncate max-w-[200px]" title={log.userAgent}>
                            {log.userAgent?.split(' ')[0] || 'Browser'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
