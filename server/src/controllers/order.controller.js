const orderService = require('../services/order.service');
const { asyncHandler } = require('../middleware/errorHandler');

exports.listOrders = asyncHandler(async (req, res) => {
  const result = await orderService.listOrders(req.query, req.user);
  res.json(result);
});

exports.getOrderStats = asyncHandler(async (req, res) => {
  const stats = await orderService.getOrderStats(req.query, req.user);
  res.json({ data: stats });
});

exports.getOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(parseInt(req.params.id), req.user);
  res.json({ data: order });
});

exports.createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.body, req.user);
  res.status(201).json({ success: true, data: order });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const result = await orderService.updateOrderStatus(
    parseInt(req.params.id),
    req.body,
    req.user
  );
  res.json(result);
});

exports.recordPayment = asyncHandler(async (req, res) => {
  const result = await orderService.recordPayment(
    parseInt(req.params.id),
    req.body,
    req.user
  );
  res.status(201).json(result);
});

exports.recordRefund = asyncHandler(async (req, res) => {
  const result = await orderService.recordRefund(
    parseInt(req.params.id),
    req.body,
    req.user
  );
  res.status(201).json(result);
});

exports.updateShipping = asyncHandler(async (req, res) => {
  const order = await orderService.updateShipping(
    parseInt(req.params.id),
    req.body,
    req.user
  );
  res.json({ success: true, data: order });
});

exports.addNote = asyncHandler(async (req, res) => {
  const note = await orderService.addOrderNote(
    parseInt(req.params.id),
    req.body,
    req.user
  );
  res.status(201).json({ success: true, data: note });
});

exports.getInvoice = asyncHandler(async (req, res) => {
  const invoice = await orderService.getOrderInvoiceData(
    parseInt(req.params.id),
    req.user
  );
  res.json({ data: invoice });
});

// ---- Bulk Trash operations (ids validated by Joi in the routes) ----
exports.bulkTrash = asyncHandler(async (req, res) => {
  const result = await orderService.trashOrders(req.body.ids, req.user);
  res.json({ success: true, data: result });
});

exports.bulkRestore = asyncHandler(async (req, res) => {
  const result = await orderService.restoreOrders(req.body.ids, req.user);
  res.json({ success: true, data: result });
});

exports.bulkPurge = asyncHandler(async (req, res) => {
  const result = await orderService.purgeOrders(req.body.ids, req.user);
  res.json({ success: true, data: result });
});
