const router = require('express').Router();
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const storeController = require('../controllers/store.controller');
const validate = require('../middleware/validate');

/**
 * STOREFRONT SECURITY & RATE LIMITING
 * Protects public endpoints against DDoS, scraping, and high-volume brute forcing.
 */
const storefrontLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 120, // max 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again in a minute.',
  },
});

router.use(storefrontLimiter);

// ── Validation Schemas ──────────────────────────────────────────────
const listProductsQuerySchema = Joi.object({
  country_code: Joi.string().alphanum().min(2).max(5).uppercase().optional(),
  countryCode: Joi.string().alphanum().min(2).max(5).uppercase().optional(),
  category_slug: Joi.string().max(150).optional(),
  category_id: Joi.number().integer().positive().optional(),
  brand_slug: Joi.string().max(150).optional(),
  brand_id: Joi.number().integer().positive().optional(),
  olfactory_family_slug: Joi.string().max(150).optional(),
  olfactory_family_id: Joi.number().integer().positive().optional(),
  gender: Joi.string().valid('men', 'women', 'unisex').insensitive().optional(),
  is_featured: Joi.boolean().truthy('true', 1).falsy('false', 0).optional(),
  is_bundle: Joi.boolean().truthy('true', 1).falsy('false', 0).optional(),
  in_stock: Joi.boolean().truthy('true', 1).falsy('false', 0).optional(),
  q: Joi.string().max(100).allow('').optional(),
  sort: Joi.string().valid('price-asc', 'price-desc', 'name-asc', 'name-desc', 'featured', 'newest').optional(),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(50).default(20).optional(),
});

const getProductParamsSchema = Joi.object({
  slug: Joi.string().min(1).max(280).required(),
});

const getProductQuerySchema = Joi.object({
  country: Joi.string().alphanum().min(2).max(5).uppercase().default('AE').optional(),
});

const createOrderBodySchema = Joi.object({
  country_code: Joi.string().alphanum().min(2).max(5).uppercase().default('AE').optional(),
  customer: Joi.object({
    name: Joi.string().trim().min(2).max(150).required(),
    email: Joi.string().email().trim().max(150).required(),
    phone: Joi.string().trim().min(7).max(30).required(),
  }).required(),
  address: Joi.object({
    emirate: Joi.string().trim().max(100).required(),
    line: Joi.string().trim().min(3).max(500).required(),
    city: Joi.string().trim().max(100).optional().allow(''),
    country: Joi.string().trim().max(100).optional().allow(''),
  }).required(),
  payment: Joi.string().valid('cod', 'card', 'cash_on_delivery', 'credit_card', 'apple_pay').default('cod').optional(),
  payment_method: Joi.string().valid('cod', 'card', 'cash_on_delivery', 'credit_card', 'apple_pay').optional(),
  notes: Joi.string().trim().max(1000).allow('').optional(),
  currency: Joi.string().alphanum().min(3).max(5).uppercase().optional(),
  items: Joi.array().items(
    Joi.object({
      id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().pattern(/^\d+/)).required(),
      product_id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().pattern(/^\d+/)).optional(),
      qty: Joi.number().integer().min(1).max(99).required(),
      price: Joi.number().optional(), // Recalculated server-side from DB
      name: Joi.string().optional(),
      variant: Joi.string().trim().max(50).allow(null, '').optional(), // e.g. '10ml' — price resolved server-side
      variant_key: Joi.string().trim().max(50).allow(null, '').optional(),
    })
  ).min(1).required(),
  totals: Joi.object().optional(), // Recalculated server-side from DB
});

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  max: 30, // max 30 order attempts per IP per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many order requests. Please wait a few moments before trying again.',
  },
});

// ── Public Storefront Endpoints ─────────────────────────────────────
router.get('/settings', storeController.getSettings);
router.get('/countries', storeController.getCountries);
router.get('/categories', storeController.getCategories);
router.get('/menu', require('../controllers/menu.controller').publicMenu);
// Static pages (policies etc.) managed in Admin > Storefront > Pages
router.get('/pages', async (req, res, next) => {
  try { res.json({ success: true, data: await require('../services/pages.service').listPublic() }); } catch (e) { next(e); }
});
router.get('/pages/:slug', async (req, res, next) => {
  try { res.json({ success: true, data: await require('../services/pages.service').getPublic(String(req.params.slug).slice(0, 120)) }); } catch (e) { next(e); }
});
// Journal entries managed in Admin > Storefront > Journal
router.get('/journal', async (req, res, next) => {
  try { res.json({ success: true, data: await require('../services/journal.service').listPublic() }); } catch (e) { next(e); }
});
router.get('/journal/:slug', async (req, res, next) => {
  try { res.json({ success: true, data: await require('../services/journal.service').getPublic(String(req.params.slug).slice(0, 160)) }); } catch (e) { next(e); }
});
router.get('/brands', storeController.getBrands);
router.get('/fragrance-metadata', storeController.getFragranceMetadata);

router.get('/products', validate(listProductsQuerySchema, 'query'), storeController.listProducts);
router.get(
  '/products/:slug',
  validate(getProductParamsSchema, 'params'),
  validate(getProductQuerySchema, 'query'),
  storeController.getProduct
);

// Product reviews: public read of approved reviews, throttled submit (goes to admin moderation as 'pending')
const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many reviews submitted. Please try again later.' },
});
const reviewSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().lowercase().email().max(150).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  title: Joi.string().trim().max(150).allow('').optional(),
  body: Joi.string().trim().min(10).max(3000).required(),
  website: Joi.string().allow('').optional(), // honeypot: real users leave it empty
});
// Contact form: throttled, honeypot-protected; stored for the admin (Admin > Storefront > Contact)
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many messages sent. Please try again later.' },
});
const contactSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().lowercase().email().max(150).required(),
  phone: Joi.string().trim().max(40).allow('').optional(),
  subject: Joi.string().trim().max(150).allow('').optional(),
  message: Joi.string().trim().min(10).max(3000).required(),
  website: Joi.string().allow('').optional(), // honeypot
});
router.post('/contact', contactLimiter, validate(contactSchema, 'body'), async (req, res, next) => {
  try {
    if (req.body.website) return res.status(201).json({ success: true, data: { submitted: true } });
    const data = await require('../services/contact.service').submit(req.body, req.ip);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
});
// Atelier: compose a personal perfume (rules engine), view it by share code, reserve it (becomes a lead)
const atelierLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: 'Too many creations. Please try again later.' },
});
const reserveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});
const atelierCodeSchema = Joi.object({ code: Joi.string().trim().pattern(/^AL-[A-Z0-9]{5}$/i).required() });
const atelierComposeSchema = Joi.object({
  answers: Joi.object().required(),
  label_name: Joi.string().trim().max(40).allow('').optional(),
  lang: Joi.string().valid('en', 'ar').optional(),
});
const atelierReserveSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  phone: Joi.string().trim().pattern(/^[+0-9 ()-]{7,20}$/).required(),
  email: Joi.string().trim().lowercase().email().max(150).allow('').optional(),
  size: Joi.string().valid('30', '50', '100').allow('').optional(),
  website: Joi.string().allow('').optional(), // honeypot
});
router.post('/atelier', atelierLimiter, validate(atelierComposeSchema, 'body'), async (req, res, next) => {
  try { res.status(201).json({ success: true, data: await require('../services/atelier.service').create(req.body, req.ip) }); } catch (e) { next(e); }
});
router.get('/atelier/:code', validate(atelierCodeSchema, 'params'), async (req, res, next) => {
  try { res.json({ success: true, data: await require('../services/atelier.service').get(req.params.code) }); } catch (e) { next(e); }
});
router.post('/atelier/:code/reserve', reserveLimiter, validate(atelierCodeSchema, 'params'), validate(atelierReserveSchema, 'body'), async (req, res, next) => {
  try {
    if (req.body.website) return res.status(201).json({ success: true, data: { reserved: true } });
    res.status(201).json({ success: true, data: await require('../services/atelier.service').reserve(req.params.code, req.body) });
  } catch (e) { next(e); }
});
router.get('/reviews/featured', async (req, res, next) => {
  try { res.json({ success: true, data: await require('../services/reviews.service').listFeatured(req.query.limit) }); } catch (e) { next(e); }
});
router.get('/products/:slug/reviews', validate(getProductParamsSchema, 'params'), async (req, res, next) => {
  try { res.json({ success: true, data: await require('../services/reviews.service').listPublic(req.params.slug) }); } catch (e) { next(e); }
});
router.post('/products/:slug/reviews', reviewLimiter, validate(getProductParamsSchema, 'params'), validate(reviewSchema, 'body'), async (req, res, next) => {
  try {
    if (req.body.website) return res.status(201).json({ success: true, data: { submitted: true } }); // bot: pretend success
    const data = await require('../services/reviews.service').submit(req.params.slug, req.body, req.ip);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
});
router.post(
  '/orders',
  checkoutLimiter,
  validate(createOrderBodySchema, 'body'),
  storeController.createOrder
);

// Footer newsletter sign-up: strict rate limit, validated email, always answers the same (no enumeration)
const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts. Please try again later.' },
});
const newsletterSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().max(150).required(),
  lang: Joi.string().valid('en', 'ar').default('en'),
});
router.post('/newsletter', newsletterLimiter, validate(newsletterSchema, 'body'), async (req, res, next) => {
  try {
    const db = require('../config/db');
    await db.query('INSERT IGNORE INTO newsletter_subscribers (email, lang, ip) VALUES (?, ?, ?)', [req.body.email, req.body.lang, req.ip]);
    res.status(201).json({ success: true, data: { subscribed: true } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
