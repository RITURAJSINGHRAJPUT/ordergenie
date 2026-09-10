import type { RoleName } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: RoleName;
  outletId: string | null;
  /** null = every brand. Tokens issued before brand scoping decode as undefined, i.e. unrestricted. */
  brand?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
