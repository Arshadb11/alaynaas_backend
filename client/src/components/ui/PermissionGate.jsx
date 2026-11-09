import { usePermission, useAnyPermission } from '../../hooks/usePermission';

/**
 * Conditionally render children based on permission.
 * 
 * <PermissionGate permission="users.create">
 *   <button>Create User</button>
 * </PermissionGate>
 * 
 * <PermissionGate anyOf={['products.update_content', 'products.update']}>
 *   <EditForm />
 * </PermissionGate>
 */
export default function PermissionGate({ permission, anyOf, children, fallback = null }) {
  const hasSingle = usePermission(permission || '');
  const hasAny = useAnyPermission(anyOf || []);

  if (permission && hasSingle) return children;
  if (anyOf && hasAny) return children;
  if (!permission && !anyOf) return children;

  return fallback;
}
