/**
 * Форматує числові показники з розділювачем тисяч:
 * 1691058 -> "1 691 058"
 * -24577  -> "-24 577"
 * null    -> "—"
 */
export function formatCurrency(
  val: number | string | null | undefined,
  options?: { isDeduction?: boolean; decimals?: number }
): string {
  if (val === null || val === undefined || val === "") {
    return "—";
  }

  const num = typeof val === "string" ? parseFloat(val.replace(/\s+/g, "").replace(",", ".")) : val;
  if (isNaN(num)) {
    return "—";
  }

  const isDeduction = options?.isDeduction ?? false;
  const decimals = options?.decimals ?? 0;

  // Форматування з пробілами
  const parts = Math.abs(num).toFixed(decimals).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const formattedAbs = parts.join(",");

  if (isDeduction) {
    return `(${formattedAbs})`;
  }

  return num < 0 ? `-${formattedAbs}` : formattedAbs;
}

export interface MetricChange {
  absolute: number | null;
  percent: number | null;
  direction: "positive" | "negative" | "neutral" | "none";
  text: string;
}

/**
 * Розраховує динаміку між двома періодами
 */
export function calculateChange(
  previous: number | null | undefined,
  current: number | null | undefined
): MetricChange {
  if (previous === null || previous === undefined || current === null || current === undefined) {
    return {
      absolute: null,
      percent: null,
      direction: "none",
      text: "—",
    };
  }

  const abs = current - previous;
  if (abs === 0) {
    return {
      absolute: 0,
      percent: 0,
      direction: "neutral",
      text: "0.0%",
    };
  }

  let pct: number | null = null;
  if (previous !== 0) {
    pct = (abs / Math.abs(previous)) * 100;
  }

  const isPositive = abs > 0;
  const direction = isPositive ? "positive" : "negative";
  const prefix = isPositive ? "+" : "";

  const text = pct !== null 
    ? `${prefix}${pct.toFixed(1)}%` 
    : `${prefix}${formatCurrency(abs)} тис. грн`;

  return {
    absolute: abs,
    percent: pct,
    direction,
    text,
  };
}

/**
 * Форматує дату зі стандарту ДПС (DDMMYYYY -> DD.MM.YYYY)
 */
export function formatDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const clean = raw.trim();
  if (clean.length === 8 && /^\d+$/.test(clean)) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 4)}.${clean.slice(4)}`;
  }
  return clean;
}
