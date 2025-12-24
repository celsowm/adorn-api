export function ensureDecoratorMetadata(): void {
  // Standard decorators emit uses Symbol.metadata; Node doesn't guarantee it exists.
  // Must run BEFORE decorated modules are evaluated.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Symbol as any).metadata ??= Symbol('Symbol.metadata');
}
