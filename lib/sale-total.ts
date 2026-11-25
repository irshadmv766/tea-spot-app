import type { CartLine } from "./types";

export function cartLinesTotal(lines: CartLine[]): number {
  return lines.reduce((acc, line) => acc + line.qty * line.unitPrice, 0);
}

/** Spread a target sale total across cart lines by scaling unit prices (RPC sums lines). */
export function applyManualSaleTotal(
  lines: CartLine[],
  targetTotal: number
): CartLine[] {
  if (lines.length === 0) return lines;
  if (!Number.isFinite(targetTotal) || targetTotal < 0) {
    throw new Error("Enter a valid total.");
  }

  const subtotal = cartLinesTotal(lines);
  if (subtotal <= 0) {
    throw new Error("Add items before setting a total.");
  }
  if (Math.abs(targetTotal - subtotal) < 0.005) {
    return lines.map((line) => ({
      ...line,
      unitPrice: Math.round(line.unitPrice * 100) / 100,
    }));
  }

  const factor = targetTotal / subtotal;
  const scaled = lines.map((line) => ({
    ...line,
    unitPrice: Math.round(line.unitPrice * factor * 100) / 100,
  }));

  let sum = cartLinesTotal(scaled);
  let remainder = Math.round((targetTotal - sum) * 100) / 100;
  if (remainder !== 0) {
    const lastIdx = scaled.length - 1;
    const last = scaled[lastIdx];
    const perUnit = remainder / last.qty;
    scaled[lastIdx] = {
      ...last,
      unitPrice: Math.max(
        0,
        Math.round((last.unitPrice + perUnit) * 100) / 100
      ),
    };
    sum = cartLinesTotal(scaled);
    remainder = Math.round((targetTotal - sum) * 100) / 100;
    if (Math.abs(remainder) >= 0.01 && scaled.length > 1) {
      const first = scaled[0];
      scaled[0] = {
        ...first,
        unitPrice: Math.max(
          0,
          Math.round((first.unitPrice + remainder / first.qty) * 100) / 100
        ),
      };
    }
  }

  return scaled;
}