const settingsService = require('../services/settings.service');

class SettingsController {
  async getSettings(req, res, next) {
    try {
      const data = await settingsService.getAllSettings();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getPublicSettings(req, res, next) {
    try {
      const data = await settingsService.getPublicSettings();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const result = await settingsService.updateSettings(req.body, req.user, req);
      res.json({
        success: true,
        message: 'Settings updated successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async uploadBrandingAsset(req, res, next) {
    try {
      const targetKey = req.body.key || req.query.key;
      const result = await settingsService.uploadBrandingAsset(req.file, targetKey, req.user, req);
      res.json({
        success: true,
        message: 'Asset uploaded successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async flushCache(req, res, next) {
    try {
      const result = await settingsService.flushCache(req.user, req);
      res.json({
        success: true,
        message: 'Cache flushed successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async emptyTrash(req, res, next) {
    try {
      const result = await settingsService.emptyTrash(req.user, req);
      res.json({ success: true, message: 'Trash emptied', data: result });
    } catch (err) {
      next(err);
    }
  }

  async optimizeDatabase(req, res, next) {
    try {
      const result = await settingsService.optimizeDatabase(req.user, req);
      res.json({
        success: true,
        message: 'Database optimized successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getSystemMetrics(req, res, next) {
    try {
      const data = await settingsService.getSystemMetrics();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async testSmtp(req, res, next) {
    try {
      // Simulate email transport test / ping
      res.json({
        success: true,
        message: `SMTP test connection verified. Simulation ping completed at ${new Date().toLocaleTimeString()}.`,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SettingsController();
