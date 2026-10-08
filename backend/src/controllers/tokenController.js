import { tokenService } from '../services/tokenService.js';
import { dbPool } from '../config/database.js';

async function resolveDefaultAdminId() {
  const res = await dbPool.query("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1");
  return res.rows[0]?.id || null;
}

export const tokenController = {
  /**
   * POST /api/tokens (Generate new API token with one-time reveal)
   */
  async createToken(req, res) {
    const { name, allowedDomains, allowedIps, allowedMethods, rateLimitPerMin, dailyQuota, expiresAt } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'BadRequest', message: 'Token name is required (min 2 chars)' });
    }

    // Use authenticated user or fallback to super admin account for dashboard requests
    let userId = req.user?.id;
    if (!userId) {
      userId = await resolveDefaultAdminId();
    }

    if (!userId) {
      return res.status(500).json({ error: 'ServerError', message: 'No admin user found to attach token' });
    }

    try {
      const result = await tokenService.createToken({
        userId,
        name: name.trim(),
        allowedDomains: allowedDomains || [],
        allowedIps: allowedIps || [],
        allowedMethods: allowedMethods || ['GET'],
        rateLimitPerMin: rateLimitPerMin ? parseInt(rateLimitPerMin, 10) : 120,
        dailyQuota: dailyQuota ? parseInt(dailyQuota, 10) : 50000,
        expiresAt: expiresAt || null,
      });

      // Audit token creation
      await dbPool.query(
        `INSERT INTO security_audit_logs (user_id, action, resource_type, resource_id, details, ip_address, severity)
         VALUES ($1, 'TOKEN_CREATE', 'api_token', $2, $3, $4, 'INFO')`,
        [userId, result.token.id, JSON.stringify({ name: result.token.name }), req.ip || '127.0.0.1']
      );

      return res.status(201).json({
        message: 'API token generated successfully. Copy this token now as it will NEVER be displayed again.',
        token: result.token,
        secretKey: result.plainSecretKey, // ONE-TIME REVEAL
      });
    } catch (err) {
      return res.status(500).json({ error: 'TokenCreationError', message: err.message });
    }
  },

  /**
   * GET /api/tokens (List tokens for current user or all if admin/dashboard)
   */
  async listTokens(req, res) {
    let userId = req.user?.id;
    let isAdmin = req.user ? req.user.role === 'admin' : true;

    if (!userId) {
      userId = await resolveDefaultAdminId();
    }

    const tokens = await tokenService.listTokens(userId, isAdmin);
    return res.json({ count: tokens.length, tokens });
  },

  /**
   * PUT /api/tokens/:id/toggle (Activate / Deactivate token)
   */
  async toggleToken(req, res) {
    const { id } = req.params;
    const { isRevoked } = req.body;
    let userId = req.user?.id;
    let isAdmin = req.user ? req.user.role === 'admin' : true;

    if (!userId) {
      userId = await resolveDefaultAdminId();
    }

    try {
      // If isRevoked not provided, toggle the opposite of current state
      let targetState = typeof isRevoked === 'boolean' ? isRevoked : undefined;
      if (targetState === undefined) {
        const cur = await dbPool.query('SELECT is_revoked FROM api_tokens WHERE id = $1', [id]);
        if (cur.rows.length === 0) {
          return res.status(404).json({ error: 'NotFound', message: 'Token introuvable' });
        }
        targetState = !cur.rows[0].is_revoked;
      }

      const updated = await tokenService.toggleToken(id, targetState, userId, isAdmin);

      const action = targetState ? 'TOKEN_DEACTIVATE' : 'TOKEN_ACTIVATE';
      await dbPool.query(
        `INSERT INTO security_audit_logs (user_id, action, resource_type, resource_id, details, ip_address, severity)
         VALUES ($1, $2, 'api_token', $3, $4, $5, 'INFO')`,
        [userId, action, id, JSON.stringify({ isRevoked: targetState, name: updated.name }), req.ip || '127.0.0.1']
      );

      return res.json({
        message: targetState ? 'Clé API désactivée avec succès' : 'Clé API activée avec succès',
        token: updated
      });
    } catch (err) {
      return res.status(404).json({ error: 'NotFound', message: err.message });
    }
  },

  /**
   * DELETE /api/tokens/:id (Delete token permanently or revoke)
   */
  async deleteToken(req, res) {
    const { id } = req.params;
    let userId = req.user?.id;
    let isAdmin = req.user ? req.user.role === 'admin' : true;

    if (!userId) {
      userId = await resolveDefaultAdminId();
    }

    try {
      const deleted = await tokenService.deleteToken(id, userId, isAdmin);

      // Audit permanent deletion
      await dbPool.query(
        `INSERT INTO security_audit_logs (user_id, action, resource_type, resource_id, details, ip_address, severity)
         VALUES ($1, 'TOKEN_DELETE', 'api_token', $2, $3, $4, 'WARNING')`,
        [userId, id, JSON.stringify({ name: deleted.name }), req.ip || '127.0.0.1']
      );

      return res.json({ message: 'Clé API supprimée définitivement', tokenId: id, name: deleted.name });
    } catch (err) {
      return res.status(404).json({ error: 'NotFound', message: err.message });
    }
  }
};
