export const runtimeHints = {
  warnOnMissing: true,
};

export function hint(message: string) {
  if (runtimeHints.warnOnMissing) {
    console.warn('[adorn/reflect]', message);
  }
}
