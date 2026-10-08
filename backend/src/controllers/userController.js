import argon2 from 'argon2';
import { dbPool } from '../config/database.js';
import { logger } from '../config/logger.js';

export const userController = {
  /**
   * GET /api/users
   * Liste tous les utilisateurs enregistrés
   */
  async listUsers(req, res) {
    try {
      const result = await dbPool.query(
        `SELECT id, email, full_name, role, is_active, last_login_at, created_at 
         FROM users 
         ORDER BY created_at ASC`
      );
      return res.json({ users: result.rows, total: result.rows.length });
    } catch (err) {
      logger.error('[UserController] Erreur listUsers', { error: err.message });
      return res.status(500).json({ error: 'DatabaseError', message: err.message });
    }
  },

  /**
   * POST /api/users
   * Crée un nouvel utilisateur (admin, manager, cartographe/user)
   */
  async createUser(req, res) {
    const { email, password, full_name, role = 'user' } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'L\'email, le mot de passe et le nom complet sont obligatoires.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Le mot de passe doit comporter au moins 6 caractères.'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanRole = ['admin', 'manager', 'user'].includes(role) ? role : 'user';

    try {
      // Vérifier si l'utilisateur existe déjà
      const existing = await dbPool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Conflict',
          message: `L'adresse email ${cleanEmail} est déjà utilisée.`
        });
      }

      // Hachage sécurisé du mot de passe avec Argon2id
      const hash = await argon2.hash(password, { type: argon2.argon2id });

      const insertResult = await dbPool.query(
        `INSERT INTO users (email, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id, email, full_name, role, is_active, created_at`,
        [cleanEmail, hash, full_name.trim(), cleanRole]
      );

      const newUser = insertResult.rows[0];

      // Audit de sécurité
      await dbPool.query(
        `INSERT INTO security_audit_logs (user_id, action, resource_type, ip_address, severity)
         VALUES ($1, 'USER_CREATED', 'user', $2, 'INFO')`,
        [req.user ? req.user.id : newUser.id, req.ip || '127.0.0.1']
      );

      logger.info(`[UserController] Nouvel utilisateur créé : ${cleanEmail} (${cleanRole})`);
      return res.status(201).json({
        message: 'Utilisateur créé avec succès',
        user: newUser
      });
    } catch (err) {
      logger.error('[UserController] Erreur createUser', { error: err.message });
      return res.status(500).json({ error: 'DatabaseError', message: err.message });
    }
  },

  /**
   * PUT /api/auth/change-password
   * Permet à l'utilisateur connecté de modifier son mot de passe
   */
  async changePassword(req, res) {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentification requise.' });
    }

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'L\'ancien mot de passe et le nouveau mot de passe sont requis.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Le nouveau mot de passe doit comporter au moins 6 caractères.'
      });
    }

    try {
      const userRes = await dbPool.query('SELECT id, password_hash, email FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ error: 'NotFound', message: 'Utilisateur introuvable.' });
      }

      const user = userRes.rows[0];
      const valid = await argon2.verify(user.password_hash, oldPassword);
      if (!valid) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'L\'ancien mot de passe saisi est incorrect.'
        });
      }

      const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
      await dbPool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, userId]);

      // Audit de sécurité
      await dbPool.query(
        `INSERT INTO security_audit_logs (user_id, action, resource_type, ip_address, severity)
         VALUES ($1, 'PASSWORD_CHANGED', 'user', $2, 'INFO')`,
        [userId, req.ip || '127.0.0.1']
      );

      logger.info(`[UserController] Mot de passe modifié pour ${user.email}`);
      return res.json({ message: 'Votre mot de passe a été modifié avec succès.' });
    } catch (err) {
      logger.error('[UserController] Erreur changePassword', { error: err.message });
      return res.status(500).json({ error: 'DatabaseError', message: err.message });
    }
  },

  /**
   * PUT /api/users/:id/reset-password
   * Un administrateur réinitialise le mot de passe d'un utilisateur cible
   */
  async resetPassword(req, res) {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Le nouveau mot de passe doit comporter au moins 6 caractères.'
      });
    }

    try {
      const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
      const result = await dbPool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING email',
        [newHash, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'NotFound', message: 'Utilisateur cible introuvable.' });
      }

      logger.info(`[UserController] Mot de passe réinitialisé pour l'utilisateur ID: ${id}`);
      return res.json({ message: `Le mot de passe de ${result.rows[0].email} a été mis à jour.` });
    } catch (err) {
      logger.error('[UserController] Erreur resetPassword', { error: err.message });
      return res.status(500).json({ error: 'DatabaseError', message: err.message });
    }
  },

  /**
   * DELETE /api/users/:id
   * Supprime ou désactive un utilisateur
   */
  async deleteUser(req, res) {
    const { id } = req.params;

    if (req.user && req.user.id === id) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Vous ne pouvez pas supprimer votre propre compte administrateur.'
      });
    }

    try {
      const result = await dbPool.query('DELETE FROM users WHERE id = $1 RETURNING email', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'NotFound', message: 'Utilisateur introuvable.' });
      }

      logger.info(`[UserController] Utilisateur supprimé : ${result.rows[0].email}`);
      return res.json({ message: `L'utilisateur ${result.rows[0].email} a été supprimé.` });
    } catch (err) {
      logger.error('[UserController] Erreur deleteUser', { error: err.message });
      return res.status(500).json({ error: 'DatabaseError', message: err.message });
    }
  }
};
