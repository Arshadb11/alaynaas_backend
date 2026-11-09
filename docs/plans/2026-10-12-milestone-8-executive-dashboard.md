# Milestone 8: Executive Commerce Command Center Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the legacy placeholder dashboard (`/dashboard`) into an enterprise-grade luxury commerce command center that unifies real-time revenue, order fulfillment streams, warehouse stock alerts, and quick operational triggers across GCC markets.

**Architecture:** Extend `Dashboard.jsx` using permission-isolated concurrent queries (`Promise.allSettled`) to consume `/api/orders/stats`, `/api/orders?limit=6`, and `/api/products?country_id=...`. Encapsulate reusable domain badges (`<OrderStatusBadge>`, `<PaymentStatusBadge>`, `<CountryFlag>`), and integrate the deep order inspector modal (`<OrderDetailModal>`) directly into the dashboard.

**Tech Stack:** React 19, Tailwind CSS v3 (glass-card tokens), React Icons (HiOutline*), `flagcdn.com` vector flags via `<CountryFlag>`, Express 5 API endpoints with RBAC guards.

---

### Task 1: Backend Low-Stock API Enhancement
Add a dedicated `low_stock=true` query filter to `product.service.js` and `product.routes.js` to allow fast querying of inventory items whose stock is `<= low_stock_threshold` in the active country.

**Files:**
- Modify: `server/src/services/product.service.js:150-205`
- Modify: `server/src/routes/product.routes.js:90-130`
- Test: `server/scripts/test_low_stock.js`

**Step 1: Write verification script to test low stock endpoint**
```javascript
// server/scripts/test_low_stock.js
const productService = require('../src/services/product.service');

(async () => {
  try {
    const result = await productService.listProducts(
      { low_stock: 'true', country_id: 1, limit: 5 },
      { id: 1, role_name: 'super_admin', permissions: ['products.read', 'products.update'] }
    );
    console.log('✓ Low stock products count:', result.products.length);
    process.exit(0);
  } catch (err) {
    console.error('✗ Test failed:', err.message);
    process.exit(1);
  }
})();
```

**Step 2: Run test to verify it fails/needs implementation**
Run: `node server/scripts/test_low_stock.js`

**Step 3: Implement `low_stock` condition in `product.service.js`**
In `listProducts`:
```javascript
if (query.low_stock === 'true' || query.low_stock === true) {
  whereConditions.push('pcp.stock_quantity <= pcp.low_stock_threshold');
}
```
And add `low_stock: Joi.boolean().truthy(1, '1', 'true', true).falsy(0, '0', 'false', false).optional()` to `product.routes.js` list query schema.

**Step 4: Run test to verify it passes**
Run: `node server/scripts/test_low_stock.js`
Expected: Output `✓ Low stock products count: N` with exit code 0.

---

### Task 2: Build Metric Cards & Commerce Ribbon in `Dashboard.jsx`
Replace the primitive stats cards with an enterprise 5-metric commerce ribbon displaying Realized Net Revenue, Average Order Value (AOV), Total Orders, Pending Packing, and Delivered count, scoped to the user's active country or assigned markets.

**Files:**
- Modify: `client/src/pages/Dashboard.jsx:1-170`

**Step 1: Import dependencies and config helpers**
```javascript
import { useCountry } from '../context/CountryContext';
import { formatCurrency } from '../utils/formatCurrency';
import CountryFlag from '../components/ui/CountryFlag';
import {
  HiOutlineCash,
  HiOutlineShoppingBag,
  HiOutlineTruck,
  HiOutlineCheckCircle,
  HiOutlineCube,
  HiOutlineExclamation,
  HiOutlineUsers,
  HiOutlineRefresh,
  HiOutlinePlus,
  HiOutlineArrowRight,
  HiOutlineExternalLink,
} from 'react-icons/hi';
```

**Step 2: Fetch Commerce Stats concurrently**
Fetch `/api/orders/stats` when user has `orders.read` permission, passing `country_id: selectedCountry?.id`. Compute and display:
- **Net Revenue**: Scoped with currency code and decimal places (2 for AED/SAR, 3 for KWD/BHR/OMR).
- **Average Order Value (AOV)**.
- **Total Orders**.
- **Pending Fulfillment** (Orders in `processing`, `confirmed`, `packed`).
- **Delivered Volume**.

**Step 3: Verification**
Run: `npm run build` in `client/` to verify zero compile errors.

---

### Task 3: Build Recent Orders Live Feed with Modal Inspector
Render the last 5-6 recent orders in a glassmorphism card with live status badges (`<OrderStatusBadge>`, `<PaymentStatusBadge>`), country flags (`<CountryFlag>`), and full interactivity to click and open `<OrderDetailModal>`.

**Files:**
- Modify: `client/src/pages/Dashboard.jsx`
- Import: `client/src/components/orders/OrderDetailModal.jsx`
- Import: `client/src/components/orders/OrderStatusBadge.jsx`
- Import: `client/src/components/orders/PaymentStatusBadge.jsx`

**Step 1: Wire Order Data Fetching**
Add query to `fetchStats` in `Dashboard.jsx`:
```javascript
if (canSeeOrders) {
  promises.push(
    api.get('/orders', { params: { limit: 5, country_id: selectedCountry?.id } })
      .then(res => ({ key: 'recentOrders', data: res.data?.data || [] }))
      .catch(() => ({ key: 'recentOrders', data: [] }))
  );
}
```

**Step 2: Wire Inspector State**
Add `inspectingOrderId` state in `Dashboard.jsx`:
```javascript
const [inspectingOrderId, setInspectingOrderId] = useState(null);
```
Render `<OrderDetailModal orderId={inspectingOrderId} onClose={() => setInspectingOrderId(null)} onOrderUpdated={fetchStats} />` when active.

**Step 3: Render Recent Orders List Table & Mobile Cards**
- Desktop: Clean minimalist table with Order #, Date/Time, Customer, Country Flag, Status, Payment, Amount, and View action button.
- Mobile: Compact card view with status badges and currency.
- Empty state: Clean illustrated state when no orders are found.

**Step 4: Verification**
Run: `npm run build` in `client/` to confirm syntax and bundle integrity.

---

### Task 4: Build Logistics & Low Stock Alert Radar
Render the right-hand column widget displaying low-stock alerts and out-of-stock items requiring inventory replenishment.

**Files:**
- Modify: `client/src/pages/Dashboard.jsx`

**Step 1: Wire Low Stock Query**
Add query to `fetchStats` in `Dashboard.jsx`:
```javascript
if (canSeeProducts && selectedCountry?.id) {
  promises.push(
    api.get('/products', { params: { low_stock: true, country_id: selectedCountry.id, limit: 5 } })
      .then(res => ({ key: 'lowStockProducts', data: res.data?.data || [] }))
      .catch(() => ({ key: 'lowStockProducts', data: [] }))
  );
}
```

**Step 2: Render Low Stock Widget**
- Display perfume thumbnail packshot (`primary_image_url`), product name, size, current warehouse stock, and threshold indicator.
- Amber badge for low stock (`stock > 0`), Red badge for out of stock (`stock <= 0`).
- Direct action link to open `/products` with search pre-filled or stock editing.
- Empty state: "All fragrances have healthy inventory levels in {country.name}".

**Step 3: Verification**
Run: `npm run build` in `client/` to ensure clean bundling.

---

### Task 5: Add Fast Action Trigger Bar & System Governance
Add a top action strip below the header for quick operational triggers, and a bottom row displaying system governance (active audit logs, user counts, and session security).

**Files:**
- Modify: `client/src/pages/Dashboard.jsx`

**Step 1: Quick Action Bar**
- `New Concierge Order`: Opens order creation or links to `/orders`.
- `Add Fragrance`: Direct link to `/products`.
- `Media Explorer`: Direct link to `/files`.
- `Audit Trail`: Direct link to `/audit-logs`.
- Market indicator with `<CountryFlag>` and selected store name.

**Step 2: Final Styling & Anti-Generic UI Audit**
- Verify zero emojis in labels, headings, cards, or badges.
- Verify full dark-mode compliance (`dark:bg-surface-850`, `dark:border-surface-700/80`).
- Responsive layout: Grid shifts seamlessly from single column on mobile (`grid-cols-1`) to multi-column on desktop (`lg:grid-cols-12`).

**Step 3: Verification**
Run: `npm run build` in `client/`.
Verify with browser or API curl that all dashboard data loads with HTTP 200.
