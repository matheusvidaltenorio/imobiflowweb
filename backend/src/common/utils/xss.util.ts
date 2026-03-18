import * as xss from 'xss';

export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return input;
  return xss.filterXSS(input, {
    whiteList: {},
    stripIgnoreTag: true,
  });
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      result[key] = sanitizeInput(obj[key] as string);
    } else {
      result[key] = obj[key];
    }
  }
  return result as T;
}
