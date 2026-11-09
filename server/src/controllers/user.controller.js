const userService = require('../services/user.service');
const { asyncHandler } = require('../middleware/errorHandler');

const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, search, roleId } = req.query;
  const result = await userService.listUsers({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    search: search || '',
    roleId: roleId ? parseInt(roleId) : null,
  });
  res.json(result);
});

const getUser = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(parseInt(req.params.id));
  res.json({ data: user });
});

const createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body, req.user.id, req);
  res.status(201).json({ data: user });
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(parseInt(req.params.id), req.body, req.user.id, req);
  res.json({ data: user });
});

const deleteUser = asyncHandler(async (req, res) => {
  const result = await userService.deleteUser(parseInt(req.params.id), req.user.id, req);
  res.json(result);
});

const toggleActive = asyncHandler(async (req, res) => {
  const result = await userService.toggleActive(parseInt(req.params.id), req.user.id, req);
  res.json({ data: result });
});

const getUserPermissions = asyncHandler(async (req, res) => {
  const permissions = await userService.getUserPermissions(parseInt(req.params.id));
  res.json({ data: permissions });
});

const setUserPermissions = asyncHandler(async (req, res) => {
  const { permissions } = req.body;
  await userService.setUserPermissions(parseInt(req.params.id), permissions, req.user.id, req);
  const updatedPerms = await userService.getUserPermissions(parseInt(req.params.id));
  res.json({ data: updatedPerms });
});

const applyPreset = asyncHandler(async (req, res) => {
  const user = await userService.applyPreset(
    parseInt(req.params.id),
    parseInt(req.params.roleId),
    req.user.id,
    req
  );
  res.json({ data: user });
});

module.exports = {
  listUsers, getUser, createUser, updateUser, deleteUser,
  toggleActive, getUserPermissions, setUserPermissions, applyPreset,
};
