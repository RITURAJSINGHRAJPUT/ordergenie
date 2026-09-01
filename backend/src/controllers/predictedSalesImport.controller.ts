import type { Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, AppError } from '../utils/apiResponse';
import {
  parseAndImportPredictionWorkbook,
  getPredictionSummary,
  listPredictionImportLogs,
  deletePredictionImport,
} from '../services/predictedSales/predictedSalesImport.service';

const XLSX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // some browsers/OSes send this for .xlsx instead of the proper type
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isXlsxName = file.originalname.toLowerCase().endsWith('.xlsx');
    if (isXlsxName && XLSX_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new AppError('Only .xlsx files are supported', 400));
  },
});

export const uploadPredictionWorkbookMiddleware = upload.single('file');

export const importPredictionWorkbookHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('No file uploaded — expected a "file" field', 400);

  const result = await parseAndImportPredictionWorkbook(req.file.buffer, req.file.originalname, req.user?.id);
  return ok(res, result);
});

export const getPredictionSummaryHandler = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await getPredictionSummary();
  return ok(res, summary);
});

export const listPredictionImportLogsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rows, meta } = await listPredictionImportLogs(req.query as Record<string, string>);
  return ok(res, rows, meta);
});

export const deletePredictionImportLogHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await deletePredictionImport(req.params.id);
  return ok(res, { removed: true, rowsDeleted: result.rowsDeleted });
});
