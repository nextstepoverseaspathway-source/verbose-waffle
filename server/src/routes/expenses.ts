/**
 * Expense routes (all require auth).
 *
 *   GET    /api/expenses           — list with filters/search
 *   POST   /api/expenses           — create
 *   GET    /api/expenses/:id       — read one
 *   PUT    /api/expenses/:id       — update
 *   DELETE /api/expenses/:id       — delete
 *   POST   /api/expenses/:id/receipt  — upload a receipt image/PDF
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { config } from '../config';
import { db } from '../db/database';
import { currentUserId, requireAuth } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { Expense } from '../types';
import { buildTransactionFilters } from '../utils/filters';
import { expenseSchema } from '../utils/validation';

const router = Router();
router.use(requireAuth);

const SEARCH_COLS = ['description', 'notes', 'category', 'subcategory', 'vendor'];

// Multer storage for receipts — namespaced per user, size-limited.
const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadsDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 10);
      cb(null, `receipt_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { clause, params } = buildTransactionFilters(req, currentUserId(res), SEARCH_COLS);
    const rows = db
      .prepare(`SELECT * FROM expenses WHERE ${clause} ORDER BY date DESC, id DESC`)
      .all(...params) as Expense[];
    res.json({ data: rows });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = expenseSchema.parse(req.body);
    const info = db
      .prepare(
        `INSERT INTO expenses
         (user_id, date, category, subcategory, description, amount, payment_method,
          vendor, tax, recurring, notes)
         VALUES (@user_id, @date, @category, @subcategory, @description, @amount, @payment_method,
                 @vendor, @tax, @recurring, @notes)`,
      )
      .run({
        user_id: currentUserId(res),
        date: body.date,
        category: body.category,
        subcategory: body.subcategory ?? null,
        description: body.description ?? null,
        amount: body.amount,
        payment_method: body.payment_method ?? null,
        vendor: body.vendor ?? null,
        tax: body.tax ?? null,
        recurring: body.recurring ? 1 : 0,
        notes: body.notes ?? null,
      });
    const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ data: row });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = db
      .prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?')
      .get(req.params.id, currentUserId(res));
    if (!row) throw new ApiError(404, 'Expense entry not found');
    res.json({ data: row });
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = expenseSchema.parse(req.body);
    const result = db
      .prepare(
        `UPDATE expenses SET
           date=@date, category=@category, subcategory=@subcategory, description=@description,
           amount=@amount, payment_method=@payment_method, vendor=@vendor, tax=@tax,
           recurring=@recurring, notes=@notes
         WHERE id=@id AND user_id=@user_id`,
      )
      .run({
        id: req.params.id,
        user_id: currentUserId(res),
        date: body.date,
        category: body.category,
        subcategory: body.subcategory ?? null,
        description: body.description ?? null,
        amount: body.amount,
        payment_method: body.payment_method ?? null,
        vendor: body.vendor ?? null,
        tax: body.tax ?? null,
        recurring: body.recurring ? 1 : 0,
        notes: body.notes ?? null,
      });
    if (result.changes === 0) throw new ApiError(404, 'Expense entry not found');
    const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    res.json({ data: row });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = db
      .prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?')
      .run(req.params.id, currentUserId(res));
    if (result.changes === 0) throw new ApiError(404, 'Expense entry not found');
    res.status(204).end();
  }),
);

router.post(
  '/:id/receipt',
  upload.single('receipt'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'No receipt file uploaded');
    const relative = `/uploads/${req.file.filename}`;
    const result = db
      .prepare('UPDATE expenses SET receipt_path = ? WHERE id = ? AND user_id = ?')
      .run(relative, req.params.id, currentUserId(res));
    if (result.changes === 0) throw new ApiError(404, 'Expense entry not found');
    res.json({ data: { receipt_path: relative } });
  }),
);

export default router;
