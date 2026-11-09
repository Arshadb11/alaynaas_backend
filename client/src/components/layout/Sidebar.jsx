import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useBranding } from '../../context/BrandingContext';
import { usePermission } from '../../hooks/usePermission';
import {
  HiOutlineViewGrid, HiOutlineUsers, HiOutlineShieldCheck,
  HiOutlineClipboardList, HiOutlineCog, HiOutlineDocumentText,
  HiOutlineGlobeAlt, HiOutlineFolder, HiOutlineSparkles,
  HiOutlineFolderOpen, HiOutlineColorSwatch, HiOutlineX,
  HiOutlineShoppingBag, HiOutlineSun, HiOutlineMoon, HiOutlineLogout,
  HiOutlineUser, HiOutlineTemplate, HiOutlineStar,
} from 'react-icons/hi';

const STORE_ITEMS = [
  { to: '/storefront', label: 'Storefront', icon: HiOutlineTemplate, permission: 'settings.read' },
  { to: '/orders', label: 'Orders', icon: HiOutlineShoppingBag, permission: 'orders.read' },
  { to: '/products', label: 'Products', icon: HiOutlineSparkles, permission: 'products.read' },
  { to: '/reviews', label: 'Reviews', icon: HiOutlineStar, permission: 'products.read' },
  { to: '/catalog', label: 'Catalog', icon: HiOutlineFolder, permission: ['categories.read', 'brands.read', 'categories.manage', 'brands.manage'] },
  { to: '/fragrance', label: 'Fragrance Profiles', icon: HiOutlineColorSwatch, permission: 'products.read' },
  { to: '/countries', label: 'Countries', icon: HiOutlineGlobeAlt, permission: 'countries.read' },
  { to: '/files', label: 'File Manager', icon: HiOutlineFolderOpen, permission: 'files.read' },
];

function NavItem({ to, label, icon: Icon, permission, onClick }) {
  const hasPermission = usePermission(permission || '');

  // Hide items the user can't access (unless no permission required)
  if (permission && !hasPermission) return null;

  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { adminLogo, adminLogoHeight, storeName } = useBranding();
  const navigate = useNavigate();

  const handleLogout = async () => {
    onClose();
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 flex flex-col z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo & Close Button */}
        <div className="p-4 sm:p-5 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={adminLogo}
              alt={storeName || 'Logo'}
              className="w-auto object-contain"
              style={{ height: `${adminLogoHeight}px` }}
              onError={(e) => { e.currentTarget.src = '/LOGO/Desktop.svg'; }}
            />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 lg:hidden"
            title="Close navigation"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        <div>
          <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Overview
          </p>
          <div className="space-y-1">
            <NavItem to="/dashboard" label="Dashboard" icon={HiOutlineViewGrid} onClick={onClose} />
          </div>
        </div>

        <div>
          <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Store & Catalog
          </p>
          <div className="space-y-1">
            {STORE_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} onClick={onClose} />
            ))}
          </div>
        </div>

        <div>
          <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Administration
          </p>
          <div className="space-y-1">
            <NavItem to="/users" label="Users" icon={HiOutlineUsers} permission="users.read" onClick={onClose} />
            <NavItem to="/roles" label="Role Presets" icon={HiOutlineShieldCheck} permission="users.manage_permissions" onClick={onClose} />
            <NavItem to="/audit-logs" label="Audit Logs" icon={HiOutlineClipboardList} permission="audit.read" onClick={onClose} />
            <NavItem to="/settings" label="Settings" icon={HiOutlineCog} permission="settings.read" onClick={onClose} />
          </div>
        </div>

        <div>
          <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Account
          </p>
          <div className="space-y-1">
            <NavItem to="/sessions" label="My Sessions" icon={HiOutlineDocumentText} onClick={onClose} />
            <NavItem to="/profile" label="Profile" icon={HiOutlineUser} onClick={onClose} />
          </div>
        </div>
      </nav>

      {/* Bottom: User Info & System Controls */}
      <div className="p-3 border-t border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/60">
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-surface-850 border border-surface-200/70 dark:border-surface-800 shadow-2xs">
          {/* User profile action */}
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate('/profile');
            }}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left group focus:outline-none"
            title="View Profile"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-semibold overflow-hidden border border-surface-200 dark:border-surface-700 flex-shrink-0 group-hover:ring-2 group-hover:ring-primary-500/40 transition-all">
              {user?.avatarUrl || user?.avatar_url ? (
                <img
                  src={(user.avatarUrl || user.avatar_url).startsWith('http') ? (user.avatarUrl || user.avatar_url) : `http://localhost:3000${(user.avatarUrl || user.avatar_url).startsWith('/') ? '' : '/'}${user.avatarUrl || user.avatar_url}`}
                  alt={user?.fullName || 'Avatar'}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                user?.fullName?.charAt(0)?.toUpperCase() || '?'
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-surface-900 dark:text-white truncate leading-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {user?.fullName || 'User'}
              </p>
              <p className="text-[10px] text-surface-400 capitalize truncate leading-tight mt-0.5">
                {user?.role?.replace('_', ' ') || 'Staff'}
              </p>
            </div>
          </button>

          {/* Controls: Theme & Logout */}
          <div className="flex items-center gap-0.5 flex-shrink-0 pl-1 border-l border-surface-100 dark:border-surface-800">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <HiOutlineSun className="w-4 h-4 text-amber-400" />
              ) : (
                <HiOutlineMoon className="w-4 h-4 text-primary-600" />
              )}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              title="Logout"
              aria-label="Log out of account"
            >
              <HiOutlineLogout className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  </>
  );
}
