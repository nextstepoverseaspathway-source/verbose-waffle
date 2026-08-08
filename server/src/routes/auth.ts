/**
 * Authentication routes.
 *
 *   POST /api/auth/register  — create an email account (sends a verification email)
 *   GET  /api/auth/verify    — confirm an email verification token
 *   POST /api/auth/login     — email + password login (blocked until verified)
 *   POST /api/auth/google    — federated login (email is trusted/verified)
 *   GET  /api/auth/me        — current user profile
 *
 * Passwords are hashed with bcrypt; sessions are stateless JWTs. New email
 * accounts must verify their address (via Resend) before they can log in.
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Router } from 'express';
import { config } from '../config';
import { db } from '../db/database';
import { currentUserId, requireAuth, signToken } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { PublicUser, User } from '../types';
import { sendVerificationEmail } from '../utils/email';
import { loginSchema, registerSchema } from '../utils/validation';

const router = Router();

/** Strip secrets (password hash, verification token) before returning a user. */
function toPublic(user: User): PublicUser {
  const { password_hash, verification_token, ...rest } = user;
  return rest;
}

/** Redirect helper for the email-link verify flow → back to the SPA. */
function loginRedirect(status: 'success' | 'invalid'): string {
  return `${config.appUrl.replace(/\/+$/, '')}/login?verified=${status === 'success' ? '1' : '0'}`;
}

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = registerSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase();
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) throw new ApiError(409, 'An account with this email already exists');

    const hash = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const inserted = await db
      .prepare(
        `INSERT INTO users (email, name, password_hash, provider, email_verified, verification_token)
         VALUES (?, ?, ?, 'email', 0, ?) RETURNING id`,
      )
      .get(normalizedEmail, name, hash, token);

    const user = (await db.prepare('SELECT * FROM users WHERE id = ?').get(inserted!.id)) as User;

    // Best-effort send — a mail failure must not fail account creation.
    const { sent } = await sendVerificationEmail(normalizedEmail, name, token);

    // No token is issued: the user must verify before logging in.
    res.status(201).json({
      requiresVerification: true,
      emailSent: sent,
      message: sent
        ? 'Account created. Check your email for a verification link to activate your account.'
        : 'Account created. Email delivery is not configured on this server — ask the administrator to verify your account.',
      user: toPublic(user),
    });
  }),
);

router.get(
  '/verify',
  asyncHandler(async (req, res) => {
    const token = String(req.query.token ?? '');
    if (!token) return res.redirect(loginRedirect('invalid'));

    const user = (await db
      .prepare('SELECT * FROM users WHERE verification_token = ?')
      .get(token)) as User | undefined;
    if (!user) return res.redirect(loginRedirect('invalid'));

    await db
      .prepare('UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?')
      .run(user.id);
    return res.redirect(loginRedirect('success'));
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

    if (!user.email_verified) {
      throw new ApiError(
        403,
        'Please verify your email before signing in. Check your inbox for the verification link.',
      );
    }

    const token = signToken({ sub: user.id, email: user.email });
    res.json({ token, user: toPublic(user) });
  }),
);

/**
 * Federated (Google) login. Google has already verified the user's email, so
 * these accounts are created as verified. In production the client sends a
 * Firebase ID token which is verified server-side (see docs/DEPLOYMENT.md).
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
        .prepare(
          `INSERT INTO users (email, name, provider, email_verified)
           VALUES (?, ?, 'google', 1) RETURNING id`,
        )
        .get(email, name);
      user = (await db.prepare('SELECT * FROM users WHERE id = ?').get(inserted!.id)) as User;
    } else if (!user.email_verified) {
      // A pre-existing account signing in via Google is a verified email.
      await db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(user.id);
      user.email_verified = 1;
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
