import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import apiRoutes from './routes';
import { activityLogger } from './middleware/activityLog.middleware';
import { restrictedRoleGuard } from './middleware/rbac.middleware';

export const app = express();

const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// In front of the whole API so every mutating endpoint is audited, including future ones.
// restrictedRoleGuard sits here too, ahead of the routers, so a narrowly-scoped role is held to
// its own paths even on the endpoints that apply no role check of their own.
app.use('/api', activityLogger, restrictedRoleGuard, apiRoutes);
