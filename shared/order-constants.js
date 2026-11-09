/**
 * ORDER CONSTANTS & DOMAIN REGISTRY — Single Source of Truth
 * 
 * Shared between Server (Node.js CommonJS) and Client (Vite ES Modules).
 * Both API validation schemas (Joi) and Frontend UI registries import from here.
 */

// Canonical Fulfillment & Lifecycle Order Statuses
const ORDER_STATUSES = [
  'pending_payment',
  'processing',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'returned',
  'on_hold',
  'failed',
];

// Canonical Payment Statuses
const PAYMENT_STATUSES = [
  'paid',
  'unpaid',
  'authorized',
  'partially_refunded',
  'refunded',
  'failed',
];

// Supported GCC/Regional Payment Methods
const PAYMENT_METHODS = [
  'credit_card',
  'apple_pay',
  'tabby',
  'tamara',
  'mada',
  'knet',
  'cash_on_delivery',
  'bank_transfer',
  'pos_terminal',
];

// Payment Ledger Transaction Types
const TRANSACTION_TYPES = [
  'authorization',
  'capture',
  'refund',
  'void',
  'cod_collection',
];

// Standard Linear Fulfillment Progression Stepper
const STATUS_PROGRESSION = [
  'confirmed',
  'packed',
  'shipped',
  'delivered',
];

// Helper validation checks
function isValidOrderStatus(status) {
  return ORDER_STATUSES.includes(status);
}

function isValidPaymentStatus(status) {
  return PAYMENT_STATUSES.includes(status);
}

function isValidPaymentMethod(method) {
  return PAYMENT_METHODS.includes(method);
}

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
