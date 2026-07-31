/**
 * JWT authentication middleware.
 *
 * Expects an `Authorization: Bearer <token>` header. On success it attaches
 * the authenticated user id to `res.locals.userId` for downstream handlers.
 */
import { NextFunction, Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { ApiError } from './errorHandler';

export interface TokenPayload {
  sub: number;
  email: string;
}

export function signToken(payload: TokenPayload): string {
  const options: SignOptions = { expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, config.jwtSecret, options);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid authorization header');
  }
  const token = header.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as unknown as TokenPayload;
    res.locals.userId = decoded.sub;
    next();
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }
}

/** Helper to read the authenticated user id inside a route handler. */
export function currentUserId(res: Response): number {
  return res.locals.userId as number;
}
