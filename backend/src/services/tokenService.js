import crypto from 'crypto';
import { dbPool } from '../config/database.js';
import { redisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';

export const tokenService = {
  /**
   * Create an API Token (Plain key is returned ONCE and never again)
   */
  async createToken({
    userId,
    name,
    allowedDomains = [],
    allowedIps = [],
    allowedEndpoints = [],
    allowedMethods = ['GET'],
    rateLimitPerMin = 120,
    dailyQuota = 50000,
    expiresAt = null,
  }) {
    // Generate 32 bytes of secure random bytes => 64 hex characters
    const randomSecret = crypto.randomBytes(24).toString('base64url');
    const plainToken = `cpt_live_${randomSecret}`;
    const tokenPrefix = plainToken.substring(0, 14); // e.g. "cpt_live_Abc12"

    // SHA-256 hash for secure database storage
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');

    const query = `
      INSERT INTO api_tokens 
        (user_id, name, token_prefix, token_hash, allowed_domains, allowed_ips, allowed_endpoints, allowed_methods, rate_limit_per_min, daily_quota, expires_at)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, name, token_prefix, allowed_domains, allowed_ips, allowed_methods, rate_limit_per_min, daily_quota, expires_at, created_at
    `;

    const res = await dbPool.query(query, [
      userId,
      name,
      tokenPrefix,
      tokenHash,
      allowedDomains,
      allowedIps,
      allowedEndpoints,
      allowedMethods,
      rateLimitPerMin,
      dailyQuota,
      expiresAt,
    ]);

    const createdRecord = res.rows[0];

    logger.info('API Token created', { tokenId: createdRecord.id, userId, prefix: tokenPrefix });

    return {
      token: createdRecord,
      plainSecretKey: plainToken, // REVEALED ONCE
    };
  },

  /**
   * List tokens for a user or admin
   */
  async listTokens(userId, isAdmin = false) {
    const query = isAdmin
      ? `SELECT t.id, t.user_id, u.email as user_email, t.name, t.token_prefix, t.allowed_domains, t.allowed_ips, 
                t.allowed_methods, t.rate_limit_per_min, t.daily_quota, t.current_day_usage, t.is_revoked, 
                t.last_used_at, t.expires_at, t.created_at
         FROM api_tokens t
         JOIN users u ON t.user_id = u.id
         ORDER BY t.created_at DESC`
      : `SELECT id, name, token_prefix, allowed_domains, allowed_ips, allowed_methods, 
                rate_limit_per_min, daily_quota, current_day_usage, is_revoked, last_used_at, 
                expires_at, created_at
         FROM api_tokens
         WHERE user_id = $1
         ORDER BY created_at DESC`;

    const params = isAdmin ? [] : [userId];
    const res = await dbPool.query(query, params);
    return res.rows;
  },

  /**
   * Toggle token active/revoked status
   */
  async toggleToken(tokenId, isRevoked, userId, isAdmin = false) {
    const query = isAdmin
      ? `UPDATE api_tokens SET is_revoked = $1 WHERE id = $2 RETURNING id, name, is_revoked`
      : `UPDATE api_tokens SET is_revoked = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name, is_revoked`;

    const params = isAdmin ? [isRevoked, tokenId] : [isRevoked, tokenId, userId];
    const res = await dbPool.query(query, params);

    if (res.rows.length === 0) {
      throw new Error('Token not found or unauthorized');
    }

    logger.info(`API Token status changed: is_revoked=${isRevoked}`, { tokenId });

    // Invalidate Redis token cache
    try {
      if (redisClient && redisClient.status === 'ready') {
        const keys = await redisClient.keys('cache:token:*');
        if (keys.length > 0) await redisClient.del(...keys);
      }
    } catch (e) {}

    return res.rows[0];
  },

  /**
   * Delete token permanently
   */
  async deleteToken(tokenId, userId, isAdmin = false) {
    // 1. Detach from api_usage_logs to avoid foreign key block
    await dbPool.query('UPDATE api_usage_logs SET token_id = NULL WHERE token_id = $1', [tokenId]);

    // 2. Delete the token record
    const query = isAdmin
      ? `DELETE FROM api_tokens WHERE id = $1 RETURNING id, name`
      : `DELETE FROM api_tokens WHERE id = $1 AND user_id = $2 RETURNING id, name`;

    const params = isAdmin ? [tokenId] : [tokenId, userId];
    const res = await dbPool.query(query, params);

    if (res.rows.length === 0) {
      throw new Error('Token not found or unauthorized');
    }

    logger.warn('API Token permanently deleted', { tokenId, name: res.rows[0].name });

    // Invalidate Redis token cache
    try {
      if (redisClient && redisClient.status === 'ready') {
        const keys = await redisClient.keys('cache:token:*');
        if (keys.length > 0) await redisClient.del(...keys);
      }
    } catch (e) {}

    return res.rows[0];
  },

  /**
   * Revoke a token immediately (legacy alias)
   */
  async revokeToken(tokenId, userId, isAdmin = false) {
    return this.toggleToken(tokenId, true, userId, isAdmin);
  }
};
