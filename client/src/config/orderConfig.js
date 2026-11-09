/**
 * ORDER PRESENTATION CONFIG & UI REGISTRY
 * 
 * Re-exports canonical domain constants from @shared/order-constants and defines
 * enterprise-grade UI presentation metadata: human-readable labels, luxury
 * Tailwind color tokens, status dots, and dropdown option matrices.
 */

import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  STATUS_PROGRESSION,
  isValidOrderStatus,
  isValidPaymentStatus,
  isValidPaymentMethod,
} from '@shared/order-constants';

// Re-export shared domain constants so frontend consumers have one convenient import
export {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  STATUS_PROGRESSION,
  isValidOrderStatus,
  isValidPaymentStatus,
  isValidPaymentMethod,
};

// ─── Fulfillment Status UI Configuration ──────────────────────────────────
export const ORDER_STATUS_CONFIG = {
  pending_payment: {
    label: 'Pending Payment',
    color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500 dark:bg-amber-400',
    description: 'Awaiting payment confirmation from gateway',
  },
  processing: {
    label: 'Processing',
    color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500 dark:bg-purple-400',
    description: 'Order confirmed and being routed to fulfillment team',
  },
  confirmed: {
    label: 'Confirmed',
    color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    dot: 'bg-indigo-500 dark:bg-indigo-400',
    description: 'Inventory allocated and ready for picking',
  },
  packed: {
    label: 'Packed',
    color: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
    dot: 'bg-cyan-500 dark:bg-cyan-400',
    description: 'Perfumes assembled in signature gift box with packaging seal',
  },
  shipped: {
    label: 'Shipped',
    color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500 dark:bg-blue-400',
    description: 'Dispatched with courier partner with tracking assigned',
  },
  delivered: {
    label: 'Delivered',
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
    description: 'Package received by recipient',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500 dark:bg-rose-400',
    description: 'Order cancelled before dispatch; inventory restored',
  },
  refunded: {
    label: 'Refunded',
    color: 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300 border-surface-200 dark:border-surface-700',
    dot: 'bg-surface-400 dark:bg-surface-500',
    description: 'Order amount fully refunded to client',
  },
  returned: {
    label: 'Returned',
    color: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500 dark:bg-orange-400',
    description: 'Consignment returned back to fulfillment hub',
  },
  on_hold: {
    label: 'On Hold',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-300 dark:border-amber-700',
    dot: 'bg-amber-600 dark:bg-amber-400',
    description: 'Requires customer confirmation or manual fraud check',
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border-red-200 dark:border-red-800',
    dot: 'bg-red-500 dark:bg-red-400',
    description: 'Checkout or gateway submission unrecoverable failure',
  },
};

// ─── Payment Status UI Configuration ──────────────────────────────────────
export const PAYMENT_STATUS_CONFIG = {
  paid: {
    label: 'Paid',
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  unpaid: {
    label: 'Unpaid',
    color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  authorized: {
    label: 'Authorized',
    color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  partially_refunded: {
    label: 'Partially Refunded',
    color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
  refunded: {
    label: 'Refunded',
    color: 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300 border-surface-200 dark:border-surface-700',
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border-red-200 dark:border-red-800',
  },
};

// ─── Payment Methods UI Configuration ─────────────────────────────────────
export const PAYMENT_METHOD_CONFIG = {
  credit_card: { label: 'Credit Card', shortLabel: 'Card' },
  apple_pay: { label: 'Apple Pay', shortLabel: 'Apple Pay' },
  tabby: { label: 'Tabby (BNPL)', shortLabel: 'Tabby' },
  tamara: { label: 'Tamara (BNPL)', shortLabel: 'Tamara' },
  mada: { label: 'Mada Debit', shortLabel: 'Mada' },
  knet: { label: 'KNET', shortLabel: 'KNET' },
  cash_on_delivery: { label: 'Cash on Delivery', shortLabel: 'COD' },
  bank_transfer: { label: 'Bank Transfer', shortLabel: 'Wire' },
  pos_terminal: { label: 'POS Terminal', shortLabel: 'POS' },
};

// ─── Formatted Options for Filters & Form Selects ─────────────────────────
export const ORDER_STATUS_OPTIONS = ORDER_STATUSES.map((status) => ({
  value: status,
  label: ORDER_STATUS_CONFIG[status]?.label || status,
}));

export const PAYMENT_STATUS_OPTIONS = PAYMENT_STATUSES.map((status) => ({
  value: status,
  label: PAYMENT_STATUS_CONFIG[status]?.label || status,
}));

export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS.map((method) => ({
  value: method,
  label: PAYMENT_METHOD_CONFIG[method]?.label || method,
}));

// ─── Safe Getter Functions with Fallbacks ─────────────────────────────────

/**
 * Returns UI configuration for an order fulfillment status with guaranteed fallback
 */
export function getOrderStatusConfig(status) {
  const key = (status || '').toLowerCase().trim();
  return (
    ORDER_STATUS_CONFIG[key] || {
      label: status || 'Unknown',
      color: 'bg-surface-100 text-surface-800 dark:bg-surface-800 dark:text-surface-200 border-surface-200 dark:border-surface-700',
      dot: 'bg-surface-400 dark:bg-surface-500',
      description: '',
    }
  );
}

/**
 * Returns UI configuration for a payment status with guaranteed fallback
 */
export function getPaymentStatusConfig(status) {
  const key = (status || '').toLowerCase().trim();
  return (
    PAYMENT_STATUS_CONFIG[key] || {
      label: status || 'Unknown',
      color: 'bg-surface-100 text-surface-800 dark:bg-surface-800 dark:text-surface-200 border-surface-200 dark:border-surface-700',
    }
  );
}

/**
 * Returns human-readable label for payment method with fallback
 */
export function getPaymentMethodLabel(method) {
  if (!method) return 'Unknown';
  const key = method.toLowerCase().trim();
  return PAYMENT_METHOD_CONFIG[key]?.label || method;
}
