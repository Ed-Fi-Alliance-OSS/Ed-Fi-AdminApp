const CONTROL_CHARACTERS = /\p{Cc}/gu;

export function sanitizeText(value: string | null | undefined, maxLength: number): string | null {
  const sanitized = (value ?? '').replace(CONTROL_CHARACTERS, '').slice(0, maxLength);
  return sanitized === '' ? null : sanitized;
}

export function stripQueryString(url: string): string {
  const end = url.search(/[?#]/);
  return end === -1 ? url : url.slice(0, end);
}
