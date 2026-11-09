import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from '../components/ui/Toast';
import { usePermission } from '../hooks/usePermission';
import CountryFlag from '../components/ui/CountryFlag';
import {
  HiOutlinePlus, HiOutlinePencil, HiOutlineTrash,
  HiOutlineGlobeAlt, HiOutlineCheck, HiOutlineX,
} from 'react-icons/hi';

const EMPTY_FORM = {
  name: '', code: '', currencyCode: '', currencySymbol: '',
  currencyName: '', taxPercentage: 0, isActive: true, sortOrder: 0,
};

export default function Countries() {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const canManage = usePermission('countries.manage');

  useEffect(() => { fetchCountries(); }, []);

  const fetchCountries = async () => {
    try {
      const { data } = await api.get('/countries');
      setCountries(data.data);
    } catch {
      toast.error('Failed to load countries');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (country) => {
    setForm({
      name: country.name,
      code: country.code,
      currencyCode: country.currency_code,
      currencySymbol: country.currency_symbol,
      currencyName: country.currency_name,
      taxPercentage: country.tax_percentage,
      isActive: country.is_active,
      sortOrder: country.sort_order,
    });
    setEditing(country.id);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/countries/${editing}`, form);
        toast.success('Country updated');
      } else {
        await api.post('/countries', form);
        toast.success('Country created');
      }
      setShowModal(false);
      fetchCountries();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this country? This will remove all user assignments.')) return;
    try {
      await api.delete(`/countries/${id}`);
      toast.success('Country deleted');
      fetchCountries();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Countries</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Manage countries, currencies, and tax rates
          </p>
        </div>
        {canManage && (
          <button onClick={openCreate} className="btn btn-primary flex items-center justify-center gap-2 self-start sm:self-auto">
            <HiOutlinePlus className="w-5 h-5" /> Add Country
          </button>
        )}
      </div>

      {/* Country Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {countries.map((c) => (
          <div
            key={c.id}
            className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-5 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <CountryFlag code={c.code} name={c.name} size="lg" className="shadow-xs" />
                <div>
                  <h3 className="font-semibold text-surface-900 dark:text-white">{c.name}</h3>
                  <span className="text-xs font-mono text-surface-500 bg-surface-100 dark:bg-surface-700 dark:text-surface-400 px-2 py-0.5 rounded">
                    {c.code}
                  </span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                c.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {c.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
              <div className="flex justify-between">
                <span>Currency</span>
                <span className="font-medium text-surface-900 dark:text-white">
                  {c.currency_symbol} {c.currency_code}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Currency Name</span>
                <span className="font-medium text-surface-900 dark:text-white">{c.currency_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax Rate</span>
                <span className="font-medium text-surface-900 dark:text-white">{c.tax_percentage}%</span>
              </div>
            </div>

            {canManage && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
                <button
                  onClick={() => openEdit(c)}
                  className="flex-1 btn btn-sm flex items-center justify-center gap-1 text-surface-600 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 border border-surface-300 dark:border-surface-600 rounded-lg py-1.5"
                >
                  <HiOutlinePencil className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="flex-1 btn btn-sm flex items-center justify-center gap-1 text-surface-600 dark:text-surface-400 hover:text-red-600 dark:hover:text-red-400 border border-surface-300 dark:border-surface-600 rounded-lg py-1.5"
                >
                  <HiOutlineTrash className="w-4 h-4" /> Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {countries.length === 0 && (
        <div className="text-center py-12 text-surface-500 dark:text-surface-400">
          <HiOutlineGlobeAlt className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No countries configured yet.</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-surface-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-200 dark:border-surface-700">
              <h2 className="text-base sm:text-lg font-semibold text-surface-900 dark:text-white truncate">
                {editing ? 'Edit Country' : 'Add Country'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-surface-400 hover:text-surface-600 shrink-0">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Name</label>
                  <input
                    type="text" value={form.name} onChange={(e) => setField('name', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">Code</label>
                    {form.code && <CountryFlag code={form.code} size="xs" />}
                  </div>
                  <input
                    type="text" value={form.code} onChange={(e) => setField('code', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 uppercase font-mono"
                    maxLength={5} required disabled={!!editing}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Currency Code</label>
                  <input
                    type="text" value={form.currencyCode} onChange={(e) => setField('currencyCode', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 uppercase font-mono"
                    maxLength={5} required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Symbol</label>
                  <input
                    type="text" value={form.currencySymbol} onChange={(e) => setField('currencySymbol', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    maxLength={10} required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Currency Name</label>
                  <input
                    type="text" value={form.currencyName} onChange={(e) => setField('currencyName', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Tax %</label>
                  <input
                    type="number" step="0.01" value={form.taxPercentage}
                    onChange={(e) => setField('taxPercentage', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Sort Order</label>
                  <input
                    type="number" value={form.sortOrder}
                    onChange={(e) => setField('sortOrder', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox" id="isActive" checked={form.isActive}
                  onChange={(e) => setField('isActive', e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded border-surface-300"
                />
                <label htmlFor="isActive" className="text-sm text-surface-700 dark:text-surface-300">Active</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-200 dark:border-surface-700">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-6 py-2">
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
