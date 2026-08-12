export const DEFAULT_PAGE_SIZE = 24;
export const MAX_BATCH_SIZE = 50;
export const MAX_SCANNED_DOCS = 500;

export const normalizeText = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const getSingleQueryValue = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
};

export const parsePageSize = (value: string | undefined): number => {
  const parsed = Number(value ?? DEFAULT_PAGE_SIZE);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.floor(parsed), MAX_BATCH_SIZE);
};

export const parseNumber = (value: string | undefined): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
