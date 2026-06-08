// app/lib/journeyFormat.ts
import type { Journey, Currency } from './journey';

export const money = (n: number, sym = '£') => sym + Math.round(n).toLocaleString('en-GB');
export const moneyIn = (j: Journey, cur: Currency, n: number) => j.price[cur].sym + Math.round(n).toLocaleString('en-GB');
export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const statusWord = (s: 'confirmed' | 'confirming' | 'held') =>
  s === 'confirming' ? 'Confirming' : s === 'held' ? 'Held' : 'Confirmed';
export const hm = (iso: string) => new Date(iso).toTimeString().slice(0, 5);
export const durStr = (a: string, b: string) => {
  const m = Math.round((+new Date(b) - +new Date(a)) / 6e4);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
};
