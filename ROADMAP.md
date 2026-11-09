# Development Roadmap & Future Milestone Specifications
Ahmed Al Maghribi Admin Panel

---

## 1. System Foundation & Architecture Principles

The Ahmed Al Maghribi Perfumes Admin Panel is designed as an enterprise-grade management system supporting luxury retail operations across the GCC (United Arab Emirates, Saudi Arabia, Kuwait, Qatar, Bahrain, and Oman).

All future features must strictly adhere to the project's core architectural tenets:
- **Single Source of Truth (SSOT)**: Domain constants and state transitions reside exclusively in `shared/<module>-constants.js`. Presentation configs reside in `client/src/config/<module>Config.js`.
- **Country Partitioning**: Stock, pricing, tax rates, and localized SEO titles/descriptions are strictly partitioned by `country_id`.
- **Role-Based Access Control (RBAC)**: Backend endpoints are protected by `authorize('permission.key')` and registered in `shared/permission-registry.js`. Frontend elements are guarded by `<PermissionGate>` or `usePermission()`.
- **Design Integrity**: Enterprise aesthetic reflecting UAE luxury perfumery. Zero emojis in UI or system documentation; high-precision SVG iconography and typography only.

---

## 2. Completed Milestones Reference

| Phase | Module | Scope Delivered |
|---|---|---|
| Milestone 1 | **Authentication & RBAC** | In-memory JWT + HttpOnly refresh token rotation, Redis token blacklisting, JTI tracking, user management, country assignment (`user_countries`), role presets (`/roles`), and active session management (`/sessions`). |
| Milestone 2 | **Governance & Audit** | Dual-write logging (Winston daily-rotated disk logs + MySQL `api_request_logs`), automated field change diffs (`field_change_logs`), and interactive audit explorer (`/audit-logs`). |
| Milestone 3 | **GCC Multi-Country Engine** | ISO country management (`/countries`), partitioned currencies (AED, SAR, KWD, QMR, BHD, OMR), 2 vs 3 decimal precision rules, regional tax rates, and vector national flags sourced from `flagcdn.com`. |
| Milestone 4 | **Olfactory Taxonomy & Brands** | Hierarchical categories with parent-child nesting (`/catalog`), brand management with country of origin, and comprehensive fragrance profile library with 3-tier olfactory pyramid notes (`/fragrance`). |
| Milestone 5 | **Catalog & Product Engine** | 6-tab product editor (`ProductEditor.jsx`), dynamic JSON specifications, per-country pricing/stock partitioning, localized SEO tags, Option B discovery bundles/gift sets (`product_bundle_items`), and catalog grid/table views. |
| Milestone 6 | **Local Media Storage** | Windows Explorer-style local disk storage (`/files`), folder trees, drag-and-drop packshot uploads, anti-path-traversal protection, and reusable `FilePickerModal`. |
| Milestone 7 | **Orders & Commerce Engine** | Full order lifecycle state machine (10 fulfillment states), 4-step concierge order creation wizard, deep order inspector modal, ledger reconciliation (captures, partial refunds, refunds), stock reservation/restock, vector PDF/print invoicing (`OrderInvoiceModal.jsx`), and live net realized revenue reporting. |
| Milestone 8 | **Executive Commerce Command Center** | Real-time commerce ribbons (Realized Net Revenue, AOV, Total Orders, Pending Packing, Delivered), live Recent Orders stream with one-click inspector linkage, regional Low-Stock radar with packshots, and quick operational action bar (`/dashboard`). |

---

## 3. Future Development Plans & Roadmaps

### Milestone 9: Customer Relationship Management (CRM) (`/customers`)
*Immediate Next Step*

#### Objective
Consolidate customer data from transactional orders into unified client profiles for VIP concierge handling, repeat order tracking, and high-net-worth client engagement.

#### Key Features
1. **Customer Directory**:
   - Searchable, filterable client list by name, phone, email, country, and VIP tier.
   - Direct visibility into Lifetime Value (LTV), total orders placed, and date of last purchase.
2. **Client Dossier & Profile View**:
   - Consolidated purchase history with direct links to past orders and PDF invoices.
   - Saved shipping and billing address book with recipient instructions.
   - Concierge notes and special preferences (e.g. preferred olfactory notes, custom bottle engraving history, VIP client tier tags).
3. **Database Architecture**:
   - Introduce dedicated `customers` and `customer_addresses` tables linked to `orders.customer_id`.
   - Automated customer record creation and profile aggregation upon order submission.

---

### Milestone 10: Promotions, Discounts & Campaign Engine (`/promotions`)

#### Objective
Empower marketing and sales teams to configure, schedule, and enforce targeted luxury promotional campaigns, coupon codes, and corporate gifting discounts across specific GCC territories.

#### Key Features
1. **Discount Rule Types**:
   - Percentage discount (e.g. 15% off select Oriental fragrances).
   - Fixed currency amount (e.g. 100 AED off orders above 500 AED).
   - Free shipping thresholds per country market.
   - Buy-One-Get-One (BOGO) or complimentary miniature sample incentives.
2. **Territory & Product Scoping**:
   - Country market restrictions (e.g. valid exclusively in UAE and Saudi Arabia).
   - Category, olfactory family, or specific fragrance inclusions/exclusions.
   - Minimum basket spend threshold and maximum discount caps.
3. **Validation & Ledger Integration**:
   - Start and end expiry timestamps.
   - Total usage limits and per-customer usage caps.
   - Integration into the Order Creation modal (`CreateOrderModal.jsx`) with live coupon validation.
4. **Database Architecture**:
   - Tables: `coupons`, `coupon_country_restrictions`, `coupon_product_restrictions`, `coupon_usage_logs`.

---

### Milestone 11: Central Warehouse & Bulk Inventory Logistics (`/inventory`)

#### Objective
Provide supply chain and warehouse personnel with a dedicated central inventory portal to track stock across all 6 GCC national warehouses, execute bulk adjustments, and manage inter-warehouse transfers.

#### Key Features
1. **Master Warehouse Grid**:
   - Unified table displaying all SKUs side-by-side with real-time stock levels across all configured countries (UAE, KSA, KWT, QAT, BHR, OMN).
   - Inline fast stock adjustments with mandatory audit reason logging (e.g. damaged stock, seasonal restock, reconciliation count).
2. **Reorder & Safety Stock Radar**:
   - Automatic filtering for low-stock and out-of-stock items.
   - Recommended replenishment quantities based on 30-day velocity.
3. **Inter-Warehouse Stock Transfers**:
   - Create transfer manifests (e.g. moving 500 units of Oud Royale from UAE Central Hub to Riyadh Warehouse).
   - Multi-step transfer workflow: Draft -> In Transit -> Received & Reconciled.
4. **Database Architecture**:
   - Tables: `inventory_transactions`, `stock_transfers`, `stock_transfer_items`.

---

### Milestone 12: Business Intelligence, Analytics & Data Exporting

#### Objective
Enable executive leadership and finance departments to export data, generate audit reports, and analyze fragrance performance across regional markets.

#### Key Features
1. **Export Engine**:
   - Single-click CSV and Excel exports on Orders, Products, Customers, Inventory, and Audit Logs.
   - Date range and regional market filtering prior to export.
2. **Commerce Reports**:
   - Financial ledger reconciliation exports (subtotals, VAT collected by country, shipping fees, net refunds).
   - Top-selling perfumes ranked by volume, revenue, and gross margin per country.
   - Olfactory trend analysis (revenue performance by olfactory family: Floral, Oriental, Woody, Fresh).

---

### Milestone 13: Courier API Integrations & Tracking Automation

#### Objective
Automate shipping fulfillment by integrating GCC domestic and international express couriers directly into the order dispatch workflow.

#### Key Features
1. **Supported Couriers**:
   - Aramex, DHL Express, SMSA Express, Fetchr, and local UAE courier APIs.
2. **Automated Waybill (AWB) Generation**:
   - One-click air waybill creation directly from the Order Detail inspector.
   - Generation of printable courier thermal shipping labels.
3. **Live Courier Tracking Webhooks**:
   - Inbound webhook handler updating order status (`shipped` -> `delivered` -> `returned`) automatically based on courier milestones.
   - Customer tracking number and live status synchronization.

---

### Milestone 14: E-Commerce Storefront Application (`storefront/`)

#### Objective
Create a customer-facing e-commerce storefront with a clean, high-end luxury design and full end-to-end integration with the existing Express backend API and MySQL database.

#### Architecture & Tech Stack
- **Directory**: `storefront/` — Dedicated customer-facing client application (React 19 + Vite, Tailwind CSS v3, React Router v7, React Icons).
- **Design System**: Refined, minimalist UAE luxury perfumery styling (rich neutral palette, dark & light modes, subtle gold accents, bespoke typography, responsive mobile-first layouts, zero emojis).
- **API Integration**: Direct consumption of the Express backend (`http://localhost:3000/api`) with multi-country pricing, real-time warehouse inventory checks, and automatic order creation.

#### Key Functional Modules & Server API Integrations
1. **Multi-Country Market & Currency Selector**:
   - Market switcher powered by `GET /api/countries`, setting active country context, localized currency (AED, SAR, KWD, QMR, BHD, OMR), tax rates, and decimal precision (2 vs 3 decimals).
2. **Catalog Browsing & Fragrance Discovery**:
   - **Homepage**: Hero banners, curated luxury fragrance collections, bestsellers, new arrivals, and discovery gift sets.
   - **Collection / Catalog Page (`/catalog`, `/collections`)**: Dynamic product catalog with filters powered by `GET /api/products` (category, olfactory notes/family, bottle size, gender, price range, and in-stock filter).
   - **Product Detail Page (`/product/:slug` or `/product/:id`)**: High-resolution packshot gallery, 3-tier olfactory pyramid (Top, Heart, Base notes), bottle size selector, bundle/gift set child item breakdowns (`product_bundle_items`), specifications, and live warehouse inventory status.
3. **Shopping Bag & Concierge Gifting**:
   - Persistent client-side cart state with local storage synchronization.
   - Real-time stock validation against warehouse inventory thresholds before checkout.
   - Luxury gifting options: Complimentary gift wrap, gift note inscription, and custom bottle engraving requests.
4. **End-to-End Checkout Flow & Order Dispatch**:
   - Streamlined multi-step checkout: Customer Contact Information -> Shipping Address (with GCC city/emirate selection) -> Payment Method (Credit Card, Apple Pay, Cash on Delivery).
   - Backend order dispatch via `POST /api/orders`:
     - Creates transactional records in `orders` and `order_items`.
     - Automatically decrements country-specific warehouse stock in `product_country_pricing`.
     - Automatically logs financial ledger breakdown (subtotals, localized country VAT, shipping fees).
5. **Order Confirmation & Customer Order Tracker**:
   - Instant order confirmation screen with unique dossier reference (`AM-AE-YYYYMM-XXXXX`).
   - Customer-facing order lookup/tracking page (`/track`) enabling clients to view fulfillment progress (`confirmed` -> `packing` -> `shipped` -> `delivered`).

