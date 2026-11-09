import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { toast } from '../ui/Toast';
import { usePermission } from '../../hooks/usePermission';
import { useBranding } from '../../context/BrandingContext';
import { HiOutlineSave, HiOutlineTrash, HiOutlineMail, HiOutlineCheck, HiOutlineArchive } from 'react-icons/hi';

/**
 * CONTACT MANAGER (Storefront sub-module)
 * Everything shown on the storefront Contact page, plus the inbox for messages sent from its form.
 */

const KEYS = [
  'support_email', 'support_phone', 'whatsapp_number', 'store_address', 'store_address_ar', 'contact_map_url',
  'contact_title_en', 'contact_title_ar', 'contact_text_en', 'contact_text_ar', 'contact_hours_en', 'contact_hours_ar',
  'social_instagram', 'social_facebook', 'social_tiktok', 'social_youtube', 'social_x', 'social_snapchat',
];

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 disabled:opacity-60';
const labelCls = 'block text-[11px] uppercase tracking-wider text-surface-500 mb-1';
const cardCls = 'rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-4';

function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-surface-500 mt-1">{hint}</span>}
    </label>
  );
}

function Details({ canUpdate }) {
  const { refreshBranding } = useBranding();
  const [v, setV] = useState(Object.fromEntries(KEYS.map((k) => [k, ''])));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      const f = data.data?.flat || {};
      setV(Object.fromEntries(KEYS.map((k) => [k, f[k] ?? ''])));
    }).catch(() => toast.error('Failed to load contact details'));
  }, []);

  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const save = async () => {
    const urlKeys = ['contact_map_url', 'social_instagram', 'social_facebook', 'social_tiktok', 'social_youtube', 'social_x', 'social_snapchat'];
    for (const k of urlKeys) {
      if (v[k] && !/^https?:\/\//i.test(v[k].trim())) return toast.error(`"${k.replace(/_/g, ' ')}" must start with https://`);
    }
    try {
      setSaving(true);
      await api.put('/settings', Object.fromEntries(KEYS.map((k) => [k, String(v[k] ?? '').trim()])));
      toast.success('Contact details saved');
      refreshBranding?.();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save contact details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Contact page details</h3>
          <p className="text-xs text-surface-500">Shown on the Contact page and the footer. Leave a field empty to hide it on the website.</p>
        </div>
        {canUpdate && (
          <button type="button" onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 text-sm">
            <HiOutlineSave className="w-4 h-4" /> {saving ? 'Saving…' : 'Save details'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Support email"><input className={inputCls} type="email" disabled={!canUpdate} value={v.support_email} onChange={set('support_email')} /></Field>
        <Field label="Phone"><input className={inputCls} disabled={!canUpdate} placeholder="+971 …" value={v.support_phone} onChange={set('support_phone')} /></Field>
        <Field label="WhatsApp number" hint="International format, e.g. +971501234567"><input className={inputCls} disabled={!canUpdate} value={v.whatsapp_number} onChange={set('whatsapp_number')} /></Field>
        <Field label="Address (English)"><input className={inputCls} disabled={!canUpdate} value={v.store_address} onChange={set('store_address')} /></Field>
        <Field label="Address (Arabic)"><input className={inputCls} dir="rtl" disabled={!canUpdate} value={v.store_address_ar} onChange={set('store_address_ar')} /></Field>
        <Field label="Google Maps link"><input className={inputCls} disabled={!canUpdate} placeholder="https://maps.google.com/…" value={v.contact_map_url} onChange={set('contact_map_url')} /></Field>
        <Field label="Page heading (English)"><input className={inputCls} disabled={!canUpdate} value={v.contact_title_en} onChange={set('contact_title_en')} /></Field>
        <Field label="Page heading (Arabic)"><input className={inputCls} dir="rtl" disabled={!canUpdate} value={v.contact_title_ar} onChange={set('contact_title_ar')} /></Field>
        <div className="hidden md:block" />
        <Field label="Intro text (English)" className="md:col-span-1"><textarea className={inputCls} rows={3} disabled={!canUpdate} value={v.contact_text_en} onChange={set('contact_text_en')} /></Field>
        <Field label="Intro text (Arabic)"><textarea className={inputCls} dir="rtl" rows={3} disabled={!canUpdate} value={v.contact_text_ar} onChange={set('contact_text_ar')} /></Field>
        <div className="hidden md:block" />
        <Field label="Support hours (English)"><input className={inputCls} disabled={!canUpdate} value={v.contact_hours_en} onChange={set('contact_hours_en')} /></Field>
        <Field label="Support hours (Arabic)"><input className={inputCls} dir="rtl" disabled={!canUpdate} value={v.contact_hours_ar} onChange={set('contact_hours_ar')} /></Field>
      </div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mt-5 mb-2">Social links (full https:// addresses)</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[['social_instagram', 'Instagram'], ['social_facebook', 'Facebook'], ['social_tiktok', 'TikTok'], ['social_youtube', 'YouTube'], ['social_x', 'X (Twitter)'], ['social_snapchat', 'Snapchat']].map(([k, label]) => (
          <Field key={k} label={label}><input className={inputCls} disabled={!canUpdate} placeholder="https://" value={v[k]} onChange={set(k)} /></Field>
        ))}
      </div>
    </div>
  );
}

const PAY_OPTIONS = [['cod', 'Cash on delivery'], ['visa', 'Visa'], ['mastercard', 'Mastercard'], ['amex', 'American Express'], ['applepay', 'Apple Pay'], ['tabby', 'Tabby'], ['tamara', 'Tamara']];
const PROMISE_KEYS = ['promise_kicker_en', 'promise_kicker_ar', 'promise_title_en', 'promise_title_ar',
  ...[1, 2, 3, 4].flatMap((n) => [`promise_${n}_title_en`, `promise_${n}_title_ar`, `promise_${n}_text_en`, `promise_${n}_text_ar`])];
const TRUST_KEYS = ['footer_payment_methods', 'tax_trn', ...PROMISE_KEYS];

/* Footer payment badges, TRN and the home page "Our promise" block */
function Trust({ canUpdate }) {
  const { refreshBranding } = useBranding();
  const [v, setV] = useState(Object.fromEntries(TRUST_KEYS.map((k) => [k, ''])));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      const f = data.data?.flat || {};
      setV(Object.fromEntries(TRUST_KEYS.map((k) => [k, f[k] ?? ''])));
    }).catch(() => toast.error('Failed to load trust settings'));
  }, []);

  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const pays = String(v.footer_payment_methods || '').split(',').map((x) => x.trim()).filter(Boolean);
  const togglePay = (k) => setV((s) => {
    const cur = String(s.footer_payment_methods || '').split(',').map((x) => x.trim()).filter(Boolean);
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
    return { ...s, footer_payment_methods: next.join(',') };
  });
  const save = async () => {
    try {
      setSaving(true);
      await api.put('/settings', Object.fromEntries(TRUST_KEYS.map((k) => [k, String(v[k] ?? '').trim()])));
      toast.success('Trust settings saved');
      refreshBranding?.();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save trust settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Trust &amp; footer</h3>
          <p className="text-xs text-surface-500">Payment badges and TRN in the footer, and the "Our promise" block on the home page.</p>
        </div>
        {canUpdate && (
          <button type="button" onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 text-sm">
            <HiOutlineSave className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>

      <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-2">Footer</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-1">
        <Field label="Tax registration number (TRN)" hint="Shown in the footer. Leave empty to hide it.">
          <input className={inputCls} disabled={!canUpdate} value={v.tax_trn} onChange={set('tax_trn')} placeholder="15 digits" />
        </Field>
        <div className="md:col-span-2">
          <span className={labelCls}>Payment badges in the footer</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
            {PAY_OPTIONS.map(([k, label]) => (
              <label key={k} className="inline-flex items-center gap-2 text-sm text-surface-800 dark:text-surface-200">
                <input type="checkbox" disabled={!canUpdate} checked={pays.includes(k)} onChange={() => togglePay(k)} /> {label}
              </label>
            ))}
          </div>
          <span className="block text-[11px] text-surface-500 mt-1">Only tick the methods you really accept at checkout.</span>
        </div>
      </div>

      <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-500 mt-5 mb-1">Home page: "Our promise"</h4>
      <p className="text-[11px] text-surface-500 mb-2">You can use {'{free_over}'}, {'{delivery_days}'} and {'{refund_days}'} in the texts. They are replaced with your delivery and refund settings. Clear a pillar's title to hide it; clear the heading to hide the whole block.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Small heading (English)"><input className={inputCls} disabled={!canUpdate} value={v.promise_kicker_en} onChange={set('promise_kicker_en')} /></Field>
        <Field label="Small heading (Arabic)"><input className={inputCls} dir="rtl" disabled={!canUpdate} value={v.promise_kicker_ar} onChange={set('promise_kicker_ar')} /></Field>
        <Field label="Heading (English)"><input className={inputCls} disabled={!canUpdate} value={v.promise_title_en} onChange={set('promise_title_en')} /></Field>
        <Field label="Heading (Arabic)"><input className={inputCls} dir="rtl" disabled={!canUpdate} value={v.promise_title_ar} onChange={set('promise_title_ar')} /></Field>
      </div>
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="mt-4 rounded-lg border border-surface-200 dark:border-surface-800 p-3">
          <p className="text-xs font-semibold text-surface-600 mb-2">Pillar {n}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Title (English)"><input className={inputCls} disabled={!canUpdate} value={v[`promise_${n}_title_en`]} onChange={set(`promise_${n}_title_en`)} /></Field>
            <Field label="Title (Arabic)"><input className={inputCls} dir="rtl" disabled={!canUpdate} value={v[`promise_${n}_title_ar`]} onChange={set(`promise_${n}_title_ar`)} /></Field>
            <Field label="Text (English)"><textarea className={inputCls} rows={2} disabled={!canUpdate} value={v[`promise_${n}_text_en`]} onChange={set(`promise_${n}_text_en`)} /></Field>
            <Field label="Text (Arabic)"><textarea className={inputCls} dir="rtl" rows={2} disabled={!canUpdate} value={v[`promise_${n}_text_ar`]} onChange={set(`promise_${n}_text_ar`)} /></Field>
          </div>
        </div>
      ))}
    </div>
  );
}

function Inbox({ canUpdate }) {
  const [data, setData] = useState({ messages: [], counts: { new: 0, read: 0, archived: 0 } });
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get('/contact-messages', { params: { status: status || undefined, limit: 50 } });
      setData(d.data);
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const mark = async (m, s) => {
    try {
      await api.put(`/contact-messages/${m.id}/status`, { status: s });
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update message');
    }
  };
  const remove = async (m) => {
    if (!window.confirm(`Delete the message from ${m.name}?`)) return;
    try {
      await api.delete(`/contact-messages/${m.id}`);
      setOpen(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to delete message');
    }
  };
  const toggle = (m) => {
    setOpen(open === m.id ? null : m.id);
    if (m.status === 'new' && canUpdate) mark(m, 'read');
  };

  const tabs = [['', 'All'], ['new', `New (${data.counts.new})`], ['read', 'Read'], ['archived', 'Archived']];
  return (
    <div className={cardCls}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 inline-flex items-center gap-2"><HiOutlineMail className="w-4 h-4" /> Messages from the contact form</h3>
        <div className="flex gap-1.5">
          {tabs.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setStatus(k)}
              className={`px-3 py-1 rounded-lg text-xs border ${status === k ? 'bg-primary-600 text-white border-primary-600' : 'border-surface-300 dark:border-surface-700 text-surface-600 dark:text-surface-300'}`}>{label}</button>
          ))}
        </div>
      </div>
      {loading ? <p className="text-sm text-surface-500">Loading…</p> : data.messages.length === 0 ? (
        <p className="text-sm text-surface-500">No messages yet.</p>
      ) : (
        <ul className="divide-y divide-surface-200 dark:divide-surface-800">
          {data.messages.map((m) => (
            <li key={m.id} className="py-2">
              <button type="button" onClick={() => toggle(m)} className="w-full text-left flex items-start justify-between gap-3">
                <span>
                  <span className={`text-sm ${m.status === 'new' ? 'font-semibold' : 'font-medium'} text-surface-900 dark:text-surface-100`}>
                    {m.status === 'new' && <span className="inline-block w-2 h-2 rounded-full bg-primary-600 mr-2" />}{m.name}
                    <span className="font-normal text-surface-500"> · {m.email}</span>
                  </span>
                  <span className="block text-xs text-surface-500 truncate max-w-[60ch]">{m.message}</span>
                </span>
                <span className="text-[11px] text-surface-500 whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</span>
              </button>
              {open === m.id && (
                <div className="mt-2 rounded-lg bg-surface-50 dark:bg-surface-800 p-3 text-sm space-y-2">
                  {m.subject && <p className="font-medium">{m.subject}</p>}
                  <p className="whitespace-pre-wrap text-surface-800 dark:text-surface-200">{m.message}</p>
                  <p className="text-xs text-surface-500">{m.email}{m.phone ? ` · ${m.phone}` : ''}</p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <a href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + (m.subject || 'Your message to ALAYNAAS'))}`} className="text-sm text-primary-600 hover:underline">Reply by email</a>
                    {canUpdate && m.status !== 'archived' && <button type="button" onClick={() => mark(m, 'archived')} className="inline-flex items-center gap-1 text-sm text-surface-600 hover:underline"><HiOutlineArchive className="w-4 h-4" /> Archive</button>}
                    {canUpdate && m.status === 'read' && <button type="button" onClick={() => mark(m, 'new')} className="inline-flex items-center gap-1 text-sm text-surface-600 hover:underline"><HiOutlineCheck className="w-4 h-4" /> Mark unread</button>}
                    {canUpdate && <button type="button" onClick={() => remove(m)} className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline ml-auto"><HiOutlineTrash className="w-4 h-4" /> Delete</button>}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ContactManager() {
  const canUpdate = usePermission('settings.update');
  return (
    <div className="space-y-4">
      <Details canUpdate={canUpdate} />
      <Trust canUpdate={canUpdate} />
      <Inbox canUpdate={canUpdate} />
    </div>
  );
}
