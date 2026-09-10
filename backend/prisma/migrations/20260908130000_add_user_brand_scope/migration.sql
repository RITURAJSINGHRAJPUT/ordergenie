-- Brand-level access scope. NULL means all brands, which is what every existing user gets,
-- so this is behaviour-preserving on deploy.
ALTER TABLE "User" ADD COLUMN "brand" TEXT;
