import { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from '../ui/Toast';
import {
  getOrderStatusConfig,
  getPaymentStatusConfig,
  getPaymentMethodLabel,
} from '../../config/orderConfig';
import {
  HiOutlineX,
  HiOutlinePrinter,
  HiOutlineRefresh,
  HiOutlineCheckCircle,
  HiOutlineShieldCheck,
  HiOutlineGift,
} from 'react-icons/hi';

export function generateInvoicePrintHtml(invoice) {
  if (!invoice) return '';

  const formatCurrency = (val, code, dec = 2) => {
    const num = parseFloat(val) || 0;
    return `${num.toFixed(dec)} ${code || 'AED'}`;
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const currency = invoice.country?.currency_code || 'AED';
  const decimals = invoice.country?.decimal_places || 2;

  // Safe parsing for addresses
  const shipping = typeof invoice.shipping_address === 'string'
    ? JSON.parse(invoice.shipping_address || '{}')
    : invoice.shipping_address || {};

  const itemsRows = (invoice.items || []).map((item, idx) => {
    const bundleChildren = Array.isArray(item.bundle_items_snapshot)
      ? item.bundle_items_snapshot
      : typeof item.bundle_items_snapshot === 'string'
        ? JSON.parse(item.bundle_items_snapshot || '[]')
        : [];

    const bundleHtml = (item.is_bundle && bundleChildren.length > 0)
      ? `
        <div class="bundle-box">
          <div class="bundle-title">Discovery Set Assortment (${bundleChildren.length} items):</div>
          ${bundleChildren.map(b => `<div class="bundle-item">• ${b.name || b.product_name} ${b.size ? `(${b.size})` : ''} × ${b.quantity || 1}</div>`).join('')}
        </div>
      `
      : '';

    const arabicHtml = item.product_name_ar
      ? `<div class="item-ar" dir="rtl">${item.product_name_ar}</div>`
      : '';

    const sizeHtml = item.size_name
      ? `<div class="item-meta">Size: ${item.size_name}</div>`
      : '';

    return `
      <tr>
        <td class="col-num">${idx + 1}</td>
        <td class="col-desc">
          <div class="item-name">${item.product_name}</div>
          ${arabicHtml}
          ${sizeHtml}
          ${bundleHtml}
        </td>
        <td class="col-sku font-mono">${item.sku || '-'}</td>
        <td class="col-price font-mono">${parseFloat(item.unit_price || 0).toFixed(decimals)}</td>
        <td class="col-qty font-mono">${item.quantity}</td>
        <td class="col-total font-mono font-bold">${parseFloat(item.line_total || 0).toFixed(decimals)}</td>
      </tr>
    `;
  }).join('');

  const engravingHtml = invoice.gift_engraving_text
    ? `
      <div class="engraving-card">
        <div class="engraving-badge">Bespoke Laser Bottle Engraving</div>
        <div class="engraving-text">"${invoice.gift_engraving_text}"</div>
      </div>
    `
    : '';

  const discountHtml = parseFloat(invoice.financials?.discount_amount || 0) > 0
    ? `
      <div class="summary-line">
        <span>Promotional Discount</span>
        <span class="font-mono">-${formatCurrency(invoice.financials.discount_amount, currency, decimals)}</span>
      </div>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${invoice.invoice_number}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 14mm 10mm 14mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.4;
      padding: 0;
      margin: 0;
    }
    .font-mono {
      font-family: 'JetBrains Mono', Consolas, monospace;
    }
    .font-arabic {
      font-family: 'Tajawal', sans-serif;
    }
    .font-bold {
      font-weight: 700;
    }
    .invoice-wrapper {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }
    
    /* Header Table */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #09090b;
      margin-bottom: 2px;
    }
    .brand-arabic {
      font-family: 'Tajawal', sans-serif;
      font-size: 13px;
      color: #52525b;
      margin-bottom: 4px;
    }
    .seller-meta {
      font-size: 10px;
      color: #71717a;
      line-height: 1.45;
    }
    .seller-trn {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: #581c87;
      background: #faf5ff;
      border: 1px solid #e9d5ff;
      padding: 2px 6px;
      border-radius: 4px;
      margin-top: 4px;
      font-size: 10px;
    }
    .invoice-title-badge {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 10px;
      border-radius: 4px;
      margin-bottom: 6px;
    }
    .invoice-num {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 700;
      color: #09090b;
      margin-bottom: 2px;
    }
    .meta-line {
      font-size: 10px;
      color: #71717a;
      line-height: 1.4;
    }
    
    /* Address Cards */
    .address-grid {
      display: flex;
      gap: 14px;
      margin-bottom: 14px;
    }
    .address-card {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
    }
    .address-card-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }
    .address-name {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .address-detail {
      font-size: 10px;
      color: #475569;
      line-height: 1.4;
    }
    
    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    .items-table th {
      background: #f1f5f9;
      color: #0f172a;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 10px;
      border-bottom: 1.5px solid #0f172a;
      border-right: 1px solid #e2e8f0;
    }
    .items-table th:last-child {
      border-right: none;
    }
    .items-table td {
      padding: 7px 10px;
      border-bottom: 1px solid #e2e8f0;
      border-right: 1px solid #f1f5f9;
      vertical-align: top;
      font-size: 10.5px;
    }
    .items-table td:last-child {
      border-right: none;
    }
    .items-table tr:last-child td {
      border-bottom: none;
    }
    .col-num {
      width: 24px;
      text-align: center;
      color: #94a3b8;
    }
    .col-desc {
      text-align: left;
    }
    .col-sku {
      width: 90px;
      color: #64748b;
      font-size: 9.5px;
    }
    .col-price {
      width: 75px;
      text-align: right;
    }
    .col-qty {
      width: 35px;
      text-align: center;
      font-weight: 700;
    }
    .col-total {
      width: 85px;
      text-align: right;
      color: #0f172a;
    }
    .item-name {
      font-weight: 700;
      color: #09090b;
      font-size: 11px;
    }
    .item-ar {
      font-family: 'Tajawal', sans-serif;
      font-size: 9.5px;
      color: #71717a;
      margin-top: 1px;
    }
    .item-meta {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      color: #71717a;
      margin-top: 1px;
    }
    .bundle-box {
      margin-top: 4px;
      padding: 4px 8px;
      background: #faf5ff;
      border-left: 2px solid #8b5cf6;
      border-radius: 0 4px 4px 0;
      font-size: 9px;
    }
    .bundle-title {
      font-weight: 700;
      color: #6b21a8;
      margin-bottom: 2px;
    }
    .bundle-item {
      color: #581c87;
      line-height: 1.35;
    }

    /* Engraving Card */
    .engraving-card {
      margin-bottom: 12px;
      padding: 8px 12px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
    }
    .engraving-badge {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #92400e;
    }
    .engraving-text {
      font-family: Georgia, serif;
      font-style: italic;
      font-size: 11px;
      font-weight: 700;
      color: #78350f;
      margin-top: 2px;
    }

    /* Summary Section */
    .summary-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .payment-info-box {
      flex: 1;
      max-width: 290px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 9.5px;
    }
    .payment-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 5px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }
    .payment-detail {
      color: #334155;
      line-height: 1.5;
    }
    .financials-box {
      width: 260px;
      font-size: 10.5px;
    }
    .summary-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 3px 0;
      color: #475569;
    }
    .summary-line-total {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding-top: 6px;
      margin-top: 4px;
      border-top: 2px solid #0f172a;
      color: #09090b;
      font-weight: 800;
      font-size: 13px;
    }
    .summary-line-sub {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 3px;
      font-size: 9.5px;
      color: #64748b;
    }
    .summary-line-due {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 3px;
      font-size: 10px;
      font-weight: 700;
      color: #0f172a;
      border-top: 1px dashed #cbd5e1;
      margin-top: 4px;
    }

    /* Footer */
    .invoice-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      page-break-inside: avoid;
    }
    .compliance-text {
      font-size: 8.5px;
      color: #94a3b8;
      line-height: 1.4;
    }
    .signatory-box {
      text-align: right;
    }
    .signatory-line {
      width: 140px;
      border-bottom: 1px solid #0f172a;
      margin-bottom: 4px;
      margin-left: auto;
    }
    .signatory-label {
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td style="vertical-align: top; text-align: left;">
          <div class="brand-title">${invoice.seller?.company_name || 'Alaynaa\'s Parfums'}</div>
          <div class="brand-arabic" dir="rtl">${invoice.seller?.company_name_ar || 'أحمد المغربي للعطور ذ.م.م'}</div>
          <div class="seller-meta">
            ${invoice.seller?.address || ''}<br>
            Tel: ${invoice.seller?.phone || ''} · Email: ${invoice.seller?.email || ''}
          </div>
          <div class="seller-trn">${invoice.seller?.tax_registration_number || 'TRN 100234892100003'}</div>
        </td>
        <td style="vertical-align: top; text-align: right; width: 220px;">
          <div class="invoice-title-badge">Tax Invoice / فاتورة ضريبية</div>
          <div class="invoice-num font-mono">${invoice.invoice_number}</div>
          <div class="meta-line">Order Ref: <span class="font-mono font-bold">${invoice.order_number}</span></div>
          <div class="meta-line">Issue Date: ${formatDate(invoice.order_date)}</div>
          <div class="meta-line">Market: ${invoice.country?.name || 'UAE'} (${invoice.country?.code || 'AE'})</div>
        </td>
      </tr>
    </table>

    <!-- Addresses -->
    <div class="address-grid">
      <div class="address-card">
        <div class="address-card-title">Billed To (Customer Profile)</div>
        <div class="address-name">${invoice.customer?.name || '-'}</div>
        <div class="address-detail">${invoice.customer?.email || ''}</div>
        <div class="address-detail font-mono">${invoice.customer?.phone || ''}</div>
      </div>
      <div class="address-card">
        <div class="address-card-title">Delivery Destination</div>
        <div class="address-name">${shipping.recipient_name || invoice.customer?.name || '-'}</div>
        <div class="address-detail">
          ${shipping.address_line1 || ''}
          ${shipping.address_line2 ? `, ${shipping.address_line2}` : ''}
        </div>
        <div class="address-detail">
          ${shipping.city || ''}${shipping.state_province_emirate ? `, ${shipping.state_province_emirate}` : ''}, ${invoice.country?.name || ''}
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 24px; text-align: center;">#</th>
          <th style="text-align: left;">Item Description</th>
          <th style="width: 90px; text-align: left;">SKU</th>
          <th style="width: 75px; text-align: right;">Unit Price</th>
          <th style="width: 35px; text-align: center;">Qty</th>
          <th style="width: 85px; text-align: right;">Total (${currency})</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Engraving Callout -->
    ${engravingHtml}

    <!-- Financial & Payment Summary -->
    <div class="summary-section">
      <div class="payment-info-box">
        <div class="payment-title">Payment Terms & Gateway</div>
        <div class="payment-detail">
          Method: <strong style="text-transform: capitalize;">${(invoice.payment?.method || '').replace(/_/g, ' ')}</strong><br>
          Status: <strong style="text-transform: capitalize; color: ${invoice.payment?.status === 'paid' ? '#15803d' : '#0f172a'};">${invoice.payment?.status || 'unpaid'}</strong><br>
          <span style="color: #64748b; font-size: 8.5px; margin-top: 4px; display: block;">Currencies settled in designated sovereign regional currency units.</span>
        </div>
      </div>

      <div class="financials-box">
        <div class="summary-line">
          <span>Subtotal (Excl. VAT)</span>
          <span class="font-mono">${formatCurrency(invoice.financials?.subtotal, currency, decimals)}</span>
        </div>
        ${discountHtml}
        <div class="summary-line">
          <span>Courier Delivery Fee</span>
          <span class="font-mono">${formatCurrency(invoice.financials?.shipping_fee, currency, decimals)}</span>
        </div>
        <div class="summary-line">
          <span>VAT (${invoice.financials?.tax_percentage || 5}%)</span>
          <span class="font-mono">${formatCurrency(invoice.financials?.tax_amount, currency, decimals)}</span>
        </div>
        <div class="summary-line-total">
          <span>Total Amount Due</span>
          <span class="font-mono">${formatCurrency(invoice.financials?.total_amount, currency, decimals)}</span>
        </div>
        <div class="summary-line-sub">
          <span>Amount Paid</span>
          <span class="font-mono">${formatCurrency(invoice.financials?.total_paid, currency, decimals)}</span>
        </div>
        <div class="summary-line-due">
          <span>Balance Outstanding</span>
          <span class="font-mono">${formatCurrency(invoice.financials?.balance_due, currency, decimals)}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="invoice-footer">
      <div class="compliance-text">
        Alaynaa's Parfums · Certified Luxury Fragrance Formulation<br>
        FTA TRN: <strong>${invoice.seller?.tax_registration_number || '100234892100003'}</strong> · Official Tax Invoice
      </div>
      <div class="signatory-box">
        <div class="signatory-line"></div>
        <div class="signatory-label">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export default function OrderInvoiceModal({ orderId, isOpen, onClose }) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (isOpen && orderId) {
      fetchInvoice();
    }
  }, [isOpen, orderId]);

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/orders/${orderId}/invoice`);
      setInvoice(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to fetch invoice details');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!invoice || printing) return;

    setPrinting(true);

    // Create an isolated invisible print iframe
    const iframe = document.createElement('iframe');
    iframe.name = 'ahmed-perfume-invoice-frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.opacity = '0';
    iframe.style.border = 'none';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      setPrinting(false);
      return;
    }

    const printHtml = generateInvoicePrintHtml(invoice);
    doc.open();
    doc.write(printHtml);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Invoice printing failed:', err);
      } finally {
        setPrinting(false);
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }
    }, 350);
  };

  // Keyboard shortcut: Ctrl+P / Cmd+P while modal is active
  useEffect(() => {
    if (!isOpen || !invoice) return;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, invoice, printing]);

  if (!isOpen) return null;

  const formatCurrency = (val, code, dec = 2) => {
    const num = parseFloat(val) || 0;
    return `${num.toFixed(dec)} ${code || 'AED'}`;
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-surface-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-800 flex flex-col max-h-[94vh] overflow-hidden animate-scale-up">
        {/* ── Top Bar Controls ── */}
        <div className="px-6 py-3.5 border-b border-surface-200/80 dark:border-surface-800 flex items-center justify-between bg-surface-50/80 dark:bg-surface-850/80 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0" />
            <span className="text-xs font-bold text-surface-900 dark:text-white uppercase tracking-wider">
              Commercial Tax Invoice & Packing Slip
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !invoice || printing}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all disabled:opacity-50"
            >
              {printing ? (
                <>
                  <HiOutlineRefresh className="w-4 h-4 animate-spin" />
                  <span>Preparing Print...</span>
                </>
              ) : (
                <>
                  <HiOutlinePrinter className="w-4 h-4" />
                  <span>Print A4 Invoice</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              <HiOutlineX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Scrollable Document Body ── */}
        <div className="overflow-y-auto p-6 sm:p-8 flex-1 print:p-0 print:overflow-visible">
          {loading ? (
            <div className="py-24 text-center">
              <HiOutlineRefresh className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
              <p className="text-xs text-surface-500">Preparing luxury commercial invoice...</p>
            </div>
          ) : invoice ? (
            <div
              id="printable-invoice"
              className="bg-white text-surface-900 dark:bg-surface-900 dark:text-surface-100 print:bg-white print:text-black space-y-6 font-sans text-xs"
            >
              {/* 1. Brand Luxury Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b-2 border-surface-900 dark:border-surface-700 print:border-black">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-surface-950 dark:text-white print:text-black">
                    Alaynaa's Parfums
                  </h1>
                  <p className="font-arabic text-sm text-surface-600 dark:text-surface-400 print:text-gray-700 mt-0.5" dir="rtl">
                    أحمد المغربي للعطور ذ.م.م
                  </p>
                  <p className="text-[11px] text-surface-500 print:text-gray-600 mt-2">
                    {invoice.seller.address}
                  </p>
                  <p className="text-[11px] text-surface-500 print:text-gray-600">
                    Tel: {invoice.seller.phone} · Email: {invoice.seller.email}
                  </p>
                  <p className="text-[11px] font-mono font-bold text-purple-700 dark:text-purple-400 print:text-black mt-1">
                    {invoice.seller.tax_registration_number}
                  </p>
                </div>

                <div className="sm:text-right shrink-0">
                  <div className="inline-block px-3 py-1 rounded bg-surface-100 dark:bg-surface-800 print:bg-gray-100 font-bold uppercase text-[11px] tracking-widest mb-2">
                    Tax Invoice / فاتورة ضريبية
                  </div>
                  <p className="font-mono font-bold text-sm text-surface-900 dark:text-white print:text-black">
                    {invoice.invoice_number}
                  </p>
                  <p className="text-[11px] text-surface-500 print:text-gray-600 mt-0.5">
                    Order Ref: <span className="font-mono font-semibold">{invoice.order_number}</span>
                  </p>
                  <p className="text-[11px] text-surface-500 print:text-gray-600">
                    Issue Date: {formatDate(invoice.order_date)}
                  </p>
                  <p className="text-[11px] text-surface-500 print:text-gray-600">
                    Market: {invoice.country.name} ({invoice.country.code})
                  </p>
                </div>
              </div>

              {/* 2. Customer & Shipping Addresses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/50 print:bg-gray-50 border border-surface-200 dark:border-surface-700 print:border-gray-300">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-surface-400 print:text-gray-600 mb-1.5">
                    Billed To (Customer Profile)
                  </h3>
                  <p className="font-bold text-sm text-surface-900 dark:text-white print:text-black">
                    {invoice.customer.name}
                  </p>
                  <p className="text-surface-600 dark:text-surface-400 print:text-gray-700">
                    {invoice.customer.email}
                  </p>
                  <p className="text-surface-600 dark:text-surface-400 print:text-gray-700 font-mono">
                    {invoice.customer.phone}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/50 print:bg-gray-50 border border-surface-200 dark:border-surface-700 print:border-gray-300">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-surface-400 print:text-gray-600 mb-1.5">
                    Delivery Destination
                  </h3>
                  <p className="font-bold text-sm text-surface-900 dark:text-white print:text-black">
                    {invoice.shipping_address?.recipient_name || invoice.customer.name}
                  </p>
                  <p className="text-surface-600 dark:text-surface-400 print:text-gray-700">
                    {invoice.shipping_address?.address_line1}
                    {invoice.shipping_address?.address_line2 && `, ${invoice.shipping_address.address_line2}`}
                  </p>
                  <p className="text-surface-600 dark:text-surface-400 print:text-gray-700">
                    {invoice.shipping_address?.city}, {invoice.country.name}
                  </p>
                </div>
              </div>

              {/* 3. Line Items Table */}
              <div className="overflow-hidden border border-surface-200 dark:border-surface-700 print:border-black rounded-xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-100 dark:bg-surface-800 print:bg-gray-100 text-[10px] font-bold uppercase tracking-wider text-surface-600 dark:text-surface-300 print:text-black border-b border-surface-200 dark:border-surface-700 print:border-black">
                      <th className="py-2.5 px-3 w-8">#</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-center w-12">Qty</th>
                      <th className="py-2.5 px-3 text-right">Total ({invoice.country.currency_code})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800 print:divide-gray-200 text-xs">
                    {invoice.items?.map((item, idx) => {
                      const bundleChildren = Array.isArray(item.bundle_items_snapshot)
                        ? item.bundle_items_snapshot
                        : typeof item.bundle_items_snapshot === 'string'
                          ? JSON.parse(item.bundle_items_snapshot || '[]')
                          : [];

                      return (
                        <tr key={item.id || idx}>
                          <td className="py-3 px-3 font-mono text-surface-400">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <p className="font-bold text-surface-900 dark:text-white print:text-black">
                              {item.product_name}
                            </p>
                            {item.product_name_ar && (
                              <p className="font-arabic text-[11px] text-surface-500 print:text-gray-600" dir="rtl">
                                {item.product_name_ar}
                              </p>
                            )}
                            {item.size_name && (
                              <span className="text-[10px] text-surface-400 block font-mono">
                                Size: {item.size_name}
                              </span>
                            )}
                            {/* Option B: Discovery Set Sub-Items */}
                            {Boolean(item.is_bundle) && bundleChildren.length > 0 && (
                              <div className="mt-1 pl-2 border-l-2 border-purple-400 print:border-black text-[10px] text-surface-500 print:text-gray-700 space-y-0.5">
                                <span className="font-semibold block text-purple-700 dark:text-purple-300 print:text-black">
                                  Discovery Set Assortment ({bundleChildren.length} items):
                                </span>
                                {bundleChildren.map((b, bIdx) => (
                                  <span key={bIdx} className="block">
                                    · {b.name} ({b.size}) × {b.quantity || 1}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-surface-500">{item.sku}</td>
                          <td className="py-3 px-3 text-right font-mono">
                            {parseFloat(item.unit_price).toFixed(invoice.country.decimal_places)}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold">{item.quantity}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-surface-900 dark:text-white print:text-black">
                            {parseFloat(item.line_total).toFixed(invoice.country.decimal_places)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 4. Custom Bottle Engraving Callout (If Gift) */}
              {invoice.gift_engraving_text && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 print:bg-yellow-50 border border-amber-300 dark:border-amber-800 print:border-yellow-400 flex items-center gap-2">
                  <HiOutlineGift className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-700 print:text-black block">
                      Custom Laser Bottle Engraving
                    </span>
                    <p className="font-serif italic text-xs font-bold text-amber-950 print:text-black">
                      "{invoice.gift_engraving_text}"
                    </p>
                  </div>
                </div>
              )}

              {/* 5. Financial Summary Grid */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
                <div className="space-y-2 max-w-sm">
                  <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-800/40 print:bg-gray-50 border border-surface-200 dark:border-surface-700 print:border-gray-300 text-[11px] space-y-1">
                    <p className="font-bold uppercase tracking-wider text-[10px] text-surface-400">
                      Payment Terms & Gateway
                    </p>
                    <p>
                      Method: <strong>{getPaymentMethodLabel(invoice.payment.method)}</strong>
                    </p>
                    <p>
                      Status:{' '}
                      <span className="capitalize font-bold">
                        {getPaymentStatusConfig(invoice.payment.status).label}
                      </span>
                    </p>
                    <p className="text-surface-500">
                      Currencies settled in designated sovereign regional currency units.
                    </p>
                  </div>
                </div>

                <div className="w-full sm:w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between text-surface-600 dark:text-surface-400 print:text-gray-700">
                    <span>Subtotal (Excl. VAT)</span>
                    <span className="font-mono">
                      {formatCurrency(invoice.financials.subtotal, invoice.country.currency_code, invoice.country.decimal_places)}
                    </span>
                  </div>

                  {parseFloat(invoice.financials.discount_amount) > 0 && (
                    <div className="flex justify-between text-rose-600 print:text-gray-800">
                      <span>Discount</span>
                      <span className="font-mono">
                        -{formatCurrency(invoice.financials.discount_amount, invoice.country.currency_code, invoice.country.decimal_places)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-surface-600 dark:text-surface-400 print:text-gray-700">
                    <span>Courier Delivery Fee</span>
                    <span className="font-mono">
                      {formatCurrency(invoice.financials.shipping_fee, invoice.country.currency_code, invoice.country.decimal_places)}
                    </span>
                  </div>

                  <div className="flex justify-between text-surface-600 dark:text-surface-400 print:text-gray-700">
                    <span>VAT ({invoice.financials.tax_percentage}%)</span>
                    <span className="font-mono">
                      {formatCurrency(invoice.financials.tax_amount, invoice.country.currency_code, invoice.country.decimal_places)}
                    </span>
                  </div>

                  <div className="pt-2 border-t-2 border-surface-900 dark:border-surface-600 print:border-black flex justify-between items-baseline text-sm font-bold text-surface-950 dark:text-white print:text-black">
                    <span>Total Amount Due</span>
                    <span className="font-mono text-base">
                      {formatCurrency(invoice.financials.total_amount, invoice.country.currency_code, invoice.country.decimal_places)}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-surface-500 pt-1">
                    <span>Amount Paid</span>
                    <span className="font-mono">
                      {formatCurrency(invoice.financials.total_paid, invoice.country.currency_code, invoice.country.decimal_places)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-surface-900 dark:text-surface-200 print:text-black">
                    <span>Balance Outstanding</span>
                    <span className="font-mono">
                      {formatCurrency(invoice.financials.balance_due, invoice.country.currency_code, invoice.country.decimal_places)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 6. Footer & Certification */}
              <div className="pt-8 mt-6 border-t border-surface-200 dark:border-surface-800 print:border-black flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div className="flex items-center gap-2 text-[10px] text-surface-400 print:text-gray-600">
                  <HiOutlineShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>
                    Alaynaa's Parfums · Certified Luxury Fragrance Formulation · FTA TRN Compliant
                  </span>
                </div>

                <div className="text-right">
                  <div className="w-36 border-b border-surface-300 dark:border-surface-700 print:border-black mb-1 mx-auto sm:ml-auto" />
                  <span className="text-[10px] uppercase font-bold text-surface-400 tracking-wider">
                    Authorized Signatory
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
