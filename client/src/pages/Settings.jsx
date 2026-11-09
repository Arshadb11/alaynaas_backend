import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { toast } from '../components/ui/Toast';
import { usePermission } from '../hooks/usePermission';
import { useBranding } from '../context/BrandingContext';
import {
  HiOutlineCog,
  HiOutlineOfficeBuilding,
  HiOutlinePhotograph,
  HiOutlineTruck,
  HiOutlineReceiptTax,
  HiOutlineDocumentText,
  HiOutlineMail,
  HiOutlineLightningBolt,
  HiOutlineSave,
  HiOutlineRefresh,
  HiOutlineUpload,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineServer,
  HiOutlineDatabase,
  HiOutlineShieldCheck,
  HiOutlineColorSwatch,
  HiOutlineExternalLink,
} from 'react-icons/hi';

const TABS = [
  { id: 'general', label: 'Store Details', icon: HiOutlineOfficeBuilding },
  { id: 'branding', label: 'Branding & Logos', icon: HiOutlinePhotograph },
  { id: 'shipping', label: 'Shipping & Delivery', icon: HiOutlineTruck },
  { id: 'tax', label: 'Tax & VAT', icon: HiOutlineReceiptTax },
  { id: 'invoices', label: 'Invoices', icon: HiOutlineDocumentText },
  { id: 'email', label: 'Email & SMTP', icon: HiOutlineMail },
  { id: 'system', label: 'Cache & System', icon: HiOutlineLightningBolt },
];

export default function Settings() {
  const { refreshBranding } = useBranding();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({});
  const [metrics, setMetrics] = useState(null);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [optimizeLoading, setOptimizeLoading] = useState(false);
  const [trashLoading, setTrashLoading] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);

  const canUpdate = usePermission('settings.update');
  const fileInputRef = useRef(null);
  const [uploadTargetKey, setUploadTargetKey] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'system') {
      fetchMetrics();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/settings');
      if (data?.data?.flat) {
        setSettings(data.data.flat);
      }
    } catch {
      toast.error('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const { data } = await api.get('/settings/system/metrics');
      setMetrics(data.data);
    } catch {
      // Ignore
    }
  };

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      await api.put('/settings', settings);
      toast.success('Settings saved and synchronized successfully');
      fetchSettings();
      refreshBranding();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerUpload = (key) => {
    setUploadTargetKey(key);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetKey) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('key', uploadTargetKey);

    try {
      setUploading(true);
      const { data } = await api.post('/settings/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (data.data?.url) {
        handleChange(uploadTargetKey, data.data.url);
        toast.success(`${uploadTargetKey.replace(/_/g, ' ')} uploaded successfully`);
        refreshBranding();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload asset');
    } finally {
      setUploading(false);
      setUploadTargetKey(null);
    }
  };

  const handleFlushCache = async () => {
    try {
      setCacheLoading(true);
      const { data } = await api.post('/settings/cache/flush');
      toast.success(`Cache flushed successfully (${data.data?.clearedKeys || 0} keys cleared)`);
    } catch {
      toast.error('Failed to flush cache');
    } finally {
      setCacheLoading(false);
    }
  };

  // Permanently delete all trashed products & orders
  const handleEmptyTrash = async () => {
    if (!window.confirm('Permanently delete ALL trashed products and orders? This cannot be undone.')) return;
    try {
      setTrashLoading(true);
      const { data } = await api.post('/settings/trash/empty');
      const r = data.data || {};
      let msg = `Trash emptied: ${r.productsPurged || 0} product(s), ${r.ordersPurged || 0} order(s) deleted`;
      if (r.productsBlocked) msg += ` (${r.productsBlocked} product(s) kept because they exist in past orders)`;
      toast.success(msg);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to empty trash');
    } finally {
      setTrashLoading(false);
    }
  };

  const handleOptimizeDb = async () => {
    try {
      setOptimizeLoading(true);
      const { data } = await api.post('/settings/system/optimize');
      toast.success('Database tables optimized and defragmented successfully');
      fetchMetrics();
    } catch {
      toast.error('Failed to optimize database');
    } finally {
      setOptimizeLoading(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      setTestEmailLoading(true);
      const { data } = await api.post('/email/test');
      toast.success(data.message || 'SMTP connectivity test passed');
    } catch {
      toast.error('SMTP test failed. Check credentials.');
    } finally {
      setTestEmailLoading(false);
    }
  };

  const renderAssetUploadCard = (title, key, description, sizeKey = null) => {
    const currentVal = settings[key] || '';
    const isFullUrl = currentVal.startsWith('http');
    const displayUrl = isFullUrl ? currentVal : `http://localhost:3000${currentVal.startsWith('/') ? '' : '/'}${currentVal}`;

    return (
      <div className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-850 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-100">{title}</h4>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-200/60 dark:bg-surface-700/60 text-surface-600 dark:text-surface-300">
              {key}
            </span>
          </div>
          <p className="text-xs text-surface-500 dark:text-surface-400 mb-4">{description}</p>
        </div>

        <div className="space-y-3">
          <div className="h-20 w-full rounded-lg bg-surface-100 dark:bg-surface-900 border border-dashed border-surface-300 dark:border-surface-700 flex items-center justify-center p-2 overflow-hidden">
            {currentVal ? (
              <img
                src={displayUrl}
                alt={title}
                className="max-h-full max-w-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <span className="text-xs text-surface-400">No asset configured</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canUpdate || uploading}
              onClick={() => handleTriggerUpload(key)}
              className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <HiOutlineUpload className="w-3.5 h-3.5" />
              <span>{uploading && uploadTargetKey === key ? 'Uploading…' : 'Upload File'}</span>
            </button>
            {currentVal && (
              <a
                href={displayUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg border border-surface-300 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition"
                title="Preview Asset"
              >
                <HiOutlineExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>

          {sizeKey && (
            <label className="flex items-center justify-between gap-2 text-xs text-surface-600 dark:text-surface-300">
              <span>Display height (px)</span>
              <input
                type="number"
                min="12"
                max="200"
                disabled={!canUpdate}
                value={settings[sizeKey] ?? ''}
                onChange={(e) => handleChange(sizeKey, e.target.value === '' ? '' : Number(e.target.value))}
                className="w-20 px-2 py-1 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-right"
              />
            </label>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-surface-500">
          <HiOutlineRefresh className="w-6 h-6 animate-spin text-primary-500" />
          <span className="text-sm font-medium">Loading system settings…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Hidden File Input for Branding Uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".svg,.png,.jpg,.jpeg,.webp,.ico"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-surface-200 dark:border-surface-800">
        <div>
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 text-sm font-semibold mb-1">
            <HiOutlineCog className="w-5 h-5" />
            <span>SYSTEM CONFIGURATION</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-50">
            Settings & Global Preferences
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Manage your luxury storefront identity, branding assets, tax, courier rules, and infrastructure.
          </p>
        </div>

        {canUpdate && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-primary-600 hover:bg-primary-700 text-white shadow-sm hover:shadow transition disabled:opacity-50"
            >
              <HiOutlineSave className="w-4 h-4" />
              <span>{saving ? 'Synchronizing…' : 'Save Changes'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto pb-2 scrollbar-none border-b border-surface-200 dark:border-surface-800 gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800/80 shadow-2xs'
                  : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-850'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Settings Form Container */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. STORE & GENERAL DETAILS */}
        {activeTab === 'general' && (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-6 space-y-6 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">Storefront Identity</h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">Core business info presented to customers on the website, footer, and communications.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Storefront Name
                </label>
                <input
                  type="text"
                  value={settings.store_name || ''}
                  onChange={(e) => handleChange('store_name', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                  placeholder="e.g. ALAYNAAS"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Brand Tagline
                </label>
                <input
                  type="text"
                  value={settings.store_tagline || ''}
                  onChange={(e) => handleChange('store_tagline', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                  placeholder="For those who carry the crown"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Customer Support Email
                </label>
                <input
                  type="email"
                  value={settings.support_email || ''}
                  onChange={(e) => handleChange('support_email', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                  placeholder="concierge@alaynaas.ae"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Customer Concierge Phone
                </label>
                <input
                  type="text"
                  value={settings.support_phone || ''}
                  onChange={(e) => handleChange('support_phone', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                  placeholder="+971 50 123 4567"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  WhatsApp Direct Support
                </label>
                <input
                  type="text"
                  value={settings.whatsapp_number || ''}
                  onChange={(e) => handleChange('whatsapp_number', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                  placeholder="+971501234567"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Federal Tax Registration (TRN)
                </label>
                <input
                  type="text"
                  value={settings.tax_trn || ''}
                  onChange={(e) => handleChange('tax_trn', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none font-mono"
                  placeholder="100234567800003"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Showroom & Flagship Boutique Address
                </label>
                <textarea
                  rows={2}
                  value={settings.store_address || ''}
                  onChange={(e) => handleChange('store_address', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                  placeholder="Al Wasl Road, Jumeirah 2, Dubai, United Arab Emirates"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Default Settlement Currency
                </label>
                <input
                  type="text"
                  value={settings.default_currency || 'AED'}
                  onChange={(e) => handleChange('default_currency', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Operational Timezone
                </label>
                <input
                  type="text"
                  value={settings.timezone || 'Asia/Dubai'}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. BRANDING & LOGOS */}
        {activeTab === 'branding' && (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-6 space-y-6 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">Visual Identity & Assets</h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Upload luxury logos, favicons, and customize accent colors across both the storefront and admin panel.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {renderAssetUploadCard('Frontend Logo (Light)', 'frontend_logo', 'Main logo displayed on light headers & checkout.', 'frontend_logo_height')}
              {renderAssetUploadCard('Frontend Logo (Dark)', 'frontend_logo_dark', 'Inverted logo for transparent or dark headers (shares header height).', 'frontend_logo_height')}
              {renderAssetUploadCard('Storefront Footer Logo', 'footer_logo', 'Displayed in customer storefront footer.', 'footer_logo_height')}
              {renderAssetUploadCard('Admin Panel Logo', 'admin_logo', 'Displayed in admin panel sidebar & login page.', 'admin_logo_height')}
              {renderAssetUploadCard('Browser Favicon', 'favicon', '32x32 or SVG icon in browser tabs.')}
            </div>

            <div className="pt-4 border-t border-surface-200 dark:border-surface-800">
              <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                Primary Brand Accent Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.primary_brand_color || '#D4AF37'}
                  onChange={(e) => handleChange('primary_brand_color', e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-surface-300 dark:border-surface-700 p-0.5 bg-white dark:bg-surface-850"
                />
                <input
                  type="text"
                  value={settings.primary_brand_color || '#D4AF37'}
                  onChange={(e) => handleChange('primary_brand_color', e.target.value)}
                  className="w-32 px-3 py-2 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 font-mono"
                />
                <span className="text-xs text-surface-500">Luxury Gold Default: #D4AF37</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. SHIPPING & DELIVERY */}
        {activeTab === 'shipping' && (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-6 space-y-6 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">Courier & Shipping Rules</h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">Configure delivery charges, free delivery incentives, and SLA expectations.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Standard Courier Delivery Fee (AED)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.shipping_fee ?? 20}
                  onChange={(e) => handleChange('shipping_fee', Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                />
                <p className="text-[11px] text-surface-400 mt-1">Charged on orders below the free shipping threshold.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Free Shipping Minimum Cart Value (AED)
                </label>
                <input
                  type="number"
                  step="10"
                  value={settings.shipping_free_over ?? 300}
                  onChange={(e) => handleChange('shipping_free_over', Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                />
                <p className="text-[11px] text-surface-400 mt-1">Orders at or above this amount automatically receive 100% free delivery.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Delivery SLA Customer Banner Text
                </label>
                <input
                  type="text"
                  value={settings.shipping_estimate_text || ''}
                  onChange={(e) => handleChange('shipping_estimate_text', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                  placeholder="Delivered across the UAE in 1–3 working days"
                />
              </div>

              <div className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-850 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-surface-900 dark:text-surface-100 block">Offer Same-Day / Express Delivery</span>
                  <span className="text-xs text-surface-500">Allows Dubai customers to select VIP same-day courier dispatch.</span>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.enable_express_delivery)}
                  onChange={(e) => handleChange('enable_express_delivery', e.target.checked)}
                  className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Express VIP Delivery Surcharge (AED)
                </label>
                <input
                  type="number"
                  step="5"
                  value={settings.express_delivery_fee ?? 45}
                  onChange={(e) => handleChange('express_delivery_fee', Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* 4. TAX & VAT */}
        {activeTab === 'tax' && (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-6 space-y-6 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">Tax & VAT Configuration</h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">Configure value-added tax rates and compliant invoice calculation modes.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Standard VAT Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.tax_percentage ?? 5.0}
                  onChange={(e) => handleChange('tax_percentage', Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none font-mono"
                />
                <p className="text-[11px] text-surface-400 mt-1">UAE statutory VAT rate is 5.00%.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Tax Line Item Label on Invoices
                </label>
                <input
                  type="text"
                  value={settings.tax_label || 'UAE VAT (5%)'}
                  onChange={(e) => handleChange('tax_label', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                />
              </div>

              <div className="md:col-span-2 p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-850 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-surface-900 dark:text-surface-100 block">
                    Display Prices Inclusive of VAT on Storefront
                  </span>
                  <span className="text-xs text-surface-500">
                    Recommended for UAE retail compliance (e.g. 200 AED price already contains the 5% VAT portion).
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.tax_inclusive_pricing)}
                  onChange={(e) => handleChange('tax_inclusive_pricing', e.target.checked)}
                  className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. INVOICES */}
        {activeTab === 'invoices' && (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-6 space-y-6 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">Tax Invoices & PDF Printing</h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">Customize generated tax invoices and courier packing slips.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Invoice Number Prefix
                </label>
                <input
                  type="text"
                  value={settings.invoice_prefix || 'AM-INV-'}
                  onChange={(e) => handleChange('invoice_prefix', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Legal Registered Entity Name
                </label>
                <input
                  type="text"
                  value={settings.invoice_legal_company || ''}
                  onChange={(e) => handleChange('invoice_legal_company', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100"
                  placeholder="Alaynaas Luxury Perfumes LLC"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Invoice Footer Terms & Return Policy
                </label>
                <textarea
                  rows={3}
                  value={settings.invoice_terms || ''}
                  onChange={(e) => handleChange('invoice_terms', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 text-surface-900 dark:text-surface-100"
                />
              </div>

              <div className="md:col-span-2 p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-850 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-surface-900 dark:text-surface-100 block">Print Brand Logo on Invoices</span>
                  <span className="text-xs text-surface-500">Includes official header emblem on customer printable tax receipts.</span>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.invoice_show_logo)}
                  onChange={(e) => handleChange('invoice_show_logo', e.target.checked)}
                  className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* 6. EMAIL & SMTP */}
        {activeTab === 'email' && (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-6 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">Email & Dispatch Notifications</h3>
                <p className="text-xs text-surface-500 dark:text-surface-400">Configure SMTP email server settings and customer notification templates.</p>
              </div>
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={testEmailLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-surface-300 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 transition"
              >
                <HiOutlineMail className="w-4 h-4 text-primary-500" />
                <span>{testEmailLoading ? 'Testing…' : 'Send Test Ping'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  SMTP Host
                </label>
                <input
                  type="text"
                  value={settings.smtp_host || ''}
                  onChange={(e) => handleChange('smtp_host', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 font-mono"
                  placeholder="smtp.mailgun.org"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  SMTP Port
                </label>
                <input
                  type="number"
                  value={settings.smtp_port ?? 587}
                  onChange={(e) => handleChange('smtp_port', Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  From Email
                </label>
                <input
                  type="email"
                  value={settings.smtp_from_email || ''}
                  onChange={(e) => handleChange('smtp_from_email', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850"
                  placeholder="concierge@alaynaas.ae"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  SMTP Username
                </label>
                <input
                  type="text"
                  value={settings.smtp_user || ''}
                  onChange={(e) => handleChange('smtp_user', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  SMTP Password
                </label>
                <input
                  type="password"
                  value={settings.smtp_password || ''}
                  onChange={(e) => handleChange('smtp_password', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  From Display Name
                </label>
                <input
                  type="text"
                  value={settings.smtp_from_name || 'ALAYNAAS Concierge'}
                  onChange={(e) => handleChange('smtp_from_name', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                  Order Confirmation Notification Template
                </label>
                <textarea
                  rows={4}
                  value={settings.email_order_confirmed_template || ''}
                  onChange={(e) => handleChange('email_order_confirmed_template', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-850 font-mono text-xs leading-relaxed"
                />
                <p className="text-[11px] text-surface-400 mt-1">Available variables: {'{customer_name}'}, {'{order_number}'}, {'{total_amount}'}, {'{currency}'}, {'{delivery_address}'}.</p>
              </div>
            </div>
          </div>
        )}

        {/* 7. CACHE & SYSTEM OPTIMIZATION */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-6 space-y-6 shadow-xs">
              <div>
                <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">Performance & Caching</h3>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Manage high-speed Redis caching, Next.js ISR on-demand revalidation, and MySQL table defragmentation.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-850 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                      <HiOutlineLightningBolt className="w-4 h-4 text-amber-500" />
                      <span>Purge Storefront & Redis Cache</span>
                    </h4>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                      Flushes cached catalog products, prices, and public settings across all nodes.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={cacheLoading || !canUpdate}
                    onClick={handleFlushCache}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition disabled:opacity-50"
                  >
                    {cacheLoading ? 'Purging…' : 'Flush Cache'}
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-850 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                      <HiOutlineExclamationCircle className="w-4 h-4 text-red-500" />
                      <span>Empty Trash</span>
                    </h4>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                      Permanently deletes all trashed products and orders now, instead of waiting for the 5-day auto-purge.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={trashLoading || !canUpdate}
                    onClick={handleEmptyTrash}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50"
                  >
                    {trashLoading ? 'Deleting…' : 'Empty Trash'}
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-850 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                      <HiOutlineDatabase className="w-4 h-4 text-primary-500" />
                      <span>Optimize Database Tables</span>
                    </h4>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                      Reclaims unused space and re-indexes orders, products, and pricing tables in MySQL.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={optimizeLoading || !canUpdate}
                    onClick={handleOptimizeDb}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white transition disabled:opacity-50"
                  >
                    {optimizeLoading ? 'Optimizing…' : 'Optimize DB'}
                  </button>
                </div>
              </div>

              {/* Maintenance Mode Card */}
              <div className="p-4 rounded-xl border border-red-200/60 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-red-900 dark:text-red-200 flex items-center gap-2">
                      <HiOutlineExclamationCircle className="w-5 h-5 text-red-600" />
                      <span>Storefront Maintenance Mode</span>
                    </span>
                    <span className="text-xs text-red-600/80 dark:text-red-400/80">
                      When enabled, public visitors see an elegant branded maintenance holding page.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.maintenance_mode)}
                    onChange={(e) => handleChange('maintenance_mode', e.target.checked)}
                    className="w-5 h-5 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                </div>

                {settings.maintenance_mode && (
                  <div>
                    <label className="block text-xs font-semibold text-red-800 dark:text-red-300 mb-1">
                      Maintenance Notice to Customers
                    </label>
                    <textarea
                      rows={2}
                      value={settings.maintenance_message || ''}
                      onChange={(e) => handleChange('maintenance_message', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs border border-red-200 dark:border-red-900 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Live System Diagnostics */}
            {metrics && (
              <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                    <HiOutlineServer className="w-4 h-4 text-emerald-500" />
                    <span>Real-time System Metrics</span>
                  </h3>
                  <button
                    type="button"
                    onClick={fetchMetrics}
                    className="p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 hover:text-surface-600"
                    title="Refresh Metrics"
                  >
                    <HiOutlineRefresh className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-850 border border-surface-200/60 dark:border-surface-800">
                    <span className="text-[11px] font-medium text-surface-500 block">Node.js Version</span>
                    <span className="text-sm font-bold text-surface-900 dark:text-surface-100 font-mono">
                      {metrics.node_version}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-850 border border-surface-200/60 dark:border-surface-800">
                    <span className="text-[11px] font-medium text-surface-500 block">Server Uptime</span>
                    <span className="text-sm font-bold text-surface-900 dark:text-surface-100 font-mono">
                      {Math.floor(metrics.uptime_seconds / 3600)}h {Math.floor((metrics.uptime_seconds % 3600) / 60)}m
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-850 border border-surface-200/60 dark:border-surface-800">
                    <span className="text-[11px] font-medium text-surface-500 block">Memory (Heap Used)</span>
                    <span className="text-sm font-bold text-surface-900 dark:text-surface-100 font-mono">
                      {metrics.memory?.heap_used_mb} MB
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-850 border border-surface-200/60 dark:border-surface-800">
                    <span className="text-[11px] font-medium text-surface-500 block">MySQL Database</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Active</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
