import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCountry } from '../context/CountryContext';
import api from '../services/api';
import { toast } from '../components/ui/Toast';
import FilePickerModal from '../components/files/FilePickerModal';
import {
  HiOutlineUser,
  HiOutlineMail,
  HiOutlineLockClosed,
  HiOutlineKey,
  HiOutlineCamera,
  HiOutlineFolderOpen,
  HiOutlineTrash,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineShieldCheck,
  HiOutlineGlobeAlt,
  HiOutlineCheck,
} from 'react-icons/hi';

import { CountryBadge } from '../components/ui/CountryFlag';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { countries } = useCountry();

  // Tab state
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'security'

  // Profile Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Modals & file refs
  const [showFilePicker, setShowFilePicker] = useState(false);
  const fileInputRef = useRef(null);

  const getAvatarSrc = (url) => {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `http://localhost:3000${url.startsWith('/') ? '' : '/'}${url}`;
  };

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || user.full_name || '');
      setEmail(user.email || '');
      const rawAvatar = user.avatarUrl || user.avatar_url;
      setAvatarUrl(typeof rawAvatar === 'string' ? rawAvatar : (rawAvatar?.url || rawAvatar?.fullUrl || ''));
    }
  }, [user]);

  // Handle direct file upload for avatar
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size < 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setUploadingAvatar(true);
    try {
      const { data } = await api.post('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarUrl(data.avatarUrl);
      toast.success('Avatar uploaded successfully');
      await refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle saving profile details
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Full Name is required');
      return;
    }

    setSavingProfile(true);
    try {
      const cleanAvatar = typeof avatarUrl === 'string' && avatarUrl.trim()
        ? avatarUrl.trim()
        : (avatarUrl?.url || avatarUrl?.fullUrl || null);

      await api.put('/auth/profile', {
        fullName: fullName.trim(),
        email: email.trim(),
        avatarUrl: cleanAvatar,
      });
      toast.success('Profile updated successfully');
      await refreshUser();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle changing password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Current password is required');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setSavingPassword(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white font-display">
          Account & Profile
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
          Manage your personal information, profile photo, and security credentials
        </p>
      </div>

      {/* Hero Overview Card */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-white to-purple-50/40 dark:from-surface-900 dark:to-surface-800/60 border border-surface-200/80 dark:border-surface-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          {/* Avatar with Camera Trigger */}
          <div className="relative group">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-purple-500/25 overflow-hidden border-2 border-white dark:border-surface-800">
              {avatarUrl ? (
                <img
                  src={getAvatarSrc(avatarUrl)}
                  alt={user?.fullName || 'User'}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                user?.fullName?.charAt(0)?.toUpperCase() || '?'
              )}
            </div>

            {/* Quick Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-2 -right-2 p-2 rounded-2xl bg-purple-600 text-white shadow-md hover:bg-purple-700 transition-all hover:scale-105"
              title="Upload new avatar"
            >
              <HiOutlineCamera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              onChange={handleAvatarFileChange}
              className="hidden"
            />
          </div>

          {/* User Meta Information */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h2 className="text-xl font-bold text-surface-900 dark:text-white font-display">
                {user?.fullName}
              </h2>
              <span className="badge-primary uppercase tracking-wider text-[11px] font-bold px-2.5 py-0.5">
                {user?.role}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 flex items-center justify-center sm:justify-start gap-2">
              <HiOutlineMail className="w-4 h-4 text-purple-500" />
              <span>{user?.email}</span>
            </p>

            {/* Assigned Countries */}
            {countries && countries.length > 0 && (
              <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                <span className="text-xs text-surface-400 flex items-center gap-1 mr-1">
                  <HiOutlineGlobeAlt className="w-3.5 h-3.5" /> Market Access:
                </span>
                {countries.map((c) => (
                  <CountryBadge
                    key={c.id}
                    code={c.code}
                    label={c.code}
                    name={c.name}
                    size="xs"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-surface-200 dark:border-surface-800 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('details')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${activeTab === 'details'
            ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
            : 'border-transparent text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'
            }`}
        >
          <HiOutlineUser className="w-4 h-4" />
          <span>Profile Details</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all ${activeTab === 'security'
            ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
            : 'border-transparent text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'
            }`}
        >
          <HiOutlineKey className="w-4 h-4" />
          <span>Password & Security</span>
        </button>
      </div>

      {/* ─── TAB 1: PROFILE DETAILS ─────────────────────────── */}
      {activeTab === 'details' && (
        <form onSubmit={handleSaveProfile} className="glass-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-300 mb-2">
                Full Name
              </label>
              <div className="relative">
                <HiOutlineUser className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="input-field pl-10 text-sm"
                  required
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <HiOutlineMail className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="input-field pl-10 text-sm"
                  required
                />
              </div>
            </div>

            {/* Avatar URL & Media Selector */}
            <div className="sm:col-span-2 space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-300">
                Avatar Photo
              </label>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="URL or select from file manager (e.g. /uploads/avatars/user.jpg)"
                  className="input-field text-xs font-mono flex-1"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="btn-secondary text-xs py-2.5 px-3 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <HiOutlineCamera className="w-4 h-4 text-purple-600" />
                    <span>Upload Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowFilePicker(true)}
                    className="btn-secondary text-xs py-2.5 px-3 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <HiOutlineFolderOpen className="w-4 h-4 text-primary-500" />
                    <span>Browse Files</span>
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="p-2.5 rounded-xl border border-surface-200 dark:border-surface-700 text-surface-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      title="Clear Avatar"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-surface-400">
                Direct uploads will be saved in your local storage at <code className="font-mono text-purple-600 dark:text-purple-400">/uploads/avatars/</code>
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="pt-4 border-t border-surface-200 dark:border-surface-800 flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="btn-primary flex items-center gap-2 py-2.5 px-6 text-sm"
            >
              {savingProfile ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <HiOutlineCheck className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ─── TAB 2: PASSWORD & SECURITY ─────────────────────── */}
      {activeTab === 'security' && (
        <form onSubmit={handleChangePassword} className="glass-card rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="space-y-4 max-w-lg">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-300 mb-2">
                Current Password
              </label>
              <div className="relative">
                <HiOutlineLockClosed className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="input-field pl-10 pr-10 text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showCurrent ? <HiOutlineEyeOff className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <HiOutlineKey className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="input-field pl-10 pr-10 text-sm"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showNew ? <HiOutlineEyeOff className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword && (
                <p className={`text-[11px] mt-1 ${newPassword.length >= 8 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {newPassword.length >= 8 ? (
                    <span className="inline-flex items-center gap-1">
                      <HiOutlineCheck className="w-3.5 h-3.5" /> Password meets length requirements
                    </span>
                  ) : (
                    'Must be at least 8 characters'
                  )}
                </p>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-surface-600 dark:text-surface-300 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <HiOutlineKey className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="input-field pl-10 pr-10 text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showConfirm ? <HiOutlineEyeOff className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && (
                <p className={`text-[11px] mt-1 ${newPassword === confirmPassword ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                  {newPassword === confirmPassword ? (
                    <span className="inline-flex items-center gap-1">
                      <HiOutlineCheck className="w-3.5 h-3.5" /> Passwords match
                    </span>
                  ) : (
                    'Passwords do not match'
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div className="pt-4 border-t border-surface-200 dark:border-surface-800 flex justify-end">
            <button
              type="submit"
              disabled={savingPassword || (newPassword && newPassword !== confirmPassword)}
              className="btn-primary flex items-center gap-2 py-2.5 px-6 text-sm"
            >
              {savingPassword ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <HiOutlineLockClosed className="w-4 h-4" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Permissions Breakdown Drawer */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-4">
        <h3 className="text-sm font-bold text-surface-900 dark:text-white flex items-center gap-2">
          <HiOutlineShieldCheck className="w-5 h-5 text-purple-600" />
          <span>Assigned System Permissions ({user?.permissions?.length || 0})</span>
        </h3>
        <p className="text-xs text-surface-500 dark:text-surface-400">
          These granular permissions are granted to your account based on your role preset and administrative assignments.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {user?.permissions?.map((perm) => (
            <span
              key={perm}
              className="px-2.5 py-1 rounded-xl text-xs font-mono bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60"
            >
              {perm}
            </span>
          ))}
        </div>
      </div>

      {/* Reusable FilePickerModal for Avatar */}
      <FilePickerModal
        isOpen={showFilePicker}
        onClose={() => setShowFilePicker(false)}
        onSelect={(selected) => {
          const chosenUrl = typeof selected === 'string'
            ? selected
            : (selected?.url || selected?.fullUrl || '');
          setAvatarUrl(chosenUrl);
          setShowFilePicker(false);
          toast.success('Avatar selected from media library');
        }}
        allowedExtensions={['jpg', 'jpeg', 'png', 'webp', 'svg']}
        imagesOnly={true}
        title="Select Avatar Image"
      />
    </div>
  );
}
