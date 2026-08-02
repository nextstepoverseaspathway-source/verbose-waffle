/**
 * Financial goal routes (all require auth).
 * Progress percentage is computed on read so the client stays simple.
 */
import { Router } from 'express';
import { db } from '../db/database';
import { currentUserId, requireAuth } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { Goal } from '../types';
import { goalSchema } from '../utils/validation';

const router = Router();
router.use(requireAuth);

/** Attach a computed progress percentage (0–100). */
function withProgress(goal: Goal) {
  const progress =
    goal.target_amount > 0
      ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
      : 0;
  return { ...goal, progress };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = (await db
      .prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC')
      .all(currentUserId(res))) as Goal[];
    res.json({ data: rows.map(withProgress) });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = goalSchema.parse(req.body);
    const inserted = await db
      .prepare(
        `INSERT INTO goals (user_id, name, type, target_amount, current_amount, deadline, monthly_contribution)
         VALUES (@user_id, @name, @type, @target_amount, @current_amount, @deadline, @monthly_contribution) RETURNING id`,
      )
      .get({
        user_id: currentUserId(res),
        name: body.name,
        type: body.type,
        target_amount: body.target_amount,
        current_amount: body.current_amount,
        deadline: body.deadline ?? null,
        monthly_contribution: body.monthly_contribution,
      });
    const row = (await db.prepare('SELECT * FROM goals WHERE id = ?').get(inserted!.id)) as Goal;
    res.status(201).json({ data: withProgress(row) });
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = goalSchema.parse(req.body);
    const result = await db
      .prepare(
        `UPDATE goals SET
           name=@name, type=@type, target_amount=@target_amount, current_amount=@current_amount,
           deadline=@deadline, monthly_contribution=@monthly_contribution
         WHERE id=@id AND user_id=@user_id`,
      )
      .run({
        id: Number(req.params.id),
        user_id: currentUserId(res),
        name: body.name,
        type: body.type,
        target_amount: body.target_amount,
        current_amount: body.current_amount,
        deadline: body.deadline ?? null,
        monthly_contribution: body.monthly_contribution,
      });
    if (result.changes === 0) throw new ApiError(404, 'Goal not found');
    const row = (await db
      .prepare('SELECT * FROM goals WHERE id = ?')
      .get(Number(req.params.id))) as Goal;
    res.json({ data: withProgress(row) });
  }),
);

/** Add a contribution to a goal's current amount. */
router.post(
  '/:id/contribute',
  asyncHandler(async (req, res) => {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, 'amount must be positive');
    const result = await db
      .prepare('UPDATE goals SET current_amount = current_amount + ? WHERE id = ? AND user_id = ?')
      .run(amount, Number(req.params.id), currentUserId(res));
    if (result.changes === 0) throw new ApiError(404, 'Goal not found');
    const row = (await db
      .prepare('SELECT * FROM goals WHERE id = ?')
      .get(Number(req.params.id))) as Goal;
    res.json({ data: withProgress(row) });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await db
      .prepare('DELETE FROM goals WHERE id = ? AND user_id = ?')
      .run(Number(req.params.id), currentUserId(res));
    if (result.changes === 0) throw new ApiError(404, 'Goal not found');
    res.status(204).end();
  }),
);

export default router;
