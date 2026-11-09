const authService = require('../services/auth.service');
const { asyncHandler } = require('../middleware/errorHandler');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password, req);

  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });

  res.json({
    accessToken: result.accessToken,
    user: result.user,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  const result = await authService.refresh(refreshToken, req);

  // Set new refresh token cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.json({
    accessToken: result.accessToken,
    user: result.user,
  });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user, req);

  res.clearCookie('refreshToken', { path: '/' });
  res.json({ message: 'Logged out successfully' });
});

const logoutAll = asyncHandler(async (req, res) => {
  const result = await authService.logoutAll(req.user.id, req.user.sessionId, req);

  res.json({
    message: result.terminated === 0
      ? 'No other active sessions found'
      : `Successfully logged out ${result.terminated} other device${result.terminated === 1 ? '' : 's'}`,
    sessionsTerminated: result.terminated,
  });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  res.json({ data: user });
});

const getSessions = asyncHandler(async (req, res) => {
  const sessions = await authService.getSessions(req.user.id, req.user.sessionId);
  res.json({ data: sessions });
});

const logoutSession = asyncHandler(async (req, res) => {
  await authService.logoutSession(req.user.id, req.params.sessionId, req);
  res.json({ message: 'Session terminated' });
});

const updateProfile = asyncHandler(async (req, res) => {
  const updatedUser = await authService.updateProfile(
    req.user.id,
    {
      fullName: req.body.fullName,
      email: req.body.email,
      avatarUrl: req.body.avatarUrl,
    },
    req
  );

  res.json({
    message: 'Profile updated successfully',
    data: updatedUser,
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(
    req.user.id,
    req.body.currentPassword,
    req.body.newPassword,
    req
  );

  res.json(result);
});

const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  const updatedUser = await authService.updateProfile(
    req.user.id,
    { avatarUrl },
    req
  );

  res.json({
    message: 'Avatar uploaded successfully',
    avatarUrl,
    data: updatedUser,
  });
});

module.exports = {
  login,
  refresh,
  logout,
  logoutAll,
  getMe,
  getSessions,
  logoutSession,
  updateProfile,
  changePassword,
  uploadAvatar,
};
