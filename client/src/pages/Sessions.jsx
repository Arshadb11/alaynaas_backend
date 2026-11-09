import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from '../components/ui/Toast';
import { HiOutlineDesktopComputer, HiOutlineDeviceMobile, HiOutlineGlobeAlt, HiOutlineLogout, HiOutlineExclamation } from 'react-icons/hi';

export default function Sessions() {
  const { logoutAll } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchSessions(); }, []);

  const fetchSessions = async () => {
    try {
      const { data } = await api.get('/auth/sessions');
      setSessions(data.data);
    } catch {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutDevice = async (sessionId) => {
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      toast.success('Device logged out');
      fetchSessions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to logout device');
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.is_current).length;

  const handleLogoutAll = async () => {
    if (otherSessionsCount === 0) {
      toast.info('No other active sessions found');
      return;
    }
    if (!confirm(`This will log out ${otherSessionsCount} other active device${otherSessionsCount === 1 ? '' : 's'}. Your current session will remain logged in. Continue?`)) return;
    try {
      const res = await logoutAll();
      toast.success(res?.message || 'All other sessions terminated');
      fetchSessions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to logout other devices');
    }
  };

  const getDeviceIcon = (type) => {
    if (type === 'mobile') return HiOutlineDeviceMobile;
    if (type === 'tablet') return HiOutlineGlobeAlt;
    return HiOutlineDesktopComputer;
  };

  const formatDate = (date) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleString();
  };

  const getTimeAgo = (date) => {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white font-display">Active Sessions</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Manage your active sessions across devices
          </p>
        </div>
        <button
          onClick={handleLogoutAll}
          disabled={otherSessionsCount === 0}
          className="btn-danger flex items-center justify-center gap-2 self-start sm:self-auto disabled:opacity-40 disabled:cursor-not-allowed"
          title={otherSessionsCount === 0 ? 'No other active devices' : 'Logout all other devices'}
        >
          <HiOutlineExclamation className="w-4 h-4" /> Logout All Other Devices {otherSessionsCount > 0 ? `(${otherSessionsCount})` : ''}
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="glass-card p-12 text-center">
            <div className="w-8 h-8 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="glass-card p-12 text-center text-surface-400">
            No active sessions
          </div>
        ) : (
          sessions.map((s) => {
            const DeviceIcon = getDeviceIcon(s.device_type);
            return (
              <div
                key={s.id}
                className={`glass-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 animate-slide-in ${
                  s.is_current ? 'ring-2 ring-primary-500/30' : ''
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    s.is_current
                      ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-500'
                  }`}>
                    <DeviceIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                        {s.browser} · {s.os}
                      </p>
                      {s.is_current && (
                        <span className="badge-success text-[10px] shrink-0">THIS DEVICE</span>
                      )}
                    </div>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 truncate">
                      {s.ip_address} {s.location ? `· ${s.location}` : ''}
                    </p>
                    <p className="text-xs text-surface-400 dark:text-surface-400 mt-0.5">
                      Last active: {getTimeAgo(s.last_active_at)} · Logged in: {formatDate(s.created_at)}
                    </p>
                  </div>
                </div>

                {!s.is_current && (
                  <button
                    onClick={() => handleLogoutDevice(s.id)}
                    className="btn-secondary text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 self-end sm:self-center shrink-0 text-xs py-1.5 px-3"
                  >
                    <HiOutlineLogout className="w-4 h-4" /> Logout
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
