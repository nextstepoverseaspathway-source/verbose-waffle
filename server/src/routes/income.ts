/**
 * Income routes (all require auth).
 *
 *   GET    /api/income        — list with filters/search (?from,to,month,year,category,payment_method,minAmount,maxAmount,q)
 *   POST   /api/income        — create
 *   GET    /api/income/:id    — read one
 *   PUT    /api/income/:id    — update
 *   DELETE /api/income/:id    — delete
 */
import { Router } from 'express';
import { db } from '../db/database';
import { currentUserId, requireAuth } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { Income } from '../types';
import { buildTransactionFilters } from '../utils/filters';
import { incomeSchema } from '../utils/validation';

const router = Router();
router.use(requireAuth);

const SEARCH_COLS = ['description', 'notes', 'category', 'source', 'received_from'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { clause, params } = buildTransactionFilters(req, currentUserId(res), SEARCH_COLS);
    const rows = db
      .prepare(`SELECT * FROM incomes WHERE ${clause} ORDER BY date DESC, id DESC`)
      .all(...params) as Income[];
    res.json({ data: rows });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = incomeSchema.parse(req.body);
    const info = db
      .prepare(
        `INSERT INTO incomes
         (user_id, date, source, category, description, amount, payment_method,
          received_from, reference_number, recurring, notes)
         VALUES (@user_id, @date, @source, @category, @description, @amount, @payment_method,
                 @received_from, @reference_number, @recurring, @notes)`,
      )
      .run({
        user_id: currentUserId(res),
        date: body.date,
        source: body.source,
        category: body.category,
        description: body.description ?? null,
        amount: body.amount,
        payment_method: body.payment_method ?? null,
        received_from: body.received_from ?? null,
        reference_number: body.reference_number ?? null,
        recurring: body.recurring ? 1 : 0,
        notes: body.notes ?? null,
      });
    const row = db.prepare('SELECT * FROM incomes WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ data: row });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = db
      .prepare('SELECT * FROM incomes WHERE id = ? AND user_id = ?')
      .get(req.params.id, currentUserId(res));
    if (!row) throw new ApiError(404, 'Income entry not found');
    res.json({ data: row });
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = incomeSchema.parse(req.body);
    const result = db
      .prepare(
        `UPDATE incomes SET
           date=@date, source=@source, category=@category, description=@description,
           amount=@amount, payment_method=@payment_method, received_from=@received_from,
           reference_number=@reference_number, recurring=@recurring, notes=@notes
         WHERE id=@id AND user_id=@user_id`,
      )
      .run({
        id: req.params.id,
        user_id: currentUserId(res),
        date: body.date,
        source: body.source,
        category: body.category,
        description: body.description ?? null,
        amount: body.amount,
        payment_method: body.payment_method ?? null,
        received_from: body.received_from ?? null,
        reference_number: body.reference_number ?? null,
        recurring: body.recurring ? 1 : 0,
        notes: body.notes ?? null,
      });
    if (result.changes === 0) throw new ApiError(404, 'Income entry not found');
    const row = db.prepare('SELECT * FROM incomes WHERE id = ?').get(req.params.id);
    res.json({ data: row });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = db
      .prepare('DELETE FROM incomes WHERE id = ? AND user_id = ?')
      .run(req.params.id, currentUserId(res));
    if (result.changes === 0) throw new ApiError(404, 'Income entry not found');
    res.status(204).end();
  }),
);

export default router;
