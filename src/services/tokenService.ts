import jwt, { SignOptions } from 'jsonwebtoken';

const ACCESS_SECRET: string = process.env.JWT_ACCESS_SECRET || 'access-secret-dev';
const REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET || 'refresh-secret-dev';
const ACCESS_TTL: string = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TTL: string = process.env.REFRESH_TOKEN_TTL || '7d';

interface TokenPayload {
  sub: string; // userId
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, ACCESS_SECRET, { expiresIn: ACCESS_TTL } as SignOptions);
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: REFRESH_TTL } as SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
}

