const roleService = require('../services/role.service');
const { asyncHandler } = require('../middleware/errorHandler');

const listRoles = asyncHandler(async (req, res) => {
  const roles = await roleService.listRoles();
  res.json({ data: roles });
});

const getRole = asyncHandler(async (req, res) => {
  const role = await roleService.getRoleById(parseInt(req.params.id));
  res.json({ data: role });
});

const createRole = asyncHandler(async (req, res) => {
  const role = await roleService.createRole(req.body, req.user.id, req);
  res.status(201).json({ data: role });
});

const updateRole = asyncHandler(async (req, res) => {
  const role = await roleService.updateRole(parseInt(req.params.id), req.body, req.user.id, req);
  res.json({ data: role });
});

const deleteRole = asyncHandler(async (req, res) => {
  const result = await roleService.deleteRole(parseInt(req.params.id), req.user.id, req);
  res.json(result);
});

const getAllPermissions = asyncHandler(async (req, res) => {
  const permissions = await roleService.getAllPermissions();
  res.json({ data: permissions });
});

module.exports = { listRoles, getRole, createRole, updateRole, deleteRole, getAllPermissions };
