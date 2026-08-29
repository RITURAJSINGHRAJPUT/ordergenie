import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/apiResponse';
import { logger } from '../utils/logger';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
  }

  logger.error('Unhandled error', { path: req.originalUrl, err });
  return res.status(500).json({ success: false, message: 'Internal server error' });
}
