const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
const MS_PER_HOUR = MS_PER_MINUTE * MINUTES_PER_HOUR;
const MS_PER_DAY = MS_PER_HOUR * HOURS_PER_DAY;

const PLACEHOLDER_PATTERN = /\{([a-z_]+)\}/g;

export type PromoTextVars = Readonly<Record<string, string | null>>;

/**
 * Fills `{placeholders}` in remote promo copy.
 *
 * Returns null when the text uses a placeholder we cannot resolve from real
 * data — e.g. `{trial}` while the store offers no trial. Callers drop the line
 * entirely rather than render a half-empty sentence, so a promo can never
 * promise something the store does not actually give.
 */
export function renderPromoText(
  text: string | null,
  vars: PromoTextVars,
): string | null {
  if (text === null) return null;

  let unresolved = false;
  const rendered = text.replace(PLACEHOLDER_PATTERN, (_match, name: string) => {
    const value = vars[name];
    if (value === undefined || value === null) {
      unresolved = true;
      return "";
    }
    return value;
  });

  if (unresolved) return null;

  const collapsed = rendered.replace(/\s+/g, " ").trim();
  return collapsed.length > 0 ? collapsed : null;
}

/**
 * Compact remaining time for countdowns: "2d 5h", "3h 12m", "4m 21s".
 * Units stay as letters so the string works regardless of the copy language.
 */
export function formatTimeRemaining(remainingMs: number): string | null {
  if (remainingMs <= 0) return null;

  const days = Math.floor(remainingMs / MS_PER_DAY);
  const hours = Math.floor((remainingMs % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((remainingMs % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((remainingMs % MS_PER_MINUTE) / MS_PER_SECOND);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

/**
 * How often a countdown needs to re-render: every second in the final hour,
 * once a minute before that.
 */
export function countdownIntervalMs(remainingMs: number): number {
  return remainingMs <= MS_PER_HOUR ? MS_PER_SECOND : MS_PER_MINUTE;
}
