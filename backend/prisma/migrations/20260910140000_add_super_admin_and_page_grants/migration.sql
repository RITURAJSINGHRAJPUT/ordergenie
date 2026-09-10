-- New top-level role. Settings moves from ADMIN to SUPER_ADMIN in the same release, so the
-- superadmin account must be moved onto this role or nobody can open Settings after deploy.
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- Per-user page grants, additive over the role. Empty for every existing user.
ALTER TABLE "User" ADD COLUMN "pageGrants" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
