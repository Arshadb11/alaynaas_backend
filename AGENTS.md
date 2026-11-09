# Agent Guidelines — Ahmed Al Maghribi Admin Panel

Full-stack admin panel for luxury perfume catalog management, multi-country pricing, inventory, and role-based access control.

## Project Structure
- `client/` — Frontend SPA: React 19, Vite, Tailwind CSS v3, React Router v7, React Icons.
- `storefront/` — Customer-Facing E-Commerce Storefront: React 19, Vite, Tailwind CSS v3 (Milestone 14).
- `server/` — Backend API: Express 5, Node.js (`--watch`), MySQL2 (`perfume_admin`), Winston, JWT auth.
- `shared/` — Shared modules (e.g. `shared/permission-registry.js` for RBAC action keys).
- `ROADMAP.md` — Master development roadmap and future milestone specifications.

## Development Commands
| Scope | Command | Description |
|---|---|---|
| Client | `npm run dev` (in `client/`) | Starts Vite dev server on `http://localhost:5173` |
| Client | `npm run build` (in `client/`) | Validates JSX/CSS and builds production bundle |
| Server | `npm run dev` (in `server/`) | Starts Express API on `http://localhost:3000` with file watch |
| Server | `npm start` (in `server/`) | Production server startup |

## Database & Architecture Rules
- **Database**: MySQL/MariaDB with `mysql2/promise` pooled queries in `server/src/config/db.js`.
- **Bundles & Gift Sets (Option B)**:
  - Products table has `is_bundle BOOLEAN DEFAULT FALSE`.
  - Child items inside discovery boxes / gift sets live exclusively in `product_bundle_items` (`bundle_product_id -> products.id`).
  - Do NOT create separate `products` rows for sub-items/miniatures not sold individually.
- **Multi-Country Scope**:
  - Pricing, stock, and availability are partitioned by `country_id` in `product_country_pricing`.
  - Localized SEO titles/descriptions are partitioned by `country_id` in `product_country_seo`.
  - Users are scoped by assigned countries via `user_countries`.
- **Permissions & RBAC**:
  - Always register new permission keys in [permission-registry.js](file:///d:/Saood/Admin%20panel/shared/permission-registry.js).
  - Enforce backend permissions via `authorize('perm.key')` middleware.
  - Guard UI actions with `usePermission('perm.key')` or `<PermissionGate>`.

## Frontend UI Guidelines
- **Anti-Generic UI Rule**: The admin panel must never look like a generic dashboard template or an AI-generated interface. Every page, component, data table, form, and interaction must reflect the precision of an enterprise-grade product, designed by an experienced team of UI/UX designers and full-stack engineers. Prioritize clarity, efficiency, consistency, and usability, with a refined visual language that complements the brand’s premium UAE luxury perfumery identity.
- **No Emojis Rule**: Never use emojis in UI labels, badges, buttons, cards, headings, or system documentation. Use refined SVG icons (from `react-icons`) and polished typography instead to maintain a bespoke luxury aesthetic.
- Use Tailwind CSS v3 utility classes along with established design tokens (`surface-50` ... `surface-900`, `purple-*`, `indigo-*`).
- Maintain dark mode compatibility using `dark:` variants and glassmorphism cards (`glass-card`).
- Support Arabic bilingual inputs with `dir="rtl"` and `.font-arabic` where relevant.
- Always run `npm run build` in `client/` to verify syntax and bundling after editing frontend components.

## Configuration & Single Source of Truth (SSOT) Rules
- **No Duplicate Config Rule**: Never duplicate domain constants, enums, status dictionaries, color tokens, or label mappings across individual pages, components, or route validators.
- **Shared Domain Constants (`shared/`)**: Domain enums, state machine transitions, and cross-cutting constants must live in `shared/<module>-constants.js` (e.g. `shared/order-constants.js`), exported as dual CommonJS/ESM modules. Both server route Joi schemas/services and client configs MUST consume this single source of truth.
- **Client Presentation Config (`client/src/config/`)**: Presentation metadata (Tailwind badge colors, dot indicators, user-facing labels, select options, and safe getter fallbacks) must live in `client/src/config/<module>Config.js` (e.g. `client/src/config/orderConfig.js`).
- **Reusable Domain Badges**: Standard badge displays (e.g. fulfillment status pills, payment status badges) must be encapsulated into reusable UI components (e.g. `<OrderStatusBadge>`, `<PaymentStatusBadge>`) rather than re-implementing badge HTML/CSS/dot markup in every table, card, or modal.

