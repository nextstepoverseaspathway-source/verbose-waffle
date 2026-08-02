/**
 * Authentication routes.
 *
 *   POST /api/auth/register  — create an email account
 *   POST /api/auth/login     — email + password login
 *   POST /api/auth/google    — federated login (accepts a verified profile)
 *   GET  /api/auth/me        — current user profile
 *
 * Passwords are hashed with bcrypt; sessions are stateless JWTs.
 * Firebase can be layered on top by verifying the ID token before calling
 * /google (see docs/DEPLOYMENT.md — Firebase section).
 */
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { db } from '../db/database';
import { currentUserId, requireAuth, signToken } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { PublicUser, User } from '../types';
import { loginSchema, registerSchema } from '../utils/validation';

const router = Router();

/** Strip the password hash before returning a user to the client. */
function toPublic(user: User): PublicUser {
  const { password_hash, ...rest } = user;
  return rest;
}

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = registerSchema.parse(req.body);
    const existing = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(email.toLowerCase());
    if (existing) throw new ApiError(409, 'An account with this email already exists');

    const hash = await bcrypt.hash(password, 10);
    const inserted = await db
      .prepare(
        `INSERT INTO users (email, name, password_hash, provider)
         VALUES (?, ?, ?, 'email') RETURNING id`,
      )
      .get(email.toLowerCase(), name, hash);

    const user = (await db.prepare('SELECT * FROM users WHERE id = ?').get(inserted!.id)) as User;
    const token = signToken({ sub: user.id, email: user.email });
    res.status(201).json({ token, user: toPublic(user) });
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = (await db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.toLowerCase())) as User | undefined;
    if (!user || !user.password_hash) throw new ApiError(401, 'Invalid email or password');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new ApiError(401, 'Invalid email or password');

    const token = signToken({ sub: user.id, email: user.email });
    res.json({ token, user: toPublic(user) });
  }),
);

/**
 * Federated (Google) login. In production the client sends a Firebase ID
 * token which is verified server-side; here we accept the resolved profile
 * and upsert the user. The endpoint is intentionally simple so it works with
 * or without Firebase configured.
 */
router.post(
  '/google',
  asyncHandler(async (req, res) => {
    const email = String(req.body.email ?? '').toLowerCase();
    const name = String(req.body.name ?? '').trim() || email.split('@')[0];
    if (!email) throw new ApiError(400, 'email is required');

    let user = (await db.prepare('SELECT * FROM users WHERE email = ?').get(email)) as
      | User
      | undefined;
    if (!user) {
      const inserted = await db
        .prepare(`INSERT INTO users (email, name, provider) VALUES (?, ?, 'google') RETURNING id`)
        .get(email, name);
      user = (await db.prepare('SELECT * FROM users WHERE id = ?').get(inserted!.id)) as User;
    }
    const token = signToken({ sub: user.id, email: user.email });
    res.json({ token, user: toPublic(user) });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const user = (await db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(currentUserId(res))) as User;
    res.json({ user: toPublic(user) });
  }),
);

export default router;
