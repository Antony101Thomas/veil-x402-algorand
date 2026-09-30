export const POINTS_PER_DOLLAR = 10;
export const POINTS_TO_REDEEM = 100; // 100 pts = $1
export const FIRST_SESSION_BONUS = 50;
export const FIVE_STAR_BONUS = 20;

export function pointsToDollars(points: number): number {
  return parseFloat((points / POINTS_TO_REDEEM).toFixed(2));
}

export function dollarsToPoints(dollars: number): number {
  return Math.floor(dollars * POINTS_PER_DOLLAR);
}
