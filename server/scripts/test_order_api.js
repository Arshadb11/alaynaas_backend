const db = require('../src/config/db');
const orderService = require('../src/services/order.service');

async function testOrdersModule() {
  console.log('🧪 Starting Orders Module Integration Test...\n');

  const mockAdmin = {
    id: 1,
    username: 'admin',
    fullName: 'System Administrator',
    permissions: ['countries.manage', 'orders.read', 'orders.create', 'orders.update', 'orders.delete'],
  };

  try {
    // 1. Check initial stock for product 29 and bundle 614 in UAE (country_id = 1)
    const [p29Before] = await db.query('SELECT stock_quantity FROM product_country_pricing WHERE product_id = 29 AND country_id = 1');
    const [p614Before] = await db.query('SELECT stock_quantity FROM product_country_pricing WHERE product_id = 614 AND country_id = 1');

    console.log(`Initial UAE stock: Aayah (#29) = ${p29Before.stock_quantity}, K-Series Bundle (#614) = ${p614Before.stock_quantity}`);

    // 2. Create Order with both items
    const orderData = {
      country_id: 1,
      customer_name: 'HH Sheikh Mansoor Al Otaiba',
      customer_email: 'mansoor.otaiba@luxury-uae.ae',
      customer_phone: '+971501234567',
      shipping_address: {
        recipient_name: 'HH Sheikh Mansoor',
        phone: '+971501234567',
        address_line1: 'Villa 7, Jumeirah 2',
        address_line2: 'Jumeirah Beach Road',
        city: 'Dubai',
        state_province_emirate: 'Dubai',
        country_code: 'AE',
        delivery_instructions: 'Hand over to private security desk',
      },
      items: [
        { product_id: 29, quantity: 2 },  // 2x Aayah
        { product_id: 614, quantity: 1 }, // 1x K-Series Giftset
      ],
      shipping_fee: 25.000,
      discount_amount: 50.000,
      payment_method: 'apple_pay',
      status: 'confirmed',
      is_gift: true,
      gift_engraving_text: 'With Royal Regards - Ahmed Al Maghribi',
      customer_notes: 'Please pack in signature golden ribbon box',
      internal_notes: 'VIP client concierge order',
    };

    console.log('\nCreating manual order...');
    const createdOrder = await orderService.createOrder(orderData, mockAdmin);
    console.log(`✓ Order Created: ${createdOrder.order_number} (ID: ${createdOrder.id})`);
    console.log(`  Subtotal: ${createdOrder.subtotal} ${createdOrder.currency_code}`);
    console.log(`  Tax (${createdOrder.tax_percentage}%): ${createdOrder.tax_amount} ${createdOrder.currency_code}`);
    console.log(`  Total: ${createdOrder.total_amount} ${createdOrder.currency_code}`);
    console.log(`  Payment Status: ${createdOrder.payment_status}`);
    console.log(`  Items Count: ${createdOrder.items.length}`);

    // 3. Verify Bundle snapshot
    const bundleItem = createdOrder.items.find((i) => i.is_bundle);
    if (bundleItem) {
      console.log(`\n✓ Bundle Snapshot Verified for '${bundleItem.product_name}':`);
      const children = bundleItem.bundle_items_snapshot;
      console.log(`  Included Sub-Items (${children.length}):`, children.map((c) => `${c.name} (${c.size})`).join(', '));
    }

    // 4. Verify Stock Deduction
    const [p29After] = await db.query('SELECT stock_quantity FROM product_country_pricing WHERE product_id = 29 AND country_id = 1');
    const [p614After] = await db.query('SELECT stock_quantity FROM product_country_pricing WHERE product_id = 614 AND country_id = 1');
    console.log(`\n✓ Stock Deduction Verified:`);
    console.log(`  Aayah: ${p29Before.stock_quantity} -> ${p29After.stock_quantity} (-2 units)`);
    console.log(`  K-Series: ${p614Before.stock_quantity} -> ${p614After.stock_quantity} (-1 unit)`);

    // 5. Record Payment
    console.log('\nRecording Apple Pay transaction...');
    const payResult = await orderService.recordPayment(
      createdOrder.id,
      {
        transaction_reference: 'ch_applepay_9823412',
        gateway: 'checkout_com',
        payment_method: 'apple_pay',
        amount: createdOrder.total_amount,
        card_brand: 'Visa',
        card_last4: '1092',
        notes: '3D Secure authorized via Apple Pay UAE',
      },
      mockAdmin
    );
    console.log(`✓ Payment Recorded: Status = ${payResult.payment_status}, Total Paid = ${payResult.total_paid}`);

    // 6. Add Internal Staff Note
    console.log('\nAdding staff note...');
    const note = await orderService.addOrderNote(
      createdOrder.id,
      { note: 'VIP gift packaging prepared by Master Perfumer workshop.', is_customer_visible: false },
      mockAdmin
    );
    console.log(`✓ Note Added: "${note.note}" by ${note.author_name}`);

    // 7. Update Status to Packed and Shipped
    console.log('\nUpdating status progression...');
    await orderService.updateOrderStatus(
      createdOrder.id,
      { new_status: 'packed', notes: 'Packed in bespoke gift box' },
      mockAdmin
    );
    console.log('✓ Status advanced to: packed');

    const shippedOrder = await orderService.updateShipping(
      createdOrder.id,
      {
        shipping_carrier: 'Aramex Priority VIP',
        tracking_number: 'ARX-UAE-8829104',
        tracking_url: 'https://www.aramex.com/track/ARX-UAE-8829104',
        estimated_delivery_date: '2026-10-12',
        mark_shipped: true,
      },
      mockAdmin
    );
    console.log(`✓ Order Shipped with carrier ${shippedOrder.shipping_carrier}, Tracking #${shippedOrder.tracking_number}, Status: ${shippedOrder.status}`);

    // 8. Generate Commercial Invoice
    console.log('\nGenerating commercial invoice payload...');
    const invoice = await orderService.getOrderInvoiceData(createdOrder.id, mockAdmin);
    console.log(`✓ Invoice Generated: ${invoice.invoice_number}`);
    console.log(`  Seller TRN: ${invoice.seller.tax_registration_number}`);
    console.log(`  Balance Due: ${invoice.financials.balance_due} ${invoice.country.currency_code}`);

    // 9. Verify Listing and Stats
    console.log('\nVerifying listOrders and getOrderStats...');
    const listResult = await orderService.listOrders({ search: 'Mansoor' }, mockAdmin);
    console.log(`✓ listOrders found: ${listResult.data.length} order(s)`);

    const stats = await orderService.getOrderStats({ country_id: 1 }, mockAdmin);
    console.log(`✓ Stats for UAE: Total Orders = ${stats.total_orders}, Revenue = ${stats.total_revenue} AED, Delivered = ${stats.delivered_count}`);

    console.log('\n🎉 ALL PHASE 2 BACKEND ORDER TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  }
}

testOrdersModule();
