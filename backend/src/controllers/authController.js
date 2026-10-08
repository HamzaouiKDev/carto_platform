import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { dbPool } from '../config/database.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

export const authController = {
  /**
   * POST /api/auth/login
   */
  async login(req, res) {
    try {
      const { email, login, username, password } = req.body || {};
      const identifier = (login || username || email || '').trim();
      if (!identifier || !password) {
        return res.status(400).json({ error: 'BadRequest', message: 'Identifiant et mot de passe requis.' });
      }

      const userRes = await dbPool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [identifier]);
      if (userRes.rows.length === 0) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Identifiant ou mot de passe incorrect.' });
      }

      const user = userRes.rows[0];
      if (!user.is_active) {
        return res.status(403).json({ error: 'Forbidden', message: 'Account is deactivated' });
      }

      const validPassword = await argon2.verify(user.password_hash, password);
      if (!validPassword) {
        try {
          await dbPool.query(
            `INSERT INTO security_audit_logs (user_id, action, resource_type, ip_address, severity)
             VALUES ($1, 'AUTH_FAILED_PASSWORD', 'user', $2, 'WARNING')`,
            [user.id, (req.ip || '127.0.0.1').replace('::ffff:', '')]
          );
        } catch (_) {}
        return res.status(401).json({ error: 'Unauthorized', message: 'Identifiant ou mot de passe incorrect.' });
      }

      // Generate JWT access & refresh tokens
      const accessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.full_name },
        config.jwt.accessSecret,
        { expiresIn: config.jwt.accessExpiresIn }
      );

      const refreshToken = jwt.sign(
        { id: user.id, email: user.email },
        config.jwt.refreshSecret,
        { expiresIn: config.jwt.refreshExpiresIn }
      );

      // Update last login
      await dbPool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

      // Record login audit
      try {
        await dbPool.query(
          `INSERT INTO security_audit_logs (user_id, action, resource_type, ip_address, severity)
           VALUES ($1, 'AUTH_LOGIN_SUCCESS', 'user', $2, 'INFO')`,
          [user.id, (req.ip || '127.0.0.1').replace('::ffff:', '')]
        );
      } catch (_) {}

      return res.json({
        accessToken,
        refreshToken,
        expiresIn: config.jwt.accessExpiresIn,
        user: {
          id: user.id,
          email: user.email,
          name: user.full_name,
          role: user.role,
        }
      });
    } catch (err) {
      logger.error('[AuthController] Erreur login', { error: err.message, stack: err.stack });
      return res.status(500).json({ error: 'InternalServerError', message: err.message });
    }
  },

  /**
   * POST /api/auth/refresh
   */
  async refresh(req, res) {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'BadRequest', message: 'Refresh token required' });
    }

    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      const userRes = await dbPool.query('SELECT id, email, role, full_name, is_active FROM users WHERE id = $1', [decoded.id]);
      if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
        return res.status(401).json({ error: 'Unauthorized', message: 'User inactive or not found' });
      }

      const user = userRes.rows[0];
      const newAccessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.full_name },
        config.jwt.accessSecret,
        { expiresIn: config.jwt.accessExpiresIn }
      );

      return res.json({ accessToken: newAccessToken, expiresIn: config.jwt.accessExpiresIn });
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired refresh token' });
    }
  },

  /**
   * GET /api/me
   */
  async getMe(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    }

    const userRes = await dbPool.query(
      'SELECT id, email, full_name, role, two_factor_enabled, last_login_at, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'User profile not found' });
    }

    const tokensRes = await dbPool.query(
      'SELECT COUNT(*) as active_tokens FROM api_tokens WHERE user_id = $1 AND is_revoked = FALSE',
      [req.user.id]
    );

    return res.json({
      profile: userRes.rows[0],
      activeTokensCount: parseInt(tokensRes.rows[0].active_tokens, 10),
    });
  }
};
