import type { CookieOptions } from 'express';

export const SESSION_COOKIE_NAME = 'menurest_session';
export const CSRF_COOKIE_NAME = 'menurest_csrf';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-super-secret-jwt-key-for-menurest-v2-dev-only';
export const JWT_EXPIRES_IN = '1d';

export const isProduction = process.env.NODE_ENV === 'production';

export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 24 soat
};

export const CSRF_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: false, // brauzer JavaScript o'qib X-CSRF-Token sarlavhasiga qo'yishi uchun
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000,
};
