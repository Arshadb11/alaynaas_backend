import { useAuth } from '../context/AuthContext';

/**
 * Check if the current user has a specific permission
 * Usage: const canCreate = usePermission('users.create');
 */
export function usePermission(permission) {
  const { user } = useAuth();
  if (!user?.permissions || !permission) return false;
  if (Array.isArray(permission)) {
    return permission.some((p) => user.permissions.includes(p));
  }
  return user.permissions.includes(permission);
}

/**
 * Check if the current user has ANY of the given permissions
 */
export function useAnyPermission(permissions) {
  const { user } = useAuth();
  if (!user?.permissions) return false;
  return permissions.some((p) => user.permissions.includes(p));
}

/**
 * Check if the current user has ALL of the given permissions
 */
export function useAllPermissions(permissions) {
  const { user } = useAuth();
  if (!user?.permissions) return false;
  return permissions.every((p) => user.permissions.includes(p));
}
