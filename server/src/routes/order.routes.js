const router = require('express').Router();
const Joi = require('joi');
const orderController = require('../controllers/order.controller');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const validate = require('../middleware/validate');
const { filterByCountryAccess } = require('../middleware/countryAccess');

const {
  ORDER_STATUSES,
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
} = require('../../../shared/order-constants.cjs');

// Validation Schemas
const createOrderSchema = Joi.object({
  country_id: Joi.number().integer().required(),
  customer_name: Joi.string().min(2).max(150).required(),
  customer_email: Joi.string().email().required(),
  customer_phone: Joi.string().min(5).max(50).required(),
  shipping_address: Joi.object({
    recipient_name: Joi.string().max(150).allow(null, '').optional(),
    phone: Joi.string().max(50).allow(null, '').optional(),
    address_line1: Joi.string().max(255).required(),
    address_line2: Joi.string().max(255).allow(null, '').optional(),
    city: Joi.string().max(100).required(),
    state_province_emirate: Joi.string().max(100).allow(null, '').optional(),
    country_code: Joi.string().max(10).allow(null, '').optional(),
    postal_code: Joi.string().max(20).allow(null, '').optional(),
    delivery_instructions: Joi.string().max(500).allow(null, '').optional(),
  }).required(),
  billing_address: Joi.object().allow(null).optional(),
  items: Joi.array()
    .items(
      Joi.object({
        product_id: Joi.number().integer().required(),
        quantity: Joi.number().integer().min(1).required(),
        unit_price: Joi.number().min(0).optional(),
      })
    )
    .min(1)
    .required(),
  shipping_fee: Joi.number().min(0).optional(),
  discount_amount: Joi.number().min(0).optional(),
  payment_method: Joi.string().valid(...PAYMENT_METHODS).optional(),
  payment_reference: Joi.string().max(100).allow(null, '').optional(),
  is_paid: Joi.boolean().truthy(1, '1', 'true', true).falsy(0, '0', 'false', false).optional(),
  status: Joi.string().valid(...ORDER_STATUSES).optional(),
  customer_notes: Joi.string().max(1000).allow(null, '').optional(),
  internal_notes: Joi.string().max(1000).allow(null, '').optional(),
  is_gift: Joi.boolean().truthy(1, '1', 'true', true).falsy(0, '0', 'false', false).optional(),
  gift_engraving_text: Joi.string().max(255).allow(null, '').optional(),
});

const updateStatusSchema = Joi.object({
  new_status: Joi.string().valid(...ORDER_STATUSES).required(),
  notes: Joi.string().max(500).allow(null, '').optional(),
  notified_customer: Joi.boolean().truthy(1, '1', 'true', true).falsy(0, '0', 'false', false).optional(),
});

const recordPaymentSchema = Joi.object({
  transaction_reference: Joi.string().max(100).required(),
  gateway: Joi.string().max(50).optional(),
  payment_method: Joi.string().valid(...PAYMENT_METHODS).required(),
  transaction_type: Joi.string().valid(...TRANSACTION_TYPES).optional(),
  amount: Joi.number().positive().required(),
  card_brand: Joi.string().max(30).allow(null, '').optional(),
  card_last4: Joi.string().max(4).allow(null, '').optional(),
  gateway_response: Joi.object().allow(null).optional(),
  notes: Joi.string().max(255).allow(null, '').optional(),
});

const recordRefundSchema = Joi.object({
  amount: Joi.number().positive().required(),
  transaction_reference: Joi.string().max(100).optional(),
  gateway: Joi.string().max(50).optional(),
  notes: Joi.string().max(255).allow(null, '').optional(),
  restock_items: Joi.boolean().truthy(1, '1', 'true', true).falsy(0, '0', 'false', false).optional(),
});

const updateShippingSchema = Joi.object({
  shipping_carrier: Joi.string().max(100).allow(null, '').optional(),
  tracking_number: Joi.string().max(100).allow(null, '').optional(),
  tracking_url: Joi.string().uri().allow(null, '').optional(),
  estimated_delivery_date: Joi.string().allow(null, '').optional(),
  mark_shipped: Joi.boolean().truthy(1, '1', 'true', true).falsy(0, '0', 'false', false).optional(),
});

const addNoteSchema = Joi.object({
  note: Joi.string().min(1).max(2000).required(),
  is_customer_visible: Joi.boolean().truthy(1, '1', 'true', true).falsy(0, '0', 'false', false).optional(),
});

router.use(auth());

// Order Analytics & Overview
router.get('/stats', requirePermission('orders.read'), filterByCountryAccess(), orderController.getOrderStats);

// Bulk Trash (must be before /:id). Country access is verified per order in the service.
const bulkIdsSchema = Joi.object({
  ids: Joi.array().items(Joi.number().integer().positive()).min(1).max(200).unique().required(),
});
router.post('/bulk/trash', requirePermission('orders.delete'), validate(bulkIdsSchema), orderController.bulkTrash);
router.post('/bulk/restore', requirePermission('orders.delete'), validate(bulkIdsSchema), orderController.bulkRestore);
router.post('/bulk/purge', requirePermission('orders.delete'), validate(bulkIdsSchema), orderController.bulkPurge);

// Order List & Details
router.get('/', requirePermission('orders.read'), filterByCountryAccess(), orderController.listOrders);
router.get('/:id', requirePermission('orders.read'), orderController.getOrder);
router.get('/:id/invoice', requirePermission('orders.read'), orderController.getInvoice);

// Order Creation
router.post(
  '/',
  requirePermission('orders.create'),
  filterByCountryAccess(),
  validate(createOrderSchema),
  orderController.createOrder
);

// Order Status & Fulfillment Actions
router.patch(
  '/:id/status',
  requirePermission('orders.update'),
  validate(updateStatusSchema),
  orderController.updateStatus
);

router.patch(
  '/:id/shipping',
  requirePermission('orders.update'),
  validate(updateShippingSchema),
  orderController.updateShipping
);

// Payment & Refund Ledger Actions
router.post(
  '/:id/payments',
  requirePermission('orders.update'),
  validate(recordPaymentSchema),
  orderController.recordPayment
);

router.post(
  '/:id/refunds',
  requirePermission('orders.update'),
  validate(recordRefundSchema),
  orderController.recordRefund
);

// Internal Notes
router.post(
  '/:id/notes',
  requirePermission('orders.update'),
  validate(addNoteSchema),
  orderController.addNote
);

module.exports = router;
