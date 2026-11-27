export type ReceiptLineItem = { name: string; price: number };

export type ParsedReceipt = {
  merchantName: string | null;
  date: string | null;
  totalAmount: number | null;
  description: string | null;
  items: ReceiptLineItem[];
  rawText: string;
};

const TOTAL_LABEL =
  /\b(grand\s*total|net\s*amount|amount\s*paid|bill\s*amount|total\s*amount|total\s*due|payable|net\s*payable|gross\s*total)\b/i;

const EXCLUDED_AMOUNT_LABEL =
  /\b(sub\s*total|subtotal|tax|gst|cgst|sgst|igst|vat|discount|round\s*off|change|cash\s*tendered|savings|tip|service\s*charge|delivery)\b/i;

const AMOUNT_RE =
  /(?:₹|rs\.?|inr\s*)?\s*(\d{1,3}(?:[,\s]\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;

const DATE_PATTERNS: { re: RegExp; parse: (m: RegExpMatchArray) => string | null }[] = [
  {
    re: /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/,
    parse: (m) => ymd(Number(m[1]), Number(m[2]), Number(m[3])),
  },
  {
    re: /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/,
    parse: (m) => ymd(Number(m[3]), Number(m[2]), Number(m[1])),
  },
  {
    re: /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2})\b/,
    parse: (m) => {
      const yy = Number(m[3]);
      const year = yy >= 70 ? 1900 + yy : 2000 + yy;
      return ymd(year, Number(m[2]), Number(m[1]));
    },
  },
  {
    re: /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{2,4})\b/i,
    parse: (m) => {
      const month = monthIndex(m[2]);
      if (month < 0) return null;
      let year = Number(m[3]);
      if (year < 100) year = year >= 70 ? 1900 + year : 2000 + year;
      return ymd(year, month + 1, Number(m[1]));
    },
  },
];

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

function monthIndex(token: string): number {
  const t = token.toLowerCase().slice(0, 3);
  return MONTHS.indexOf(t);
}

function ymd(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2100) {
    return null;
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function normalizeLines(raw: string): string[] {
  return raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseAmountToken(raw: string): number | null {
  const cleaned = raw.replace(/[₹rs.\s]/gi, "").replace(/,/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function amountsInLine(line: string): number[] {
  const found: number[] = [];
  for (const m of line.matchAll(AMOUNT_RE)) {
    const v = parseAmountToken(m[1] ?? m[0]);
    if (v != null) found.push(v);
  }
  return found;
}

function extractDate(lines: string[]): string | null {
  const haystack = lines.join(" ");
  for (const { re, parse } of DATE_PATTERNS) {
    const m = haystack.match(re);
    if (m) {
      const d = parse(m);
      if (d) return d;
    }
  }
  return null;
}

function lineLooksLikeNoise(line: string): boolean {
  if (line.length < 2) return true;
  if (/^(ph|phone|tel|gstin|cin|fssai|www\.|http)/i.test(line)) return true;
  if (/^\d{10,}$/.test(line.replace(/\s/g, ""))) return true;
  return false;
}

function extractMerchant(lines: string[]): string | null {
  const candidates = lines.slice(0, 8).filter((line) => {
    if (lineLooksLikeNoise(line)) return false;
    if (DATE_PATTERNS.some(({ re }) => re.test(line))) return false;
    const amounts = amountsInLine(line);
    if (amounts.length > 0 && line.replace(/[₹rs.\d,.\s-]/gi, "").length < 4) {
      return false;
    }
    return true;
  });
  if (candidates.length === 0) return null;
  const best = candidates[0];
  return best.length > 60 ? best.slice(0, 60).trim() : best;
}

function pickTotalAmount(lines: string[]): number | null {
  type Candidate = { amount: number; score: number };
  const candidates: Candidate[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lower = line.toLowerCase();

    if (EXCLUDED_AMOUNT_LABEL.test(lower)) {
      const amounts = amountsInLine(line);
      for (const a of amounts) {
        candidates.push({ amount: a, score: -50 });
      }
      continue;
    }

    if (TOTAL_LABEL.test(lower)) {
      const sameLine = amountsInLine(line);
      if (sameLine.length > 0) {
        const amt = sameLine[sameLine.length - 1]!;
        candidates.push({ amount: amt, score: 100 });
      } else if (i + 1 < lines.length) {
        const next = amountsInLine(lines[i + 1]!);
        if (next.length > 0) {
          candidates.push({ amount: next[next.length - 1]!, score: 95 });
        }
      }
      continue;
    }

    if (/\btotal\b/i.test(lower) && !EXCLUDED_AMOUNT_LABEL.test(lower)) {
      const amounts = amountsInLine(line);
      if (amounts.length > 0) {
        candidates.push({
          amount: amounts[amounts.length - 1]!,
          score: 70,
        });
      }
    }
  }

  const viable = candidates.filter((c) => c.score > 0);
  if (viable.length === 0) {
    const all = lines
      .filter((l) => !EXCLUDED_AMOUNT_LABEL.test(l))
      .flatMap((l) => amountsInLine(l));
    if (all.length === 0) return null;
    return Math.max(...all);
  }

  viable.sort((a, b) => b.score - a.score || b.amount - a.amount);
  return viable[0]!.amount;
}

function extractLineItems(lines: string[]): ReceiptLineItem[] {
  const items: ReceiptLineItem[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (TOTAL_LABEL.test(lower) || EXCLUDED_AMOUNT_LABEL.test(lower)) continue;
    if (/^(qty|item|description|product|sr\.?|s\.?no)/i.test(line)) continue;

    const amounts = amountsInLine(line);
    if (amounts.length !== 1) continue;
    const price = amounts[0]!;
    const namePart = line
      .replace(AMOUNT_RE, "")
      .replace(/\s+x\s*\d+/gi, "")
      .trim();
    if (namePart.length < 2 || namePart.length > 80) continue;
    if (/^\d+$/.test(namePart)) continue;
    items.push({ name: namePart, price });
  }
  return items.slice(0, 20);
}

function buildDescription(
  date: string | null,
  items: ReceiptLineItem[],
  rawLines: string[]
): string | null {
  const parts: string[] = [];
  if (date) parts.push(`Receipt date: ${formatDisplayDate(date)}`);

  if (items.length > 0) {
    const summary = items
      .slice(0, 5)
      .map((it) => `${it.name} (₹${it.price})`)
      .join("; ");
    parts.push(summary);
    if (items.length > 5) parts.push(`+${items.length - 5} more items`);
  } else {
    const footer = rawLines
      .slice(-4)
      .filter((l) => !TOTAL_LABEL.test(l) && !EXCLUDED_AMOUNT_LABEL.test(l))
      .join(" · ");
    if (footer.trim()) parts.push(footer.trim());
  }

  if (parts.length === 0) return null;
  const text = parts.join("\n");
  return text.length > 500 ? text.slice(0, 497) + "…" : text;
}

function formatDisplayDate(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Parse OCR text from a receipt into structured expense fields.
 * Never invents data — missing fields stay null.
 */
export function parseReceiptText(rawText: string): ParsedReceipt {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return emptyParsed("");
  }

  const lines = normalizeLines(trimmed);
  const merchantName = extractMerchant(lines);
  const date = extractDate(lines);
  const totalAmount = pickTotalAmount(lines);
  const items = extractLineItems(lines);
  const description = buildDescription(date, items, lines);

  return {
    merchantName,
    date,
    totalAmount,
    description,
    items,
    rawText: trimmed,
  };
}

function emptyParsed(rawText: string): ParsedReceipt {
  return {
    merchantName: null,
    date: null,
    totalAmount: null,
    description: null,
    items: [],
    rawText,
  };
}