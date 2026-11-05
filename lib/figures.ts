export const NEAR_DAYS = 90;

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function simpleInterest(
  principal: number,
  annualPercent: number,
  days: number,
) {
  if (![principal, annualPercent, days].every(Number.isFinite)) return null;
  if (principal <= 0 || annualPercent < 0 || days <= 0) return null;
  if (annualPercent > 36 || days > 20000) return null;
  return (
    Math.round(((principal * (annualPercent / 100) * days) / 365) * 100) / 100
  );
}

const FEE_BANDS = [
  { upTo: 100_000, rate: 0.025 },
  { upTo: 200_000, rate: 0.02 },
  { upTo: 500_000, rate: 0.015 },
  { upTo: 1_000_000, rate: 0.01 },
  { upTo: 2_000_000, rate: 0.009 },
  { upTo: 5_000_000, rate: 0.008 },
  { upTo: 10_000_000, rate: 0.007 },
  { upTo: 20_000_000, rate: 0.006 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.005 },
];

export function courtFee(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (amount <= 10_000) return 50;
  let fee = 50;
  let previous = 10_000;
  for (const band of FEE_BANDS) {
    const slice = Math.min(amount, band.upTo) - previous;
    if (slice > 0) fee += slice * band.rate;
    if (amount <= band.upTo) break;
    previous = band.upTo;
  }
  return Math.round(fee * 100) / 100;
}

export function todayISO(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function plusDays(iso: string, days: number) {
  if (!isIsoDate(iso)) return "";
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return todayISO(date);
}

export function daysUntil(target: string, today = todayISO()) {
  if (!isIsoDate(target) || !isIsoDate(today)) return null;
  const [year, month, day] = today.split("-").map(Number);
  const [targetYear, targetMonth, targetDay] = target.split("-").map(Number);
  return Math.round(
    (Date.UTC(targetYear, targetMonth - 1, targetDay) -
      Date.UTC(year, month - 1, day)) /
      86400000,
  );
}

export function promptPhrase(days: number, kind: "届满" | "截止") {
  if (days < 0) return `已过 ${-days} 天`;
  if (days === 0) return kind === "届满" ? "今天届满" : "今天截止";
  return `还剩 ${days} 天`;
}

export function parseAmount(value: string, options?: { allowZero?: boolean }) {
  const cleaned = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  const minimum = options?.allowZero ? 0 : 0.01;
  if (!Number.isFinite(amount) || amount < minimum || amount > 1_000_000_000_000) {
    return null;
  }
  return Math.round(amount * 100) / 100;
}

export function yuan(amount: number) {
  const [whole, fraction] = amount.toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped}.${fraction} 元`;
}
