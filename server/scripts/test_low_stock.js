const productService = require('../src/services/product.service');

(async () => {
  try {
    const result = await productService.listProducts(
      { low_stock: 'true', country_id: 1, limit: 5 },
      { id: 1, role_name: 'super_admin', permissions: ['products.read', 'products.update'] }
    );
    console.log('✓ Low stock products count:', result.products.length);
    if (result.products.length > 0) {
      console.log('Sample low stock product:', {
        name: result.products[0].name,
        stock: result.products[0].country_stock_quantity,
        threshold: result.products[0].country_low_stock_threshold,
      });
    }
    process.exit(0);
  } catch (err) {
    console.error('✗ Test failed:', err.message);
    process.exit(1);
  }
})();
