import type { ResponsesSpec } from '../../contracts/responses';
import { normalizeResponses } from './normalize';

export function pickSuccessStatus(method: string, responses?: ResponsesSpec, explicit?: number): number {
  if (typeof explicit === 'number') return explicit;

  const m = method.toUpperCase();

  if (responses) {
    const normalized = normalizeResponses(responses);

    const codes = Object.keys(normalized)
      .filter((k) => /^\d+$/.test(k))
      .map((k) => Number(k))
      .filter((n) => n >= 200 && n < 300)
      .sort((a, b) => a - b);

    if (codes.length) {
      if (m === 'POST' && codes.includes(201)) return 201;
      if (codes.includes(200)) return 200;
      return codes[0];
    }
  }

  if (m === 'POST') return 201;
  if (m === 'DELETE') return 204;
  return 200;
}
