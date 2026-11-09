import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { PERMISSION_REGISTRY } from '../config/permission-registry';

/**
 * Returns field-level access info for a module based on the user's permissions.
 * 
 * Usage:
 *   const { canSee, canEdit, showSection, showButton } = useFieldAccess('products');
 *   
 *   canSee('price')              → boolean
 *   canEdit('description')       → boolean
 *   showSection('pricing-panel') → boolean
 *   showButton('delete-product') → boolean
 */
export function useFieldAccess(module) {
  const { user } = useAuth();

  return useMemo(() => {
    const permissions = user?.permissions || [];

    const visibleFields = new Set();
    const editableFields = new Set();
    const visibleSections = new Set();
    const visibleButtons = new Set();
    const navItems = new Set();

    for (const perm of permissions) {
      if (!perm.startsWith(module + '.')) continue;
      const entry = PERMISSION_REGISTRY[perm];
      if (!entry) continue;

      if (entry.fields?.visible) {
        entry.fields.visible.forEach((f) => visibleFields.add(f));
      }
      if (entry.fields?.editable) {
        entry.fields.editable.forEach((f) => {
          editableFields.add(f);
          visibleFields.add(f); // editable implies visible
        });
      }
      if (entry.ui?.sections) {
        entry.ui.sections.forEach((s) => visibleSections.add(s));
      }
      if (entry.ui?.buttons) {
        entry.ui.buttons.forEach((b) => visibleButtons.add(b));
      }
      if (entry.ui?.nav) {
        navItems.add(entry.ui.nav);
      }
    }

    return {
      canSee: (field) => visibleFields.has(field),
      canEdit: (field) => editableFields.has(field),
      showSection: (section) => visibleSections.has(section),
      showButton: (button) => visibleButtons.has(button),
      hasNav: (nav) => navItems.has(nav),
      visibleFields: [...visibleFields],
      editableFields: [...editableFields],
    };
  }, [user?.permissions, module]);
}
