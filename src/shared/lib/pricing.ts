/* One lunch, one price. Everything that shows money goes through here. */

export const LUNCH_PRICE = 5.5;

/** Slovak formatting: 5,50 €. Hand-rolled so server and client always agree. */
export function eur(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(2).replace(".", ",")} €`;
}

/** How many lunches a balance still covers. */
export function lunchesLeft(balance: number): number {
  return Math.max(0, Math.floor(balance / LUNCH_PRICE));
}
