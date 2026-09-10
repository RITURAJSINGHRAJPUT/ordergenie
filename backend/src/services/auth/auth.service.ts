import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../utils/apiResponse';
import type { AuthUser } from '../../types/express';

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    outletId: string | null;
    brand: string | null;
    pageGrants: string[];
  };
}

export async function login(email: string, password: string, rememberMe: boolean): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  if (!user || !user.isActive) {
    throw new AppError('Invalid email or password', 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError('Invalid email or password', 401);
  }

  const payload: AuthUser = {
    id: user.id,
    email: user.email,
    role: user.role.name,
    outletId: user.outletId,
    brand: user.brand,
    pageGrants: user.pageGrants,
  };

  const expiresIn = rememberMe ? env.JWT_REMEMBER_EXPIRES_IN : env.JWT_EXPIRES_IN;
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      outletId: user.outletId,
      brand: user.brand,
      pageGrants: user.pageGrants,
    },
  };
}
