import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, permission, anyOf }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-sm text-surface-500 dark:text-surface-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Optional permission check (supports single permission or array of permissions via permission or anyOf)
  const requiredList = anyOf || (Array.isArray(permission) ? permission : permission ? [permission] : null);
  const hasAccess = !requiredList || requiredList.some((p) => user?.permissions?.includes(p));

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950">
        <div className="glass-card p-8 text-center max-w-md animate-fade-in">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-surface-500 dark:text-surface-400 text-sm">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return children;
}
