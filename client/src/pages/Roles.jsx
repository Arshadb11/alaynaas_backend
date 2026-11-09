import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from '../components/ui/Toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allPermissions, setAllPermissions] = useState({ flat: [], grouped: {} });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', permissions: [] });

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      const { data } = await api.get('/roles');
      setRoles(data.data);
    } catch {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const { data } = await api.get('/roles/permissions/all');
      setAllPermissions(data.data);
    } catch { /* ignore */ }
  };

  const openEdit = async (roleId) => {
    try {
      const { data } = await api.get(`/roles/${roleId}`);
      const role = data.data;
      setForm({
        name: role.name,
        description: role.description || '',
        permissions: role.permissions.map((p) => p.permission_key),
      });
      setEditing(roleId);
      setShowModal(true);
    } catch {
      toast.error('Failed to load role');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/roles/${editing}`, form);
        toast.success('Role updated');
      } else {
        await api.post('/roles', form);
        toast.success('Role created');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: '', description: '', permissions: [] });
      fetchRoles();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save role');
    }
  };

  const handleDelete = async (roleId) => {
    if (!confirm('Delete this role preset?')) return;
    try {
      await api.delete(`/roles/${roleId}`);
      toast.success('Role deleted');
      fetchRoles();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete role');
    }
  };

  const togglePerm = (key) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white font-display">Role Presets</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Define permission templates that can be applied to users quickly
          </p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: '', description: '', permissions: [] }); setShowModal(true); }} className="btn-primary flex items-center justify-center gap-2 self-start sm:self-auto">
          <HiOutlinePlus className="w-4 h-4" /> New Role
        </button>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full glass-card p-12 text-center text-surface-400">Loading...</div>
        ) : (
          roles.map((role) => (
            <div key={role.id} className="glass-card p-5 animate-slide-up">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-surface-900 dark:text-white capitalize">{role.name}</h3>
                  <p className="text-xs text-surface-500 mt-0.5">{role.description || '—'}</p>
                </div>
                {role.is_system ? (
                  <span className="badge-warning text-[10px]">SYSTEM</span>
                ) : (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(role.id)} className="btn-ghost p-1.5 rounded-lg">
                      <HiOutlinePencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(role.id)} className="btn-ghost p-1.5 rounded-lg text-red-500">
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-surface-500">
                <span className="badge-primary">{role.preset_permission_count} permissions</span>
                <span className="badge-info">{role.user_count} users</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="glass-card p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto animate-slide-up bg-white dark:bg-surface-900 rounded-2xl">
            <h2 className="text-base sm:text-lg font-semibold text-surface-900 dark:text-white mb-4">
              {editing ? 'Edit Role' : 'Create Role'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Role name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required />
              <input type="text" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" />

              <div className="space-y-3">
                <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">Permissions</p>
                {Object.entries(allPermissions.grouped).map(([module, perms]) => (
                  <div key={module} className="border border-surface-200 dark:border-surface-700 rounded-xl p-3">
                    <p className="text-xs font-semibold text-surface-500 mb-2 uppercase">{module}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {perms.map((p) => (
                        <label key={p.permission_key} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                          <input
                            type="checkbox"
                            checked={form.permissions.includes(p.permission_key)}
                            onChange={() => togglePerm(p.permission_key)}
                            className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-surface-700 dark:text-surface-300">{p.action.replace('_', ' ')}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => { setShowModal(false); setEditing(null); }} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
