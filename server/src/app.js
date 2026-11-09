const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const roleRoutes = require('./routes/role.routes');
const logRoutes = require('./routes/log.routes');
const countryRoutes = require('./routes/country.routes');
const path = require('path');
const catalogRoutes = require('./routes/catalog.routes');
const productRoutes = require('./routes/product.routes');
const fileRoutes = require('./routes/file.routes');
const fragranceRoutes = require('./routes/fragrance.routes');
const orderRoutes = require('./routes/order.routes');
const storeRoutes = require('./routes/store.routes');
const settingsRoutes = require('./routes/settings.routes');

const app = express();

// ── Core Middleware ─────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Static Files (Local Disk Uploads) ───────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Request Logger (all API hits) ───────────────────────
app.use('/api', requestLogger('admin_panel'));

// ── Health Check ────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ──────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/countries', countryRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/pages', require('./routes/pages.routes'));
app.use('/api/journal', require('./routes/journal.routes'));
app.use('/api/contact-messages', require('./routes/contact.routes'));
app.use('/api/reviews', require('./routes/reviews.routes'));
app.use('/api/products', productRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/fragrance', fragranceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/settings', settingsRoutes);

// ── 404 Handler ─────────────────────────────────────────
app.use('/api/{*splat}', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ── Global Error Handler (must be last) ─────────────────
app.use(errorHandler);

module.exports = app;
