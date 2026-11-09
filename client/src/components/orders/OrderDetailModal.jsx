import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { toast } from '../ui/Toast';
import { usePermission } from '../../hooks/usePermission';
import CountryFlag, { CountryBadge } from '../ui/CountryFlag';
import {
  HiOutlineX,
  HiOutlineRefresh,
  HiOutlineUser,
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineLocationMarker,
  HiOutlineTruck,
  HiOutlineCreditCard,
  HiOutlineCash,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineGift,
  HiOutlineDocumentText,
  HiOutlinePrinter,
  HiOutlineExternalLink,
  HiOutlineChatAlt2,
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlinePlus,
  HiOutlineCheck,
  HiOutlineArrowNarrowRight,
  HiOutlineShieldCheck,
  HiOutlineExclamationCircle,
  HiOutlineInformationCircle,
  HiOutlineShoppingBag,
} from 'react-icons/hi';

import {
  ORDER_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  PAYMENT_METHOD_CONFIG,
  STATUS_PROGRESSION,
  getOrderStatusConfig,
  getPaymentStatusConfig,
  getPaymentMethodLabel,
} from '../../config/orderConfig';
import OrderStatusBadge from './OrderStatusBadge';
import PaymentStatusBadge from './PaymentStatusBadge';
import OrderInvoiceModal from './OrderInvoiceModal';

export default function OrderDetailModal({ orderId, onClose, onOrderUpdated = () => { } }) {
  const canUpdate = usePermission('orders.update');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedBundles, setExpandedBundles] = useState({});
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Sub-dialogs
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusForm, setStatusForm] = useState({ new_status: '', notes: '', notified_customer: true });
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const [showShippingModal, setShowShippingModal] = useState(false);
  const [shippingForm, setShippingForm] = useState({
    shipping_carrier: '',
    tracking_number: '',
    tracking_url: '',
    estimated_delivery_date: '',
    mark_shipped: false,
  });
  const [shippingSubmitting, setShippingSubmitting] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    transaction_reference: '',
    gateway: 'manual',
    payment_method: 'credit_card',
    transaction_type: 'capture',
    amount: '',
    card_brand: '',
    card_last4: '',
    notes: '',
  });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundForm, setRefundForm] = useState({
    amount: '',
    transaction_reference: '',
    gateway: 'manual',
    notes: '',
    restock_items: false,
  });
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteVisible, setNewNoteVisible] = useState(false);
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  // Fetch full order data
  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await api.get(`/orders/${orderId}`);
      setOrder(res.data?.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load order details');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [orderId, onClose]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const toggleBundle = (itemId) => {
    setExpandedBundles((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const formatCurrency = (amount, currency = 'AED', decimals = 2) => {
    const num = parseFloat(amount || 0);
    return `${num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })} ${currency}`;
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Status submission
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!statusForm.new_status) return;
    setStatusSubmitting(true);
    try {
      await api.patch(`/orders/${order.id}/status`, statusForm);
      toast.success(`Order status updated to ${getOrderStatusConfig(statusForm.new_status).label}`);
      setShowStatusModal(false);
      fetchOrder();
      onOrderUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Shipping submission
  const handleShippingSubmit = async (e) => {
    e.preventDefault();
    setShippingSubmitting(true);
    try {
      await api.patch(`/orders/${order.id}/shipping`, shippingForm);
      toast.success('Shipping & Courier tracking details updated');
      setShowShippingModal(false);
      fetchOrder();
      onOrderUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update shipping info');
    } finally {
      setShippingSubmitting(false);
    }
  };

  // Payment submission
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    setPaymentSubmitting(true);
    try {
      await api.post(`/orders/${order.id}/payments`, {
        ...paymentForm,
        amount: parseFloat(paymentForm.amount),
      });
      toast.success('Payment recorded successfully in ledger');
      setShowPaymentModal(false);
      setPaymentForm({
        transaction_reference: '',
        gateway: 'manual',
        payment_method: 'credit_card',
        transaction_type: 'capture',
        amount: '',
        card_brand: '',
        card_last4: '',
        notes: '',
      });
      fetchOrder();
      onOrderUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Refund submission
  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundForm.amount || parseFloat(refundForm.amount) <= 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }
    setRefundSubmitting(true);
    try {
      await api.post(`/orders/${order.id}/refunds`, {
        ...refundForm,
        amount: parseFloat(refundForm.amount),
      });
      toast.success('Refund recorded successfully in ledger');
      setShowRefundModal(false);
      setRefundForm({
        amount: '',
        transaction_reference: '',
        gateway: 'manual',
        notes: '',
        restock_items: false,
      });
      fetchOrder();
      onOrderUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process refund');
    } finally {
      setRefundSubmitting(false);
    }
  };

  // Add Internal / Collaboration Note
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    setNoteSubmitting(true);
    try {
      await api.post(`/orders/${order.id}/notes`, {
        note: newNoteText.trim(),
        is_customer_visible: newNoteVisible,
      });
      toast.success('Note added to order collaboration feed');
      setNewNoteText('');
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add note');
    } finally {
      setNoteSubmitting(false);
    }
  };

  if (!orderId) return null;

  const balanceDue = order
    ? Math.max(0, parseFloat(order.total_amount || 0) - parseFloat(order.total_paid || 0))
    : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-surface-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-surface-200/80 dark:border-surface-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* ── Top Executive Header ── */}
        <div className="px-5 py-4 border-b border-surface-200/80 dark:border-surface-800/80 flex items-center justify-between bg-surface-50/70 dark:bg-surface-850/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-200/80 dark:border-purple-800/80">
              <HiOutlineDocumentText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-mono text-surface-900 dark:text-white truncate">
                  {order ? order.order_number : 'Loading Order...'}
                </h2>
                {order && (
                  <CountryBadge code={order.country_code} label={order.country_code} size="xs" />
                )}
                {Boolean(order?.is_gift) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1 shrink-0">
                    <HiOutlineGift className="w-3 h-3" />
                    <span>Gift Set</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-surface-400 mt-0.5">
                Created on {order ? formatDate(order.created_at) : '...'}
                {order?.created_by_user_name && ` · by ${order.created_by_user_name}`}
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {order && (
              <>
                <OrderStatusBadge status={order.status} size="md" />
                <PaymentStatusBadge status={order.payment_status} size="md" />

                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(true)}
                  className="p-2 rounded-xl text-surface-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-surface-200 dark:border-surface-700 transition-colors"
                  title="Print Commercial Invoice"
                >
                  <HiOutlinePrinter className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              title="Close Inspector"
            >
              <HiOutlineX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Main Modal Body (Scrollable) ── */}
        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {loading ? (
            <div className="py-24 text-center">
              <HiOutlineRefresh className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium text-surface-600 dark:text-surface-300">
                Loading order dossier & transaction ledger...
              </p>
            </div>
          ) : order ? (
            <>
              {/* 1. Status Progression Stepper */}
              <div className="p-4 rounded-2xl bg-surface-50/80 dark:bg-surface-800/40 border border-surface-200/80 dark:border-surface-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-surface-500">
                      Fulfillment Lifecycle
                    </h3>
                    <p className="text-xs text-surface-400 mt-0.5">
                      Progress order state from payment confirmation through final luxury concierge delivery
                    </p>
                  </div>
                  {canUpdate && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStatusForm({
                            new_status: order.status,
                            notes: '',
                            notified_customer: true,
                          });
                          setShowStatusModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all"
                      >
                        Update Status
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShippingForm({
                            shipping_carrier: order.shipping_carrier || 'Aramex Priority VIP',
                            tracking_number: order.tracking_number || '',
                            tracking_url: order.tracking_url || '',
                            estimated_delivery_date: order.estimated_delivery_date
                              ? order.estimated_delivery_date.slice(0, 10)
                              : '',
                            mark_shipped: order.status !== 'shipped' && order.status !== 'delivered',
                          });
                          setShowShippingModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-200/80 hover:bg-surface-300 dark:bg-surface-700 dark:hover:bg-surface-600 text-surface-800 dark:text-surface-200 transition-all flex items-center gap-1.5"
                      >
                        <HiOutlineTruck className="w-3.5 h-3.5" />
                        <span>Manage Shipping</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Visual Step Tracker */}
                <div className="grid grid-cols-4 gap-2 pt-2">
                  {STATUS_PROGRESSION.map((stepKey, idx) => {
                    const stepConf = getOrderStatusConfig(stepKey);
                    const currentIndex = STATUS_PROGRESSION.indexOf(order.status);
                    const isCompleted = currentIndex >= idx;
                    const isCurrent = order.status === stepKey;

                    return (
                      <div
                        key={stepKey}
                        className={`p-2.5 rounded-xl border text-center transition-all ${isCurrent
                            ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700 shadow-xs'
                            : isCompleted
                              ? 'bg-white dark:bg-surface-800/80 border-surface-200 dark:border-surface-700/80 text-surface-700 dark:text-surface-300'
                              : 'bg-surface-100/50 dark:bg-surface-850/40 border-dashed border-surface-200 dark:border-surface-800 text-surface-400 opacity-60'
                          }`}
                      >
                        <div className="flex items-center justify-center mb-1">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isCurrent
                                ? 'bg-purple-600 text-white'
                                : isCompleted
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-surface-200 dark:bg-surface-700 text-surface-500'
                              }`}
                          >
                            {isCompleted && !isCurrent ? (
                              <HiOutlineCheck className="w-3 h-3 stroke-[2.5]" />
                            ) : (
                              idx + 1
                            )}
                          </span>
                        </div>
                        <span className={`text-[11px] font-bold block capitalize ${isCurrent ? 'text-purple-700 dark:text-purple-300' : ''}`}>
                          {stepConf.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Dual Column Layout (Left: Line Items & Payments; Right: Customer & Shipping) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* ── Left Column (2 Cols wide): Items & Financial Ledger ── */}
                <div className="lg:col-span-2 space-y-5">
                  {/* Order Items Table */}
                  <div className="rounded-2xl border border-surface-200/80 dark:border-surface-800 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-surface-50 dark:bg-surface-850/60 border-b border-surface-200/80 dark:border-surface-800 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-surface-600 dark:text-surface-300">
                        Purchased Perfumes & Bundles ({order.items?.length || 0})
                      </h4>
                      <span className="text-xs font-mono font-semibold text-surface-500">
                        Total Units: {order.items?.reduce((acc, i) => acc + i.quantity, 0) || 0}
                      </span>
                    </div>

                    <div className="divide-y divide-surface-100 dark:divide-surface-800">
                      {order.items?.map((item) => {
                        const isExpanded = Boolean(expandedBundles[item.id]);
                        const bundleList = Array.isArray(item.bundle_items_snapshot)
                          ? item.bundle_items_snapshot
                          : typeof item.bundle_items_snapshot === 'string'
                            ? JSON.parse(item.bundle_items_snapshot || '[]')
                            : [];

                        return (
                          <div key={item.id} className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.product_name}
                                    className="w-12 h-12 rounded-xl object-cover border border-surface-200 dark:border-surface-700 shrink-0"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60 flex items-center justify-center shrink-0">
                                    <HiOutlineShoppingBag className="w-6 h-6" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h5 className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                                    {item.product_name}
                                  </h5>
                                  {item.product_name_ar && (
                                    <p className="text-xs text-surface-400 font-arabic truncate" dir="rtl">
                                      {item.product_name_ar}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1 text-[11px] text-surface-400 font-mono">
                                    <span>SKU: {item.sku}</span>
                                    {item.size_name && <span>· Size: {item.size_name}</span>}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-mono font-bold text-sm text-surface-900 dark:text-white block">
                                  {formatCurrency(item.line_total, order.currency_code, order.decimal_places)}
                                </span>
                                <span className="text-[11px] text-surface-400 font-mono">
                                  {item.quantity} × {formatCurrency(item.unit_price, order.currency_code, order.decimal_places)}
                                </span>
                              </div>
                            </div>

                            {/* Option B: Expandable Gift Set Miniature Child Items */}
                            {Boolean(item.is_bundle) && bundleList.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-dashed border-surface-200 dark:border-surface-800">
                                <button
                                  type="button"
                                  onClick={() => toggleBundle(item.id)}
                                  className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1 hover:underline"
                                >
                                  {isExpanded ? <HiOutlineChevronDown className="w-3.5 h-3.5" /> : <HiOutlineChevronRight className="w-3.5 h-3.5" />}
                                  <span>
                                    {isExpanded ? 'Hide Discovery Set Items' : `View Discovery Set Items (${bundleList.length} Miniatures)`}
                                  </span>
                                </button>

                                {isExpanded && (
                                  <div className="mt-2 p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 space-y-1.5 animate-fade-in">
                                    {bundleList.map((sub, sIdx) => (
                                      <div key={sIdx} className="flex items-center justify-between text-xs text-surface-700 dark:text-surface-300">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                                          <span className="font-medium truncate">{sub.name || sub.product_name}</span>
                                          {sub.size && (
                                            <span className="text-[10px] text-surface-400 font-mono">({sub.size})</span>
                                          )}
                                        </div>
                                        <span className="text-[11px] text-surface-500 font-mono">
                                          Qty: {sub.quantity || 1}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Financial Summary Calculation Card */}
                    <div className="bg-surface-50/70 dark:bg-surface-850/50 p-4 border-t border-surface-200/80 dark:border-surface-800 space-y-1.5 text-xs">
                      <div className="flex justify-between text-surface-600 dark:text-surface-300">
                        <span>Items Subtotal</span>
                        <span className="font-mono font-medium">
                          {formatCurrency(order.subtotal, order.currency_code, order.decimal_places)}
                        </span>
                      </div>

                      {parseFloat(order.discount_amount || 0) > 0 && (
                        <div className="flex justify-between text-rose-600 dark:text-rose-400">
                          <span>VIP / Promotional Discount</span>
                          <span className="font-mono font-medium">
                            -{formatCurrency(order.discount_amount, order.currency_code, order.decimal_places)}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between text-surface-600 dark:text-surface-300">
                        <span>Courier Shipping Fee</span>
                        <span className="font-mono font-medium">
                          {formatCurrency(order.shipping_fee, order.currency_code, order.decimal_places)}
                        </span>
                      </div>

                      <div className="flex justify-between text-surface-600 dark:text-surface-300">
                        <span>Regional VAT ({order.tax_percentage}%)</span>
                        <span className="font-mono font-medium">
                          {formatCurrency(order.tax_amount, order.currency_code, order.decimal_places)}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-surface-200 dark:border-surface-700/80 flex justify-between items-baseline text-sm font-bold text-surface-900 dark:text-white">
                        <span>Grand Total</span>
                        <span className="font-mono text-base text-purple-600 dark:text-purple-400">
                          {formatCurrency(order.total_amount, order.currency_code, order.decimal_places)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Order Payments Ledger (Option B 1:N Transaction History) */}
                  <div className="rounded-2xl border border-surface-200/80 dark:border-surface-800 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-surface-50 dark:bg-surface-850/60 border-b border-surface-200/80 dark:border-surface-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-surface-600 dark:text-surface-300 flex items-center gap-1.5">
                          <HiOutlineCreditCard className="w-4 h-4 text-purple-500" />
                          <span>Payment & Refund Ledger ({order.payments?.length || 0})</span>
                        </h4>
                        <p className="text-[11px] text-surface-400 mt-0.5">
                          Audit trail of gateway authorizations, captures, and refund transactions
                        </p>
                      </div>

                      {canUpdate && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentForm({
                                transaction_reference: `MAN-${Date.now().toString().slice(-6)}`,
                                gateway: 'manual',
                                payment_method: order.payment_method || 'credit_card',
                                transaction_type: 'capture',
                                amount: balanceDue > 0 ? String(balanceDue) : '',
                                card_brand: '',
                                card_last4: '',
                                notes: 'Manual payment captured by concierge',
                              });
                              setShowPaymentModal(true);
                            }}
                            className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-1"
                          >
                            <HiOutlinePlus className="w-3.5 h-3.5" />
                            <span>Record Payment</span>
                          </button>

                          {parseFloat(order.total_paid || 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setRefundForm({
                                  amount: '',
                                  transaction_reference: `REF-${Date.now().toString().slice(-6)}`,
                                  gateway: 'manual',
                                  notes: 'Customer requested item return refund',
                                  restock_items: false,
                                });
                                setShowRefundModal(true);
                              }}
                              className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-colors"
                            >
                              Issue Refund
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Balance Due Banner */}
                    <div className="px-4 py-2.5 bg-surface-100/50 dark:bg-surface-850/30 border-b border-surface-200/60 dark:border-surface-800 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-4">
                        <span>
                          Total Paid: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(order.total_paid, order.currency_code, order.decimal_places)}</strong>
                        </span>
                        <span>
                          Refunded: <strong className="text-rose-600 dark:text-rose-400">{formatCurrency(order.total_refunded, order.currency_code, order.decimal_places)}</strong>
                        </span>
                      </div>
                      <div>
                        Balance Due:{' '}
                        <strong className={balanceDue > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-emerald-600'}>
                          {formatCurrency(balanceDue, order.currency_code, order.decimal_places)}
                        </strong>
                      </div>
                    </div>

                    {/* Ledger Records Table */}
                    {order.payments && order.payments.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/30 text-[10px] uppercase font-bold text-surface-400">
                              <th className="py-2.5 px-3">Reference</th>
                              <th className="py-2.5 px-3">Type</th>
                              <th className="py-2.5 px-3">Method</th>
                              <th className="py-2.5 px-3 text-right">Amount</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-100 dark:divide-surface-800 font-mono">
                            {order.payments.map((p) => (
                              <tr key={p.id} className="hover:bg-surface-50/60 dark:hover:bg-surface-800/40">
                                <td className="py-2.5 px-3 font-semibold text-surface-900 dark:text-white">
                                  {p.transaction_reference}
                                  {p.card_last4 && (
                                    <span className="text-[10px] text-surface-400 block font-sans">
                                      {p.card_brand || 'Card'} ···· {p.card_last4}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${p.transaction_type === 'refund'
                                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    }`}>
                                    {p.transaction_type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-sans text-surface-600 dark:text-surface-300">
                                  {getPaymentMethodLabel(p.payment_method)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold">
                                  <span className={p.transaction_type === 'refund' ? 'text-rose-600' : 'text-emerald-600'}>
                                    {p.transaction_type === 'refund' ? '-' : '+'}
                                    {formatCurrency(p.amount, p.currency_code, order.decimal_places)}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 uppercase font-semibold">
                                    {p.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-[11px] font-sans text-surface-400">
                                  {formatDate(p.created_at)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs text-surface-400">
                        No transactions recorded in the payment ledger yet. Use "Record Payment" to capture funds.
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Right Column (1 Col wide): Customer, Shipping, & Notes ── */}
                <div className="space-y-5">
                  {/* Customer Information Card */}
                  <div className="p-4 rounded-2xl border border-surface-200/80 dark:border-surface-800 space-y-3 shadow-sm bg-white dark:bg-surface-850/40">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 flex items-center gap-1.5">
                      <HiOutlineUser className="w-4 h-4 text-purple-500" />
                      <span>Customer & Delivery</span>
                    </h4>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="font-bold text-sm text-surface-900 dark:text-white block">
                          {order.customer_name}
                        </span>
                        <a
                          href={`mailto:${order.customer_email}`}
                          className="text-surface-500 hover:text-purple-600 flex items-center gap-1.5 mt-0.5"
                        >
                          <HiOutlineMail className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                          <span className="truncate">{order.customer_email}</span>
                        </a>
                        <div className="flex items-center gap-2 mt-1">
                          <a
                            href={`tel:${order.customer_phone}`}
                            className="text-surface-600 dark:text-surface-300 hover:text-purple-600 flex items-center gap-1.5"
                          >
                            <HiOutlinePhone className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                            <span>{order.customer_phone}</span>
                          </a>
                          {/* Direct WhatsApp Concierge Button */}
                          <a
                            href={`https://wa.me/${order.customer_phone?.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold hover:bg-emerald-100 transition-colors shrink-0"
                            title="Chat with Customer via WhatsApp"
                          >
                            WhatsApp
                          </a>
                        </div>
                      </div>

                      {/* Shipping Address */}
                      <div className="pt-2 border-t border-surface-100 dark:border-surface-800/80">
                        <span className="text-[10px] font-bold uppercase text-surface-400 block mb-1">
                          Delivery Destination
                        </span>
                        {order.shipping_address ? (
                          <div className="text-surface-700 dark:text-surface-300 space-y-0.5">
                            {order.shipping_address.recipient_name && (
                              <p className="font-semibold">{order.shipping_address.recipient_name}</p>
                            )}
                            <p>{order.shipping_address.address_line1}</p>
                            {order.shipping_address.address_line2 && <p>{order.shipping_address.address_line2}</p>}
                            <p className="flex items-center flex-wrap gap-1">
                              <span>{order.shipping_address.city}</span>
                              {order.shipping_address.state_province_emirate && <span>, {order.shipping_address.state_province_emirate}</span>}
                              {order.shipping_address.country_code && (
                                <span className="inline-flex items-center gap-1 ml-1 font-mono text-xs">
                                  · <CountryFlag code={order.shipping_address.country_code} size="xs" /> {order.shipping_address.country_code}
                                </span>
                              )}
                            </p>
                            {order.shipping_address.delivery_instructions && (
                              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded-lg border border-amber-200/60">
                                <strong>Note:</strong> {order.shipping_address.delivery_instructions}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-surface-400 italic">No delivery address specified.</p>
                        )}
                      </div>

                      {/* Custom Bottle Engraving Callout */}
                      {Boolean(order.is_gift) && order.gift_engraving_text && (
                        <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs">
                          <span className="font-bold text-amber-800 dark:text-amber-300 block mb-0.5">
                            Custom Bottle Engraving:
                          </span>
                          <span className="italic font-serif text-amber-900 dark:text-amber-200">
                            "{order.gift_engraving_text}"
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Courier & Tracking Card */}
                  <div className="p-4 rounded-2xl border border-surface-200/80 dark:border-surface-800 space-y-3 shadow-sm bg-white dark:bg-surface-850/40">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 flex items-center gap-1.5">
                        <HiOutlineTruck className="w-4 h-4 text-purple-500" />
                        <span>Courier Tracking</span>
                      </h4>
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() => {
                            setShippingForm({
                              shipping_carrier: order.shipping_carrier || 'Aramex Priority VIP',
                              tracking_number: order.tracking_number || '',
                              tracking_url: order.tracking_url || '',
                              estimated_delivery_date: order.estimated_delivery_date
                                ? order.estimated_delivery_date.slice(0, 10)
                                : '',
                              mark_shipped: order.status !== 'shipped' && order.status !== 'delivered',
                            });
                            setShowShippingModal(true);
                          }}
                          className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    <div className="text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-surface-400">Carrier:</span>
                        <span className="font-semibold text-surface-800 dark:text-surface-200">
                          {order.shipping_carrier || 'Not assigned yet'}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-surface-400">Tracking #:</span>
                        {order.tracking_number ? (
                          order.tracking_url ? (
                            <a
                              href={order.tracking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono font-bold text-purple-600 hover:underline flex items-center gap-1"
                            >
                              <span>{order.tracking_number}</span>
                              <HiOutlineExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="font-mono font-bold text-surface-900 dark:text-white">
                              {order.tracking_number}
                            </span>
                          )
                        ) : (
                          <span className="text-surface-400">None</span>
                        )}
                      </div>

                      {order.estimated_delivery_date && (
                        <div className="flex justify-between">
                          <span className="text-surface-400">Est. Delivery:</span>
                          <span className="font-medium text-surface-800 dark:text-surface-200">
                            {formatDate(order.estimated_delivery_date)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Collaboration Notes & Status Timeline */}
                  <div className="p-4 rounded-2xl border border-surface-200/80 dark:border-surface-800 space-y-3 shadow-sm bg-white dark:bg-surface-850/40">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-surface-400 flex items-center gap-1.5">
                      <HiOutlineChatAlt2 className="w-4 h-4 text-purple-500" />
                      <span>Internal Staff Notes ({order.notes?.length || 0})</span>
                    </h4>

                    {/* Add note input */}
                    {canUpdate && (
                      <form onSubmit={handleAddNote} className="space-y-2">
                        <textarea
                          rows={2}
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          placeholder="Type internal concierge or packaging remark..."
                          className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                        />
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-1.5 text-[11px] text-surface-500 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newNoteVisible}
                              onChange={(e) => setNewNoteVisible(e.target.checked)}
                              className="rounded border-surface-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span>Visible to customer</span>
                          </label>
                          <button
                            type="submit"
                            disabled={noteSubmitting || !newNoteText.trim()}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 transition-colors"
                          >
                            {noteSubmitting ? 'Adding...' : 'Add Note'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Notes List */}
                    <div className="space-y-2 max-h-48 overflow-y-auto pt-1">
                      {order.notes && order.notes.length > 0 ? (
                        order.notes.map((n) => (
                          <div key={n.id} className="p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-100 dark:border-surface-800 text-xs space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-surface-400">
                              <span className="font-semibold text-surface-700 dark:text-surface-300">
                                {n.author_name || 'Staff Concierge'}
                              </span>
                              <span>{formatDate(n.created_at)}</span>
                            </div>
                            <p className="text-surface-800 dark:text-surface-200 text-xs">{n.note}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-surface-400 italic">No notes recorded yet.</p>
                      )}
                    </div>

                    {/* Status Audit History */}
                    <div className="pt-3 border-t border-surface-100 dark:border-surface-800">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-2">
                        Status Transition Audit
                      </h5>
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {order.status_history?.map((h) => (
                          <div key={h.id} className="flex items-start gap-2 text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-surface-800 dark:text-surface-200 flex items-center flex-wrap gap-1">
                                {h.old_status && (
                                  <>
                                    <span className="capitalize">{h.old_status}</span>
                                    <HiOutlineArrowNarrowRight className="w-3 h-3 text-surface-400 shrink-0" />
                                  </>
                                )}
                                <strong className="capitalize">{h.new_status}</strong>
                              </p>
                              <span className="text-[10px] text-surface-400 font-sans block">
                                {formatDate(h.created_at)} {h.created_by_user_name ? `by ${h.created_by_user_name}` : ''}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Sub-Modal 1: Update Status Dialog ── */}
      {showStatusModal && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-900 w-full max-w-md rounded-2xl shadow-xl border border-surface-200 dark:border-surface-800 p-5 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-surface-900 dark:text-white">
                Advance Order Status
              </h3>
              <button type="button" onClick={() => setShowStatusModal(false)} className="text-surface-400 hover:text-surface-600">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                  New Order Status
                </label>
                <select
                  value={statusForm.new_status}
                  onChange={(e) => setStatusForm((prev) => ({ ...prev, new_status: e.target.value }))}
                  className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white font-medium"
                >
                  <option value="pending_payment">Pending Payment</option>
                  <option value="processing">Processing</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="packed">Packed</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                  <option value="returned">Returned</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                  Status Transition Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Dispatched with Aramex VIP driver..."
                  className="w-full p-2 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-surface-600 dark:text-surface-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={statusForm.notified_customer}
                  onChange={(e) => setStatusForm((prev) => ({ ...prev, notified_customer: e.target.checked }))}
                  className="rounded border-surface-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Send customer email & WhatsApp status dispatch notification</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-100 hover:bg-surface-200 text-surface-700 dark:bg-surface-800 dark:text-surface-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusSubmitting}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                >
                  {statusSubmitting ? 'Updating...' : 'Confirm Status Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Sub-Modal 2: Manage Shipping Dialog ── */}
      {showShippingModal && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-900 w-full max-w-md rounded-2xl shadow-xl border border-surface-200 dark:border-surface-800 p-5 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-surface-900 dark:text-white flex items-center gap-1.5">
                <HiOutlineTruck className="w-4 h-4 text-purple-600" />
                <span>Assign Courier & Tracking</span>
              </h3>
              <button type="button" onClick={() => setShowShippingModal(false)} className="text-surface-400 hover:text-surface-600">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleShippingSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                  Courier Carrier
                </label>
                <input
                  type="text"
                  value={shippingForm.shipping_carrier}
                  onChange={(e) => setShippingForm((prev) => ({ ...prev, shipping_carrier: e.target.value }))}
                  placeholder="e.g. Aramex Priority VIP, DHL Express, FedEx, SMSA"
                  className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                  Waybill / Tracking Number
                </label>
                <input
                  type="text"
                  value={shippingForm.tracking_number}
                  onChange={(e) => setShippingForm((prev) => ({ ...prev, tracking_number: e.target.value }))}
                  placeholder="e.g. ARX-UAE-8829104"
                  className="w-full p-2.5 text-xs font-mono rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                  Public Tracking Web URL (Optional)
                </label>
                <input
                  type="url"
                  value={shippingForm.tracking_url}
                  onChange={(e) => setShippingForm((prev) => ({ ...prev, tracking_url: e.target.value }))}
                  placeholder="https://www.aramex.com/track/..."
                  className="w-full p-2.5 text-xs font-mono rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                  Estimated Delivery Date
                </label>
                <input
                  type="date"
                  value={shippingForm.estimated_delivery_date}
                  onChange={(e) => setShippingForm((prev) => ({ ...prev, estimated_delivery_date: e.target.value }))}
                  className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                />
              </div>

              {order.status !== 'shipped' && order.status !== 'delivered' && (
                <label className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 p-2.5 rounded-xl border border-purple-200 dark:border-purple-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shippingForm.mark_shipped}
                    onChange={(e) => setShippingForm((prev) => ({ ...prev, mark_shipped: e.target.checked }))}
                    className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Automatically advance order status to <strong>Shipped</strong></span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowShippingModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-100 hover:bg-surface-200 text-surface-700 dark:bg-surface-800 dark:text-surface-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={shippingSubmitting}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                >
                  {shippingSubmitting ? 'Saving...' : 'Save Shipping Info'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Sub-Modal 3: Record Payment Dialog ── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-900 w-full max-w-md rounded-2xl shadow-xl border border-surface-200 dark:border-surface-800 p-5 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-surface-900 dark:text-white flex items-center gap-1.5">
                <HiOutlineCreditCard className="w-4 h-4 text-emerald-600" />
                <span>Record Payment Transaction</span>
              </h3>
              <button type="button" onClick={() => setShowPaymentModal(false)} className="text-surface-400 hover:text-surface-600">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Amount ({order.currency_code})
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.000"
                    className="w-full p-2.5 text-xs font-mono font-bold rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  >
                    <option value="credit_card">Credit Card</option>
                    <option value="apple_pay">Apple Pay</option>
                    <option value="tabby">Tabby (BNPL)</option>
                    <option value="tamara">Tamara (BNPL)</option>
                    <option value="cash_on_delivery">Cash on Delivery</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="pos_terminal">POS Terminal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                  Transaction Reference / Voucher ID
                </label>
                <input
                  type="text"
                  value={paymentForm.transaction_reference}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, transaction_reference: e.target.value }))}
                  placeholder="e.g. CHG-998822 or Aramex COD Receipt #441"
                  className="w-full p-2.5 text-xs font-mono rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Card Brand (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentForm.card_brand}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, card_brand: e.target.value }))}
                    placeholder="Visa, Mastercard, Mada"
                    className="w-full p-2 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Last 4 Digits (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={paymentForm.card_last4}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, card_last4: e.target.value }))}
                    placeholder="4242"
                    className="w-full p-2 text-xs font-mono rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                  Payment Notes
                </label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Verified with bank statement"
                  className="w-full p-2 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-100 hover:bg-surface-200 text-surface-700 dark:bg-surface-800 dark:text-surface-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  {paymentSubmitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Sub-Modal 4: Issue Refund Dialog ── */}
      {showRefundModal && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-900 w-full max-w-md rounded-2xl shadow-xl border border-surface-200 dark:border-surface-800 p-5 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-surface-900 dark:text-white flex items-center gap-1.5">
                <HiOutlineExclamationCircle className="w-4 h-4 text-rose-600" />
                <span>Issue Customer Refund</span>
              </h3>
              <button type="button" onClick={() => setShowRefundModal(false)} className="text-surface-400 hover:text-surface-600">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRefundSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                  Refund Amount ({order.currency_code})
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  max={order.total_paid}
                  value={refundForm.amount}
                  onChange={(e) => setRefundForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder={`Max: ${order.total_paid}`}
                  className="w-full p-2.5 text-xs font-mono font-bold rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                  Refund Reason / Reference
                </label>
                <input
                  type="text"
                  value={refundForm.notes}
                  onChange={(e) => setRefundForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Scent profile exchange or return"
                  className="w-full p-2.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  required
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-surface-600 dark:text-surface-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={refundForm.restock_items}
                  onChange={(e) => setRefundForm((prev) => ({ ...prev, restock_items: e.target.checked }))}
                  className="rounded border-surface-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Automatically return items back into market inventory count</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-100 hover:bg-surface-200 text-surface-700 dark:bg-surface-800 dark:text-surface-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refundSubmitting}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                >
                  {refundSubmitting ? 'Processing...' : 'Confirm Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Commercial Tax Invoice Modal (Phase 5) ── */}
      {order && (
        <OrderInvoiceModal
          orderId={order.id}
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}
    </div>
  );
}
