/** Categorical color palette for charts (works in light and dark themes). */
export const CHART_COLORS = [
  '#4f46e5',
  '#06b6d4',
  '#16a34a',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#3b82f6',
  '#84cc16',
  '#a855f7',
];

export const colorAt = (i: number) => CHART_COLORS[i % CHART_COLORS.length];
