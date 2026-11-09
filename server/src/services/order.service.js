const db = require('../config/db');
const countryService = require('./country.service');
const loggerService = require('./logger.service');

// State transition validation matrix
const ALLOWED_STATUS_TRANSITIONS = {
  pending_payment: ['processing', 'failed', 'cancelled', 'on_hold'],
  processing: ['confirmed', 'on_hold', 'cancelled'],
  confirmed: ['packed', 'on_hold', 'cancelled'],
  packed: ['shipped', 'on_hold', 'cancelled'],
  shipped: ['delivered', 'returned', 'cancelled'],
  delivered: ['returned', 'refunded'],
  on_hold: ['pending_payment', 'processing', 'confirmed', 'packed', 'cancelled'],
  cancelled: [], // Terminal
  refunded: [],  // Terminal
  returned: ['refunded'],
  failed: ['pending_payment', 'cancelled'],
};

// Statuses at which an order holds reserved stock that is not yet shipped.
// Trashing returns this stock; restoring re-reserves it.
const STOCK_HELD_STATUSES = ['confirmed', 'processing', 'packed'];

class OrderService {
  /**
   * Helper: trashed orders are read-only — they must be restored first.
   */
  _assertNotTrashed(order) {
    if (order && order.deleted_at) {
      throw Object.assign(new Error('This order is in Trash. Restore it before making changes.'), { statusCode: 400 });
    }
  }

  /**
   * Helper: Check if a user has access to a specific country
   */
  async _assertCountryAccess(user, countryId) {
    if (user.permissions && user.permissions.includes('countries.manage')) {
      return true;
    }
    const hasAccess = await countryService.userHasCountryAccess(user.id, countryId);
    if (!hasAccess) {
      throw Object.assign(new Error('You do not have permission to view or manage orders in this country.'), {
        statusCode: 403,
      });
    }
    return true;
  }

  /**
   * Helper: Get array of allowed country IDs for the user
   */
  async _getAllowedCountryIds(user) {
    if (user.permissions && user.permissions.includes('countries.manage')) {
      return null; // null means ALL countries
    }
    return countryService.getUserCountryIds(user.id);
  }

  /**
   * Generate next sequential order number: AM-{COUNTRY_CODE}-{YYYYMM}-{00001}
   */
  async generateOrderNumber(countryCode) {
    const code = (countryCode || 'AE').toUpperCase();
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `AM-${code}-${yearMonth}-`;

    // Use the highest existing sequence (not COUNT) so purged orders can't cause duplicates
    const [row] = await db.query(
      "SELECT MAX(CAST(SUBSTRING(order_number, ?) AS UNSIGNED)) AS max_seq FROM orders WHERE order_number LIKE CONCAT(?, '%')",
      [prefix.length + 1, prefix]
    );
    const sequence = String((row?.max_seq || 0) + 1).padStart(5, '0');
    return `${prefix}${sequence}`;
  }

  /**
   * List orders with filtering, country-scoping, and pagination
   */
  async listOrders(query = {}, user) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
    const offset = (page - 1) * limit;

    const allowedCountryIds = await this._getAllowedCountryIds(user);

    // Trash view shows only trashed orders; the normal view hides them
    const showTrashed = ['true', '1'].includes(String(query.trashed));
    const conditions = [showTrashed ? 'o.deleted_at IS NOT NULL' : 'o.deleted_at IS NULL'];
    const params = [];

    // Country filter
    if (query.country_id) {
      const countryId = parseInt(query.country_id);
      await this._assertCountryAccess(user, countryId);
      conditions.push('o.country_id = ?');
      params.push(countryId);
    } else if (allowedCountryIds !== null) {
      if (allowedCountryIds.length === 0) {
        return { data: [], pagination: { total: 0, page, limit, totalPages: 0 } };
      }
      conditions.push(`o.country_id IN (${allowedCountryIds.map(() => '?').join(', ')})`);
      params.push(...allowedCountryIds);
    }

    // Status filter
    if (query.status) {
      conditions.push('o.status = ?');
      params.push(query.status);
    }

    // Payment status filter
    if (query.payment_status) {
      conditions.push('o.payment_status = ?');
      params.push(query.payment_status);
    }

    // Payment method filter
    if (query.payment_method) {
      conditions.push('o.payment_method = ?');
      params.push(query.payment_method);
    }

    // Date range filters
    if (query.date_from) {
      conditions.push('o.created_at >= ?');
      params.push(`${query.date_from} 00:00:00`);
    }
    if (query.date_to) {
      conditions.push('o.created_at <= ?');
      params.push(`${query.date_to} 23:59:59`);
    }

    // Search query
    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        '(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ? OR o.customer_phone LIKE ? OR o.tracking_number LIKE ?)'
      );
      params.push(s, s, s, s, s);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const [countRow] = await db.query(
      `SELECT COUNT(*) AS total FROM orders o ${whereClause}`,
      params
    );
    const total = countRow?.total || 0;

    // Sorting
    const allowedSortFields = ['created_at', 'total_amount', 'status', 'order_number'];
    const sortBy = allowedSortFields.includes(query.sort_by) ? `o.${query.sort_by}` : 'o.created_at';
    const sortDir = (query.sort_dir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Fetch orders with item count and country details
    const orders = await db.query(
      `SELECT 
        o.id,
        o.order_number,
        o.country_id,
        c.code AS country_code,
        c.name AS country_name,
        c.decimal_places,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.currency_code,
        o.currency_symbol,
        o.subtotal,
        o.shipping_fee,
        o.tax_amount,
        o.tax_percentage,
        o.discount_amount,
        o.total_amount,
        o.total_paid,
        o.total_refunded,
        o.payment_status,
        o.payment_method,
        o.status,
        o.shipping_carrier,
        o.tracking_number,
        o.is_gift,
        o.created_at,
        o.deleted_at,
        o.updated_at,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS items_count,
        (SELECT GROUP_CONCAT(product_name SEPARATOR ', ') FROM order_items WHERE order_id = o.id LIMIT 3) AS items_preview
       FROM orders o
       JOIN countries c ON c.id = o.country_id
       ${whereClause}
       ORDER BY ${sortBy} ${sortDir}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      data: orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get commerce statistics partitioned by country / user access
   */
  async getOrderStats(query = {}, user) {
    const allowedCountryIds = await this._getAllowedCountryIds(user);
    const conditions = ['o.deleted_at IS NULL']; // trashed orders never count in stats
    const params = [];

    if (query.country_id) {
      const countryId = parseInt(query.country_id);
      await this._assertCountryAccess(user, countryId);
      conditions.push('o.country_id = ?');
      params.push(countryId);
    } else if (allowedCountryIds !== null) {
      if (allowedCountryIds.length === 0) {
        return {
          total_orders: 0,
          total_revenue: '0.000',
          pending_fulfillment: 0,
          delivered_count: 0,
          by_status: {},
        };
      }
      conditions.push(`o.country_id IN (${allowedCountryIds.map(() => '?').join(', ')})`);
      params.push(...allowedCountryIds);
    }

    if (query.date_from) {
      conditions.push('o.created_at >= ?');
      params.push(`${query.date_from} 00:00:00`);
    }
    if (query.date_to) {
      conditions.push('o.created_at <= ?');
      params.push(`${query.date_to} 23:59:59`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [stats] = await db.query(
      `SELECT 
         COUNT(*) AS total_orders,
         IFNULL(SUM(
           CASE 
             WHEN o.payment_status IN ('paid', 'partially_refunded') 
               THEN GREATEST(0, IF(o.total_paid > 0, o.total_paid - o.total_refunded, o.total_amount - o.total_refunded))
             ELSE 0 
           END
         ), 0) AS total_revenue,
         IFNULL(SUM(o.total_refunded), 0) AS total_refunded,
         IFNULL(SUM(CASE WHEN o.status IN ('processing', 'confirmed', 'packed') THEN 1 ELSE 0 END), 0) AS pending_fulfillment,
         IFNULL(SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered_count,
         IFNULL(AVG(CASE WHEN o.status != 'cancelled' THEN o.total_amount ELSE NULL END), 0) AS aov
       FROM orders o
       ${whereClause}`,
      params
    );

    // Group by status
    const statusCounts = await db.query(
      `SELECT o.status, COUNT(*) AS count 
       FROM orders o 
       ${whereClause} 
       GROUP BY o.status`,
      params
    );

    const byStatus = {};
    for (const sc of statusCounts) {
      byStatus[sc.status] = sc.count;
    }

    return {
      total_orders: stats?.total_orders || 0,
      total_revenue: parseFloat(stats?.total_revenue || 0).toFixed(3),
      total_refunded: parseFloat(stats?.total_refunded || 0).toFixed(3),
      pending_fulfillment: stats?.pending_fulfillment || 0,
      delivered_count: stats?.delivered_count || 0,
      aov: parseFloat(stats?.aov || 0).toFixed(3),
      by_status: byStatus,
    };
  }

  /**
   * Get single order by ID with line items, payments ledger, history, and notes
   */
  async getOrderById(orderId, user) {
    const [order] = await db.query(
      `SELECT 
        o.*,
        c.name AS country_name,
        c.code AS country_code,
        c.decimal_places,
        u.full_name AS created_by_user_name
       FROM orders o
       JOIN countries c ON c.id = o.country_id
       LEFT JOIN users u ON u.id = o.created_by_user_id
       WHERE o.id = ?`,
      [orderId]
    );

    if (!order) {
      throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    }

    await this._assertCountryAccess(user, order.country_id);

    // Safely parse JSON columns
    if (typeof order.shipping_address === 'string') {
      try {
        order.shipping_address = JSON.parse(order.shipping_address);
      } catch (_) {}
    }
    if (typeof order.billing_address === 'string') {
      try {
        order.billing_address = JSON.parse(order.billing_address);
      } catch (_) {}
    }

    // Fetch line items
    const items = await db.query(
      `SELECT 
        oi.*,
        p.slug AS product_slug
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC`,
      [orderId]
    );

    // Parse bundle snapshots
    for (const item of items) {
      if (item.bundle_items_snapshot && typeof item.bundle_items_snapshot === 'string') {
        try {
          item.bundle_items_snapshot = JSON.parse(item.bundle_items_snapshot);
        } catch (_) {}
      }
    }
    order.items = items;

    // Fetch payments ledger
    const payments = await db.query(
      `SELECT 
        op.*,
        u.full_name AS recorded_by_user_name
       FROM order_payments op
       LEFT JOIN users u ON u.id = op.recorded_by_user_id
       WHERE op.order_id = ?
       ORDER BY op.created_at DESC, op.id DESC`,
      [orderId]
    );
    for (const p of payments) {
      if (p.gateway_response && typeof p.gateway_response === 'string') {
        try {
          p.gateway_response = JSON.parse(p.gateway_response);
        } catch (_) {}
      }
    }
    order.payments = payments;

    // Fetch status history
    const history = await db.query(
      `SELECT 
        osh.*,
        u.full_name AS changed_by_name
       FROM order_status_history osh
       LEFT JOIN users u ON u.id = osh.changed_by_user_id
       WHERE osh.order_id = ?
       ORDER BY osh.created_at ASC`,
      [orderId]
    );
    order.status_history = history;

    // Fetch internal staff notes
    const notes = await db.query(
      `SELECT 
        onote.*,
        u.full_name AS author_name
       FROM order_notes onote
       JOIN users u ON u.id = onote.author_id
       WHERE onote.order_id = ?
       ORDER BY onote.created_at DESC`,
      [orderId]
    );
    order.notes = notes;

    return order;
  }

  /**
   * Create a manual/concierge order inside a MySQL atomic transaction
   */
  async createOrder(data, user) {
    const {
      country_id,
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      billing_address,
      items = [],
      shipping_fee = 0,
      discount_amount = 0,
      payment_method = 'credit_card',
      payment_reference = null,
      is_paid = false,
      status = 'confirmed',
      customer_notes = null,
      internal_notes = null,
      is_gift = false,
      gift_engraving_text = null,
    } = data;

    const countryId = parseInt(country_id);
    await this._assertCountryAccess(user, countryId);

    // Fetch country details
    const [country] = await db.query('SELECT * FROM countries WHERE id = ?', [countryId]);
    if (!country) {
      throw Object.assign(new Error('Target country does not exist'), { statusCode: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw Object.assign(new Error('An order must contain at least one item'), { statusCode: 400 });
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
      const orderNumber = await this.generateOrderNumber(country.code);

      // Validate products, calculate exact line items and check stock
      let calculatedSubtotal = 0;
      const preparedItems = [];

      for (const item of items) {
        const productId = parseInt(item.product_id);
        const quantity = Math.max(1, parseInt(item.quantity) || 1);

        // Fetch product & pricing
        const [prod] = await conn.execute(
          `SELECT p.id, p.name, p.name_ar, p.sku, p.is_bundle, ps.name AS size_name,
            (SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order ASC LIMIT 1) AS image_url
           FROM products p
           LEFT JOIN product_sizes ps ON ps.id = p.size_id
           WHERE p.id = ? AND p.deleted_at IS NULL`,
          [productId]
        );

        if (!prod[0]) {
          throw Object.assign(new Error(`Product ID #${productId} not found`), { statusCode: 400 });
        }

        // Fetch country pricing and lock stock row
        const [pricing] = await conn.execute(
          `SELECT price, cost_price, stock_quantity, is_available 
           FROM product_country_pricing 
           WHERE product_id = ? AND country_id = ? FOR UPDATE`,
          [productId, countryId]
        );

        if (!pricing[0]) {
          throw Object.assign(
            new Error(`Product '${prod[0].name}' is not configured for country ${country.name}`),
            { statusCode: 400 }
          );
        }

        const unitPrice = item.unit_price !== undefined ? parseFloat(item.unit_price) : parseFloat(pricing[0].price);
        const costPrice = pricing[0].cost_price !== null ? parseFloat(pricing[0].cost_price) : null;
        const lineTotal = unitPrice * quantity;
        calculatedSubtotal += lineTotal;

        // If status is confirmed/processing, ensure stock is sufficient
        if (['confirmed', 'processing'].includes(status)) {
          if (pricing[0].stock_quantity < quantity) {
            throw Object.assign(
              new Error(
                `Insufficient stock for '${prod[0].name}'. Available: ${pricing[0].stock_quantity}, requested: ${quantity}`
              ),
              { statusCode: 400 }
            );
          }
        }

        // Bundle child snapshotting
        let bundleSnapshot = null;
        if (prod[0].is_bundle) {
          const [bundleChildren] = await conn.execute(
            `SELECT id, name, name_ar, size, quantity, image_url, scent_profile 
             FROM product_bundle_items 
             WHERE bundle_product_id = ? 
             ORDER BY sort_order ASC, id ASC`,
            [productId]
          );
          bundleSnapshot = bundleChildren;
        }

        preparedItems.push({
          product_id: productId,
          product_name: prod[0].name,
          product_name_ar: prod[0].name_ar,
          sku: prod[0].sku || `SKU-${productId}`,
          size_name: prod[0].size_name || null,
          image_url: prod[0].image_url || null,
          unit_price: unitPrice,
          cost_price: costPrice,
          quantity,
          line_total: lineTotal,
          is_bundle: Boolean(prod[0].is_bundle),
          bundle_items_snapshot: bundleSnapshot ? JSON.stringify(bundleSnapshot) : null,
        });
      }

      // Compute exact financial sums
      const subtotal = calculatedSubtotal;
      const parsedShippingFee = Math.max(0, parseFloat(shipping_fee) || 0);
      const parsedDiscount = Math.max(0, parseFloat(discount_amount) || 0);
      const taxPercentage = parseFloat(country.tax_percentage) || 5.00;
      const taxableBase = Math.max(0, subtotal - parsedDiscount);
      const taxAmount = parseFloat(((taxableBase * taxPercentage) / 100).toFixed(3));
      const totalAmount = parseFloat((taxableBase + taxAmount + parsedShippingFee).toFixed(3));

      const initialPaid = is_paid ? totalAmount : 0.000;
      const initialPaymentStatus = is_paid ? 'paid' : 'unpaid';

      // 1. Insert order record
      const [orderResult] = await conn.execute(
        `INSERT INTO orders (
          order_number, country_id, customer_name, customer_email, customer_phone,
          currency_code, currency_symbol, subtotal, shipping_fee, tax_percentage,
          tax_amount, discount_amount, total_amount, payment_status, payment_method,
          total_paid, total_refunded, status, shipping_address, billing_address,
          customer_notes, internal_notes, is_gift, gift_engraving_text, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderNumber,
          countryId,
          customer_name,
          customer_email,
          customer_phone,
          country.currency_code,
          country.currency_symbol,
          subtotal,
          parsedShippingFee,
          taxPercentage,
          taxAmount,
          parsedDiscount,
          totalAmount,
          initialPaymentStatus,
          payment_method,
          initialPaid,
          0.000,
          status,
          JSON.stringify(shipping_address || {}),
          billing_address ? JSON.stringify(billing_address) : null,
          customer_notes || null,
          internal_notes || null,
          is_gift ? 1 : 0,
          gift_engraving_text || null,
          user.id,
        ]
      );

      const orderId = orderResult.insertId;

      // 2. Insert line items & deduct stock if confirmed
      for (const item of preparedItems) {
        await conn.execute(
          `INSERT INTO order_items (
            order_id, product_id, product_name, product_name_ar, sku,
            size_name, image_url, unit_price, cost_price, quantity,
            line_total, is_bundle, bundle_items_snapshot
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            item.product_id,
            item.product_name,
            item.product_name_ar,
            item.sku,
            item.size_name,
            item.image_url,
            item.unit_price,
            item.cost_price,
            item.quantity,
            item.line_total,
            item.is_bundle ? 1 : 0,
            item.bundle_items_snapshot,
          ]
        );

        if (['confirmed', 'processing'].includes(status)) {
          await conn.execute(
            `UPDATE product_country_pricing 
             SET stock_quantity = stock_quantity - ? 
             WHERE product_id = ? AND country_id = ?`,
            [item.quantity, item.product_id, countryId]
          );
        }
      }

      // 3. Record initial payment if marked as paid
      if (is_paid) {
        await conn.execute(
          `INSERT INTO order_payments (
            order_id, transaction_reference, gateway, payment_method,
            transaction_type, amount, currency_code, status, notes, recorded_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            payment_reference || `MANUAL-${Date.now()}`,
            'manual',
            payment_method,
            'capture',
            totalAmount,
            country.currency_code,
            'successful',
            'Initial order payment',
            user.id,
          ]
        );
      }

      // 4. Initial status history
      await conn.execute(
        `INSERT INTO order_status_history (
          order_id, old_status, new_status, changed_by_user_id, notes, notified_customer
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, null, status, user.id, 'Order created in system', 0]
      );

      // 5. Add internal note if provided
      if (internal_notes) {
        await conn.execute(
          `INSERT INTO order_notes (order_id, author_id, note, is_customer_visible)
           VALUES (?, ?, ?, 0)`,
          [orderId, user.id, internal_notes]
        );
      }

      await conn.commit();

      // Log system audit event
      await loggerService.logAction({
        userId: user.id,
        userEmail: user.email,
        action: 'order.create',
        category: 'orders',
        targetType: 'orders',
        targetId: orderId,
        targetLabel: orderNumber,
        details: { order_number: orderNumber, total_amount: totalAmount, country_id: countryId },
      });

      return this.getOrderById(orderId, user);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Update order status with state machine checks, inventory restock/deduction, and history
   */
  async updateOrderStatus(orderId, { new_status, notes, notified_customer = false }, user) {
    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
      const [order] = await conn.execute('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
      if (!order[0]) {
        throw Object.assign(new Error('Order not found'), { statusCode: 404 });
      }
      this._assertNotTrashed(order[0]);

      await this._assertCountryAccess(user, order[0].country_id);

      const oldStatus = order[0].status;
      if (oldStatus === new_status) {
        await conn.rollback();
        return { success: true, message: 'Status already up to date' };
      }

      // Check transition validity
      const allowedNext = ALLOWED_STATUS_TRANSITIONS[oldStatus] || [];
      if (!allowedNext.includes(new_status)) {
        throw Object.assign(
          new Error(`Cannot transition order status from '${oldStatus}' to '${new_status}'. Allowed: ${allowedNext.join(', ') || 'none'}`),
          { statusCode: 400 }
        );
      }

      // Fetch items for inventory synchronization
      const [items] = await conn.execute('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId]);

      // Deduct stock if transitioning from non-deducted to deducted
      const previouslyDeducted = ['confirmed', 'processing', 'packed', 'shipped', 'delivered'].includes(oldStatus);
      const shouldBeDeducted = ['confirmed', 'processing', 'packed', 'shipped', 'delivered'].includes(new_status);

      if (!previouslyDeducted && shouldBeDeducted) {
        for (const item of items) {
          const [pricing] = await conn.execute(
            'SELECT stock_quantity FROM product_country_pricing WHERE product_id = ? AND country_id = ? FOR UPDATE',
            [item.product_id, order[0].country_id]
          );
          if (!pricing[0] || pricing[0].stock_quantity < item.quantity) {
            throw Object.assign(
              new Error(`Insufficient stock to confirm order for product ID #${item.product_id}`),
              { statusCode: 400 }
            );
          }
          await conn.execute(
            'UPDATE product_country_pricing SET stock_quantity = stock_quantity - ? WHERE product_id = ? AND country_id = ?',
            [item.quantity, item.product_id, order[0].country_id]
          );
        }
      }

      // Restock inventory if cancelled or returned from a deducted state
      if (previouslyDeducted && ['cancelled', 'returned'].includes(new_status)) {
        for (const item of items) {
          await conn.execute(
            'UPDATE product_country_pricing SET stock_quantity = stock_quantity + ? WHERE product_id = ? AND country_id = ?',
            [item.quantity, item.product_id, order[0].country_id]
          );
        }
      }

      // Update timestamps
      let extraSet = '';
      const setParams = [new_status];
      if (new_status === 'shipped' && !order[0].dispatched_at) {
        extraSet += ', dispatched_at = CURRENT_TIMESTAMP';
      }
      if (new_status === 'delivered' && !order[0].delivered_at) {
        extraSet += ', delivered_at = CURRENT_TIMESTAMP';
      }

      await conn.execute(
        `UPDATE orders SET status = ? ${extraSet} WHERE id = ?`,
        [...setParams, orderId]
      );

      // Record history
      await conn.execute(
        `INSERT INTO order_status_history (
          order_id, old_status, new_status, changed_by_user_id, notes, notified_customer
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, oldStatus, new_status, user.id, notes || null, notified_customer ? 1 : 0]
      );

      await conn.commit();

      await loggerService.logAction({
        userId: user.id,
        userEmail: user.email,
        action: 'order.status_update',
        category: 'orders',
        targetType: 'orders',
        targetId: orderId,
        targetLabel: order[0].order_number,
        details: { old_status: oldStatus, new_status },
      });

      return { success: true, old_status: oldStatus, new_status };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Record a payment transaction and reconcile order balance
   */
  async recordPayment(orderId, paymentData, user) {
    const {
      transaction_reference,
      gateway = 'manual',
      payment_method,
      transaction_type = 'capture',
      amount,
      card_brand = null,
      card_last4 = null,
      gateway_response = null,
      notes = null,
    } = paymentData;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw Object.assign(new Error('Payment amount must be greater than zero'), { statusCode: 400 });
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
      const [order] = await conn.execute('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
      if (!order[0]) {
        throw Object.assign(new Error('Order not found'), { statusCode: 404 });
      }
      this._assertNotTrashed(order[0]);

      await this._assertCountryAccess(user, order[0].country_id);

      // 1. Insert transaction into order_payments
      await conn.execute(
        `INSERT INTO order_payments (
          order_id, transaction_reference, gateway, payment_method,
          transaction_type, amount, currency_code, status,
          card_brand, card_last4, gateway_response, notes, recorded_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          transaction_reference || `PAY-${Date.now()}`,
          gateway,
          payment_method || order[0].payment_method,
          transaction_type,
          parsedAmount,
          order[0].currency_code,
          'successful',
          card_brand,
          card_last4,
          gateway_response ? JSON.stringify(gateway_response) : null,
          notes,
          user.id,
        ]
      );

      // 2. Reconcile balance
      const [totals] = await conn.execute(
        `SELECT 
           IFNULL(SUM(CASE WHEN transaction_type IN ('capture', 'cod_collection') AND status = 'successful' THEN amount ELSE 0 END), 0) AS total_paid,
           IFNULL(SUM(CASE WHEN transaction_type = 'refund' AND status = 'successful' THEN amount ELSE 0 END), 0) AS total_refunded
         FROM order_payments WHERE order_id = ?`,
        [orderId]
      );

      const totalPaid = parseFloat(totals[0].total_paid);
      const totalRefunded = parseFloat(totals[0].total_refunded);
      const orderTotal = parseFloat(order[0].total_amount);

      let newPaymentStatus = 'unpaid';
      if (totalRefunded >= totalPaid && totalRefunded > 0) {
        newPaymentStatus = 'refunded';
      } else if (totalRefunded > 0) {
        newPaymentStatus = 'partially_refunded';
      } else if (totalPaid >= orderTotal) {
        newPaymentStatus = 'paid';
      } else if (totalPaid > 0) {
        newPaymentStatus = 'authorized';
      }

      await conn.execute(
        `UPDATE orders 
         SET total_paid = ?, total_refunded = ?, payment_status = ?, payment_method = ?
         WHERE id = ?`,
        [totalPaid, totalRefunded, newPaymentStatus, payment_method || order[0].payment_method, orderId]
      );

      await conn.commit();

      await loggerService.logAction({
        userId: user.id,
        userEmail: user.email,
        action: 'order.payment_recorded',
        category: 'orders',
        targetType: 'orders',
        targetId: orderId,
        targetLabel: order[0].order_number,
        details: { amount: parsedAmount, transaction_reference, payment_status: newPaymentStatus },
      });

      return {
        success: true,
        total_paid: totalPaid,
        total_refunded: totalRefunded,
        payment_status: newPaymentStatus,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Record a refund transaction and optionally restock items
   */
  async recordRefund(orderId, refundData, user) {
    const {
      amount,
      transaction_reference,
      gateway = 'manual',
      notes = null,
      restock_items = false,
    } = refundData;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw Object.assign(new Error('Refund amount must be greater than zero'), { statusCode: 400 });
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
      const [order] = await conn.execute('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
      if (!order[0]) {
        throw Object.assign(new Error('Order not found'), { statusCode: 404 });
      }
      this._assertNotTrashed(order[0]);

      await this._assertCountryAccess(user, order[0].country_id);

      const currentPaid = parseFloat(order[0].total_paid);
      const currentRefunded = parseFloat(order[0].total_refunded);

      if (currentRefunded + parsedAmount > currentPaid) {
        throw Object.assign(
          new Error(`Cannot refund more than paid amount. Maximum refundable: ${(currentPaid - currentRefunded).toFixed(3)} ${order[0].currency_code}`),
          { statusCode: 400 }
        );
      }

      // 1. Insert refund record
      await conn.execute(
        `INSERT INTO order_payments (
          order_id, transaction_reference, gateway, payment_method,
          transaction_type, amount, currency_code, status, notes, recorded_by_user_id
        ) VALUES (?, ?, ?, ?, 'refund', ?, ?, 'successful', ?, ?)`,
        [
          orderId,
          transaction_reference || `REF-${Date.now()}`,
          gateway,
          order[0].payment_method,
          parsedAmount,
          order[0].currency_code,
          notes,
          user.id,
        ]
      );

      // 2. Reconcile balance
      const newTotalRefunded = currentRefunded + parsedAmount;
      let newPaymentStatus = 'partially_refunded';
      if (newTotalRefunded >= currentPaid) {
        newPaymentStatus = 'refunded';
      }

      await conn.execute(
        `UPDATE orders SET total_refunded = ?, payment_status = ? WHERE id = ?`,
        [newTotalRefunded, newPaymentStatus, orderId]
      );

      // 3. Optional inventory restocking
      if (restock_items) {
        const [items] = await conn.execute('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId]);
        for (const item of items) {
          await conn.execute(
            'UPDATE product_country_pricing SET stock_quantity = stock_quantity + ? WHERE product_id = ? AND country_id = ?',
            [item.quantity, item.product_id, order[0].country_id]
          );
        }
      }

      await conn.commit();

      await loggerService.logAction({
        userId: user.id,
        userEmail: user.email,
        action: 'order.refund_recorded',
        category: 'orders',
        targetType: 'orders',
        targetId: orderId,
        targetLabel: order[0].order_number,
        details: { refund_amount: parsedAmount, new_payment_status: newPaymentStatus, restocked: restock_items },
      });

      return {
        success: true,
        total_paid: currentPaid,
        total_refunded: newTotalRefunded,
        payment_status: newPaymentStatus,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Update shipping carrier, tracking number, and courier information
   */
  async updateShipping(orderId, shippingData, user) {
    const {
      shipping_carrier,
      tracking_number,
      tracking_url,
      estimated_delivery_date,
      mark_shipped = false,
    } = shippingData;

    const [order] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    }
    this._assertNotTrashed(order);

    await this._assertCountryAccess(user, order.country_id);

    await db.query(
      `UPDATE orders SET 
        shipping_carrier = ?,
        tracking_number = ?,
        tracking_url = ?,
        estimated_delivery_date = ?
       WHERE id = ?`,
      [
        shipping_carrier || null,
        tracking_number || null,
        tracking_url || null,
        estimated_delivery_date || null,
        orderId,
      ]
    );

    if (mark_shipped && order.status !== 'shipped') {
      await this.updateOrderStatus(
        orderId,
        {
          new_status: 'shipped',
          notes: `Tracking assigned: ${shipping_carrier || 'Courier'} #${tracking_number || 'N/A'}`,
          notified_customer: true,
        },
        user
      );
    }

    return this.getOrderById(orderId, user);
  }

  /**
   * Add internal collaboration note
   */
  async addOrderNote(orderId, { note, is_customer_visible = false }, user) {
    if (!note || !note.trim()) {
      throw Object.assign(new Error('Note content cannot be empty'), { statusCode: 400 });
    }

    const [order] = await db.query('SELECT country_id, deleted_at FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    }
    this._assertNotTrashed(order);

    await this._assertCountryAccess(user, order.country_id);

    const result = await db.insert('order_notes', {
      order_id: orderId,
      author_id: user.id,
      note: note.trim(),
      is_customer_visible: is_customer_visible ? 1 : 0,
    });

    return {
      id: result,
      order_id: orderId,
      author_id: user.id,
      author_name: user.fullName || user.username,
      note: note.trim(),
      is_customer_visible: Boolean(is_customer_visible),
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Get formatted invoice data for luxury printable A4 Tax Invoice
   */
  async getOrderInvoiceData(orderId, user) {
    const order = await this.getOrderById(orderId, user);

    return {
      invoice_number: `INV-${order.order_number}`,
      order_number: order.order_number,
      order_date: order.created_at,
      gift_engraving_text: order.gift_engraving_text,
      is_gift: order.is_gift,
      country: {
        code: order.country_code,
        name: order.country_name,
        currency_code: order.currency_code,
        currency_symbol: order.currency_symbol,
        decimal_places: order.decimal_places,
        tax_percentage: order.tax_percentage,
      },
      seller: {
        company_name: 'Ahmed Al Maghribi Perfumes LLC',
        company_name_ar: 'أحمد المغربي للعطور ذ.م.م',
        tax_registration_number: 'TRN 100234892100003',
        address: 'P.O. Box 23412, Dubai, United Arab Emirates',
        email: 'concierge@ahmed-perfume.com',
        phone: '+971 4 223 8899',
      },
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone,
      },
      shipping_address: order.shipping_address,
      billing_address: order.billing_address || order.shipping_address,
      items: order.items,
      financials: {
        subtotal: order.subtotal,
        shipping_fee: order.shipping_fee,
        discount_amount: order.discount_amount,
        tax_percentage: order.tax_percentage,
        tax_amount: order.tax_amount,
        total_amount: order.total_amount,
        total_paid: order.total_paid,
        balance_due: Math.max(0, parseFloat(order.total_amount) - parseFloat(order.total_paid)).toFixed(order.decimal_places || 2),
      },
      payment: {
        method: order.payment_method,
        status: order.payment_status,
      },
    };
  }

  // ===========================================================================
  // TRASH (soft delete) — orders are hidden, then permanently purged after
  // TRASH_RETENTION_DAYS by jobs/trashPurge.js
  // ===========================================================================

  /**
   * Fetch the given orders (locked FOR UPDATE) inside a transaction connection,
   * verifying that the user has access to each order's country.
   */
  async _loadOrdersForTrash(conn, ids, user) {
    const uniqueIds = [...new Set((ids || []).map((n) => parseInt(n)).filter((n) => n > 0))];
    if (uniqueIds.length === 0) return [];
    const [orders] = await conn.query(
      `SELECT id, order_number, country_id, status, total_paid, deleted_at
       FROM orders WHERE id IN (${uniqueIds.map(() => '?').join(',')}) FOR UPDATE`,
      uniqueIds
    );
    for (const o of orders) await this._assertCountryAccess(user, o.country_id);
    return orders;
  }

  /**
   * Adjust stock for an order's items. direction = +1 (restock) or -1 (deduct).
   * Deduction fails with a clear error if stock is insufficient.
   */
  async _adjustStockForOrder(conn, order, direction) {
    const [items] = await conn.execute('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
    for (const item of items) {
      if (direction < 0) {
        const [pricing] = await conn.execute(
          'SELECT stock_quantity FROM product_country_pricing WHERE product_id = ? AND country_id = ? FOR UPDATE',
          [item.product_id, order.country_id]
        );
        if (!pricing[0] || pricing[0].stock_quantity < item.quantity) {
          throw Object.assign(
            new Error(`Cannot restore ${order.order_number}: insufficient stock for product ID #${item.product_id}`),
            { statusCode: 400 }
          );
        }
      }
      await conn.execute(
        'UPDATE product_country_pricing SET stock_quantity = stock_quantity + ? WHERE product_id = ? AND country_id = ?',
        [direction * item.quantity, item.product_id, order.country_id]
      );
    }
  }

  /**
   * Move orders to Trash. Stock held by not-yet-shipped orders is returned.
   */
  async trashOrders(ids, user) {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      const orders = await this._loadOrdersForTrash(conn, ids, user);
      let trashed = 0;
      for (const order of orders) {
        if (order.deleted_at) continue;
        if (STOCK_HELD_STATUSES.includes(order.status)) {
          await this._adjustStockForOrder(conn, order, +1);
        }
        await conn.execute('UPDATE orders SET deleted_at = NOW(), deleted_by = ? WHERE id = ?', [user.id, order.id]);
        trashed++;
      }
      await conn.commit();
      await loggerService.logAction({
        userId: user.id, userEmail: user.email, action: 'order.trash', category: 'orders',
        targetType: 'orders', details: { ids, trashed },
      });
      return { requested: (ids || []).length, trashed };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Restore orders from Trash (re-reserves stock where the order holds stock).
   */
  async restoreOrders(ids, user) {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      const orders = await this._loadOrdersForTrash(conn, ids, user);
      let restored = 0;
      for (const order of orders) {
        if (!order.deleted_at) continue;
        if (STOCK_HELD_STATUSES.includes(order.status)) {
          await this._adjustStockForOrder(conn, order, -1);
        }
        await conn.execute('UPDATE orders SET deleted_at = NULL, deleted_by = NULL WHERE id = ?', [order.id]);
        restored++;
      }
      await conn.commit();
      await loggerService.logAction({
        userId: user.id, userEmail: user.email, action: 'order.restore', category: 'orders',
        targetType: 'orders', details: { ids, restored },
      });
      return { requested: (ids || []).length, restored };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Permanently delete orders that are already in Trash (children cascade).
   */
  async purgeOrders(ids, user) {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      const orders = await this._loadOrdersForTrash(conn, ids, user);
      const trashedIds = orders.filter((o) => o.deleted_at).map((o) => o.id);
      if (trashedIds.length > 0) {
        await conn.query(`DELETE FROM orders WHERE id IN (${trashedIds.map(() => '?').join(',')})`, trashedIds);
      }
      await conn.commit();
      await loggerService.logAction({
        userId: user.id, userEmail: user.email, action: 'order.purge', category: 'orders',
        targetType: 'orders', details: { ids: trashedIds },
      });
      return { requested: (ids || []).length, purged: trashedIds.length };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Automatic purge used by the scheduled job: delete orders trashed longer than `days` ago.
   */
  async purgeExpiredOrders(days) {
    const result = await db.query(
      'DELETE FROM orders WHERE deleted_at IS NOT NULL AND deleted_at < (NOW() - INTERVAL ? DAY)',
      [parseInt(days)]
    );
    return result?.affectedRows || 0;
  }
}

module.exports = new OrderService();
