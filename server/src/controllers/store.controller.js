const storeService = require('../services/store.service');
const settingsService = require('../services/settings.service');

/**
 * STORE CONTROLLER (Public Customer Storefront)
 *
 * Handles HTTP requests for public storefront consumers.
 * Passes queries to storeService and handles error propagation cleanly.
 */
class StoreController {
  async getSettings(req, res, next) {
    try {
      const settings = await settingsService.getPublicSettings();
      res.json({ success: true, data: settings });
    } catch (err) {
      next(err);
    }
  }

  async getCountries(req, res, next) {
    try {
      const countries = await storeService.getCountries();
      res.json({ success: true, data: countries });
    } catch (err) {
      next(err);
    }
  }

  async getCategories(req, res, next) {
    try {
      const categories = await storeService.getCategories();
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }

  async getBrands(req, res, next) {
    try {
      const brands = await storeService.getBrands();
      res.json({ success: true, data: brands });
    } catch (err) {
      next(err);
    }
  }

  async getFragranceMetadata(req, res, next) {
    try {
      const metadata = await storeService.getFragranceMetadata();
      res.json({ success: true, data: metadata });
    } catch (err) {
      next(err);
    }
  }

  async listProducts(req, res, next) {
    try {
      const result = await storeService.listProducts(req.query);
      res.json({
        success: true,
        data: result.products,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  async getProduct(req, res, next) {
    try {
      const { slug } = req.params;
      const { country = 'AE' } = req.query;
      const product = await storeService.getProductBySlug(slug, country);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found',
        });
      }

      res.json({ success: true, data: product });
    } catch (err) {
      next(err);
    }
  }

  async createOrder(req, res, next) {
    try {
      const order = await storeService.createStoreOrder(req.body, req);
      res.status(201).json({
        success: true,
        data: order,
        message: 'Order created successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StoreController();
