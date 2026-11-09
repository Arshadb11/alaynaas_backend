import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from '../components/ui/Toast';
import Pagination from '../components/ui/Pagination';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({ category: '', severity: '', action: '' });
  const [expandedId, setExpandedId] = useState(null);
  const [expandedDetails, setExpandedDetails] = useState(null);

  useEffect(() => { fetchLogs(); }, [page, limit, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page, limit, ...filters };
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      const { data } = await api.get('/logs/audit', { params });
      setLogs(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const expandLog = async (logId) => {
    if (expandedId === logId) {
      setExpandedId(null);
      return;
    }
    try {
      const { data } = await api.get(`/logs/audit/${logId}`);
      setExpandedDetails(data.data);
      setExpandedId(logId);
    } catch {
      toast.error('Failed to load details');
    }
  };

  const severityColors = {
    info: 'badge-info',
    warning: 'badge-warning',
    critical: 'badge-danger',
  };

  const statusColors = {
    success: 'text-emerald-500',
    failure: 'text-red-500',
    denied: 'text-amber-500',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white font-display">Audit Logs</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">Track all user actions and system events</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 sm:gap-3 flex-wrap items-center">
        <select
          value={filters.category}
          onChange={(e) => { setFilters({ ...filters, category: e.target.value }); setPage(1); }}
          className="input-field flex-1 sm:flex-none sm:w-auto text-xs py-2"
        >
          <option value="">All Categories</option>
          <option value="auth">Auth</option>
          <option value="user_mgmt">User Management</option>
          <option value="permission">Permissions</option>
          <option value="product">Products</option>
          <option value="order">Orders</option>
          <option value="settings">Settings</option>
          <option value="system">System</option>
        </select>
        <select
          value={filters.severity}
          onChange={(e) => { setFilters({ ...filters, severity: e.target.value }); setPage(1); }}
          className="input-field flex-1 sm:flex-none sm:w-auto text-xs py-2"
        >
          <option value="">All Severity</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <button onClick={fetchLogs} className="btn-secondary w-full sm:w-auto text-xs py-2">Refresh</button>
      </div>

      {/* Logs Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-700">
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-300">Time</th>
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-300">User</th>
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-300">Action</th>
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-300">Target</th>
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-300">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-300">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-surface-400">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-surface-400">No logs found</td></tr>
              ) : (
                logs.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      onClick={() => expandLog(log.id)}
                      className="hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 text-xs text-surface-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-surface-900 dark:text-white">
                        {log.user_name || log.user_email || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-xs bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded text-surface-700 dark:text-surface-300">
                          {log.action}
                        </code>
                      </td>
                      <td className="py-3 px-4 text-sm text-surface-500">
                        {log.target_label || (log.target_type ? `${log.target_type}#${log.target_id}` : '—')}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-medium ${statusColors[log.status]}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={severityColors[log.severity]}>{log.severity}</span>
                      </td>
                    </tr>
                    {expandedId === log.id && expandedDetails && (
                      <tr key={`${log.id}-details`}>
                        <td colSpan={6} className="bg-surface-50 dark:bg-surface-800/30 px-6 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                            <div><span className="text-surface-500">Source:</span> <span className="text-surface-900 dark:text-white">{expandedDetails.source}</span></div>
                            <div><span className="text-surface-500">IP:</span> <span className="text-surface-900 dark:text-white">{expandedDetails.ip_address}</span></div>
                            <div><span className="text-surface-500">Category:</span> <span className="text-surface-900 dark:text-white">{expandedDetails.category}</span></div>
                            <div><span className="text-surface-500">Session:</span> <span className="text-surface-900 dark:text-white font-mono text-xs">{expandedDetails.session_id || '—'}</span></div>
                          </div>
                          {expandedDetails.details && (
                            <div className="mb-4">
                              <p className="text-xs font-semibold text-surface-500 mb-1">Details</p>
                              <pre className="text-xs bg-surface-100 dark:bg-surface-900 p-3 rounded-lg overflow-x-auto text-surface-700 dark:text-surface-300">
                                {JSON.stringify(typeof expandedDetails.details === 'string' ? JSON.parse(expandedDetails.details) : expandedDetails.details, null, 2)}
                              </pre>
                            </div>
                          )}
                          {expandedDetails.fieldChanges?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-surface-500 mb-2">Field Changes</p>
                              <div className="space-y-1">
                                {expandedDetails.fieldChanges.map((fc, i) => (
                                  <div key={i} className="flex items-center gap-3 text-xs">
                                    <span className="font-medium text-surface-700 dark:text-surface-300 w-32">{fc.field_name}</span>
                                    <span className="text-red-500 line-through">{fc.old_value || '(empty)'}</span>
                                    <span className="text-surface-400">→</span>
                                    <span className="text-emerald-500">{fc.new_value || '(empty)'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-surface-200 dark:border-surface-700">
          <Pagination
            page={pagination.page || page}
            totalPages={pagination.totalPages || 1}
            totalItems={pagination.total || 0}
            itemsPerPage={limit}
            onPageChange={setPage}
            onItemsPerPageChange={(l) => { setLimit(l); setPage(1); }}
            itemsPerPageOptions={[15, 30, 50, 100]}
            label="logs"
          />
        </div>
      </div>
    </div>
  );
}
