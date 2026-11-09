import { useState, useEffect, useCallback, Fragment } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import PermissionGate from '../components/ui/PermissionGate';
import { toast } from '../components/ui/Toast';
import Pagination from '../components/ui/Pagination';
import CountryFlag from '../components/ui/CountryFlag';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineShieldCheck, HiOutlineGlobeAlt, HiOutlineChevronDown } from 'react-icons/hi';

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermModal, setShowPermModal] = useState(null); // userId
  const [showCountryModal, setShowCountryModal] = useState(null); // userId
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState({ flat: [], grouped: {} });
  const [allCountries, setAllCountries] = useState([]);
  const [userCountryIds, setUserCountryIds] = useState([]);

  // Form state
  const [form, setForm] = useState({ fullName: '', email: '', password: '', roleId: 1, permissions: [] });
  const [editingUser, setEditingUser] = useState(null);
  const [userPerms, setUserPerms] = useState([]);

  // Pagination state
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [expandedUserId, setExpandedUserId] = useState(null);

  const toggleUserExpand = (id) => {
    setExpandedUserId((prev) => (prev === id ? null : id));
  };

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/users', {
        params: { search, page: pagination.page, limit: pagination.limit },
      });
      setUsers(data.data);
      if (data.pagination) setPagination(data.pagination);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      const { data } = await api.get('/roles');
      setRoles(data.data);
    } catch { /* ignore */ }
  };

  const fetchPermissions = async () => {
    try {
      const { data } = await api.get('/roles/permissions/all');
      setAllPermissions(data.data);
    } catch { /* ignore */ }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', form);
      toast.success('User created');
      setShowCreateModal(false);
      setForm({ fullName: '', email: '', password: '', roleId: 1, permissions: [] });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleToggleActive = async (userId) => {
    try {
      await api.patch(`/users/${userId}/toggle-active`);
      toast.success('User status updated');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await api.delete(`/users/${userId}`);
      toast.success('User deactivated');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  };

  // Permission editor
  const openPermEditor = async (userId) => {
    try {
      const { data } = await api.get(`/users/${userId}/permissions`);
      setUserPerms(data.data.map((p) => p.permission_key));
      setShowPermModal(userId);
    } catch (err) {
      toast.error('Failed to load permissions');
    }
  };

  const togglePerm = (permKey) => {
    setUserPerms((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]
    );
  };

  const savePerms = async () => {
    try {
      await api.put(`/users/${showPermModal}/permissions`, { permissions: userPerms });
      toast.success('Permissions updated');
      setShowPermModal(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save permissions');
    }
  };

  const applyPreset = async (roleId) => {
    try {
      const role = roles.find((r) => r.id === roleId);
      const { data } = await api.get(`/roles/${roleId}`);
      setUserPerms(data.data.permissions.map((p) => p.permission_key));
      toast.info(`Applied ${role?.name || 'preset'} permissions`);
    } catch {
      toast.error('Failed to apply preset');
    }
  };

  const openCountryEditor = async (userId) => {
    try {
      const [countriesRes, userCountriesRes] = await Promise.all([
        api.get('/countries'),
        api.get(`/countries/user/${userId}/assigned`),
      ]);
      setAllCountries(countriesRes.data.data);
      setUserCountryIds(userCountriesRes.data.data.map((c) => c.id));
      setShowCountryModal(userId);
    } catch {
      toast.error('Failed to load user country assignments');
    }
  };

  const toggleCountryId = (countryId) => {
    setUserCountryIds((prev) =>
      prev.includes(countryId) ? prev.filter((id) => id !== countryId) : [...prev, countryId]
    );
  };

  const saveCountries = async () => {
    try {
      await api.put(`/countries/user/${showCountryModal}/assigned`, { countryIds: userCountryIds });
      toast.success('Country assignments updated');
      setShowCountryModal(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save country assignments');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white font-display">Users</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">Manage admin panel users and their permissions</p>
        </div>
        <PermissionGate permission="users.create">
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center justify-center gap-2 self-start sm:self-auto">
            <HiOutlinePlus className="w-4 h-4" /> New User
          </button>
        </PermissionGate>
      </div>

      {/* Search */}
      <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
          className="input-field flex-1 sm:max-w-sm"
        />
        <button onClick={fetchUsers} className="btn-secondary shrink-0">Search</button>
      </div>

      {/* Users Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-700">
                <th className="text-left py-2.5 sm:py-3 px-3 sm:px-4 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-300">User</th>
                <th className="hidden md:table-cell text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-300">Role</th>
                <th className="hidden md:table-cell text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-300">Permissions</th>
                <th className="hidden md:table-cell text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-300">Status</th>
                <th className="text-right py-2.5 sm:py-3 px-3 sm:px-4 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-surface-400">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-surface-400">No users found</td></tr>
              ) : (
                users.map((u) => {
                  const isExpanded = expandedUserId === u.id;
                  return (
                    <Fragment key={u.id}>
                      <tr
                        onClick={() => toggleUserExpand(u.id)}
                        className={`transition-colors cursor-pointer md:cursor-default ${
                          isExpanded
                            ? 'bg-primary-50/40 dark:bg-primary-950/20'
                            : 'hover:bg-surface-50 dark:hover:bg-surface-800/50'
                        }`}
                      >
                        {/* 1. User Column (Avatar/Initial + Name + Email + Expand Chevron on Mobile) */}
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <HiOutlineChevronDown
                              className={`w-3.5 h-3.5 md:hidden shrink-0 text-surface-400 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180 text-primary-600 dark:text-primary-400' : ''
                              }`}
                            />
                            {(u.avatar_url || u.avatarUrl) ? (
                              <img
                                src={(u.avatar_url || u.avatarUrl).startsWith('http') || (u.avatar_url || u.avatarUrl).startsWith('/') ? (u.avatar_url || u.avatarUrl) : `/${u.avatar_url || u.avatarUrl}`}
                                alt={u.full_name || 'User avatar'}
                                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-surface-200 dark:border-surface-700 shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs sm:text-sm font-semibold shrink-0 ${(u.avatar_url || u.avatarUrl) ? 'hidden' : ''}`}>
                              {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-medium text-surface-900 dark:text-white truncate max-w-[120px] xs:max-w-[170px] sm:max-w-none" title={u.full_name}>
                                {u.full_name}
                              </p>
                              <p className="text-[11px] text-surface-500 truncate max-w-[120px] xs:max-w-[170px] sm:max-w-none" title={u.email}>
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 2. Role (hidden on mobile) */}
                        <td className="hidden md:table-cell py-3 px-4">
                          <span className="badge-primary capitalize">{u.role}</span>
                        </td>

                        {/* 3. Permissions (hidden on mobile) */}
                        <td className="hidden md:table-cell py-3 px-4">
                          <span className="text-sm text-surface-600 dark:text-surface-400">{u.permission_count} permissions</span>
                        </td>

                        {/* 4. Status (hidden on mobile) */}
                        <td className="hidden md:table-cell py-3 px-4">
                          <span className={u.is_active ? 'badge-success' : 'badge-danger'}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* 5. Actions (visible on mobile & desktop) */}
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                          <div className="flex items-center gap-1 justify-end">
                            <PermissionGate permission="users.manage_permissions">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPermEditor(u.id);
                                }}
                                className="btn-ghost p-1.5 sm:p-2 rounded-lg active:scale-95 transition-all"
                                title="Manage permissions"
                              >
                                <HiOutlineShieldCheck className="w-4 h-4 text-primary-500" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCountryEditor(u.id);
                                }}
                                className="btn-ghost p-1.5 sm:p-2 rounded-lg text-emerald-500 hover:text-emerald-600 active:scale-95 transition-all"
                                title="Assign countries"
                              >
                                <HiOutlineGlobeAlt className="w-4 h-4" />
                              </button>
                            </PermissionGate>
                            <PermissionGate permission="users.update">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleActive(u.id);
                                }}
                                className="btn-ghost p-1.5 sm:p-2 rounded-lg active:scale-95 transition-all"
                                title="Toggle active"
                              >
                                <HiOutlinePencil className="w-4 h-4" />
                              </button>
                            </PermissionGate>
                            <PermissionGate permission="users.delete">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(u.id);
                                }}
                                className="btn-ghost p-1.5 sm:p-2 rounded-lg text-red-500 active:scale-95 transition-all"
                                title="Delete user"
                                disabled={u.id === currentUser?.id}
                              >
                                <HiOutlineTrash className="w-4 h-4" />
                              </button>
                            </PermissionGate>
                          </div>
                        </td>
                      </tr>

                      {/* Mobile Expanded Details Row */}
                      {isExpanded && (
                        <tr className="md:hidden bg-primary-50/25 dark:bg-primary-950/15 border-b border-surface-200/80 dark:border-surface-800">
                          <td colSpan={2} className="py-2.5 px-3">
                            <div className="space-y-2 text-xs animate-fade-in">
                              <div className="grid grid-cols-2 gap-2">
                                {/* Role */}
                                <div className="p-2 rounded-lg bg-white dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
                                  <span className="text-[10px] text-surface-400 uppercase font-semibold block">Role</span>
                                  <div className="mt-1">
                                    <span className="badge-primary capitalize text-xs">{u.role}</span>
                                  </div>
                                </div>

                                {/* Status */}
                                <div className="p-2 rounded-lg bg-white dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
                                  <span className="text-[10px] text-surface-400 uppercase font-semibold block">Status</span>
                                  <div className="mt-1">
                                    <span className={u.is_active ? 'badge-success text-xs' : 'badge-danger text-xs'}>
                                      {u.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Permissions Count */}
                              <div className="p-2 rounded-lg bg-white dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60 flex items-center justify-between">
                                <span className="text-[10px] text-surface-400 uppercase font-semibold">Assigned Permissions</span>
                                <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                                  {u.permission_count} permissions
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-surface-200 dark:border-surface-800">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
            onItemsPerPageChange={(l) => setPagination((prev) => ({ ...prev, limit: l, page: 1 }))}
            itemsPerPageOptions={[5, 10, 25, 50]}
            label="users"
          />
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="glass-card p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up bg-white dark:bg-surface-900 rounded-2xl">
            <h2 className="text-base sm:text-lg font-semibold text-surface-900 dark:text-white mb-4">Create User</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <input type="text" placeholder="Full Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input-field" required />
              <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" required />
              <input type="password" placeholder="Password (min 8 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-field" required minLength={8} />
              <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: parseInt(e.target.value) })} className="input-field">
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} — {r.description}</option>
                ))}
              </select>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permission Editor Modal */}
      {showPermModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="glass-card p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto animate-slide-up bg-white dark:bg-surface-900 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-surface-900 dark:text-white truncate">
                Edit Permissions — {users.find((u) => u.id === showPermModal)?.full_name}
              </h2>
              <select
                onChange={(e) => e.target.value && applyPreset(parseInt(e.target.value))}
                className="input-field w-full sm:w-auto text-sm"
                defaultValue=""
              >
                <option value="">Apply Preset...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              {Object.entries(allPermissions.grouped).map(([module, perms]) => (
                <div key={module} className="border border-surface-200 dark:border-surface-700 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-surface-900 dark:text-white capitalize">{module}</h3>
                    <button
                      type="button"
                      className="text-xs text-primary-500 hover:text-primary-600"
                      onClick={() => {
                        const modulePerms = perms.map((p) => p.permission_key);
                        const allSelected = modulePerms.every((p) => userPerms.includes(p));
                        if (allSelected) {
                          setUserPerms((prev) => prev.filter((p) => !modulePerms.includes(p)));
                        } else {
                          setUserPerms((prev) => [...new Set([...prev, ...modulePerms])]);
                        }
                      }}
                    >
                      Toggle All
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {perms.map((p) => (
                      <label
                        key={p.permission_key}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          userPerms.includes(p.permission_key)
                            ? 'bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800'
                            : 'hover:bg-surface-50 dark:hover:bg-surface-800 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={userPerms.includes(p.permission_key)}
                          onChange={() => togglePerm(p.permission_key)}
                          className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div>
                          <p className="text-sm font-medium text-surface-900 dark:text-white">{p.action.replace('_', ' ')}</p>
                          <p className="text-xs text-surface-500">{p.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end mt-6 sticky bottom-0 bg-white dark:bg-surface-900 pt-4 border-t border-surface-100 dark:border-surface-800">
              <button onClick={() => setShowPermModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={savePerms} className="btn-primary">Save Permissions</button>
            </div>
          </div>
        </div>
      )}

      {/* Country Assignment Modal */}
      {showCountryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="glass-card p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up bg-white dark:bg-surface-900 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base sm:text-lg font-semibold text-surface-900 dark:text-white">
                Assign Countries — {users.find((u) => u.id === showCountryModal)?.full_name}
              </h2>
            </div>
            <p className="text-xs text-surface-500 mb-4">
              Select which countries this user is permitted to view and manage in the storefront and catalog.
            </p>

            <div className="space-y-2 mb-6 max-h-[55vh] overflow-y-auto">
              {allCountries.map((c) => {
                const checked = userCountryIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                        : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CountryFlag code={c.code} name={c.name} size="md" />
                      <div>
                        <p className="text-sm font-medium text-surface-900 dark:text-white">{c.name}</p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          {c.code} · {c.currency_code} ({c.currency_symbol}) · Tax: {c.tax_percentage}%
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCountryId(c.id)}
                      className="w-4 h-4 rounded border-surface-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-surface-100 dark:border-surface-800">
              <button onClick={() => setShowCountryModal(null)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={saveCountries} className="btn-primary">
                Save Assignments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
