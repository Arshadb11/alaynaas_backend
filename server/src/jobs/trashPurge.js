/**
 * Trash auto-purge job.
 *
 * Products and orders moved to Trash are permanently deleted once they have
 * been there longer than TRASH_RETENTION_DAYS. Runs at startup and hourly.
 */
const productService = require('../services/product.service');
const orderService = require('../services/order.service');
const winstonLogger = require('../config/winston');

const TRASH_RETENTION_DAYS = 5;
const RUN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function runTrashPurge() {
  try {
    const products = await productService.purgeExpiredProducts(TRASH_RETENTION_DAYS);
    const orders = await orderService.purgeExpiredOrders(TRASH_RETENTION_DAYS);
    if (products.purged || orders) {
      winstonLogger.info('Trash auto-purge completed', {
        products_purged: products.purged,
        products_kept_in_order_history: products.blocked,
        orders_purged: orders,
      });
    }
  } catch (err) {
    winstonLogger.error('Trash auto-purge failed', { error: err.message });
  }
}

function startTrashPurgeJob() {
  runTrashPurge();
  // unref() so the timer never keeps the process alive on shutdown
  setInterval(runTrashPurge, RUN_INTERVAL_MS).unref();
}

module.exports = { startTrashPurgeJob, runTrashPurge, TRASH_RETENTION_DAYS };
