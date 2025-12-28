export type ReplyHeaderValue = string | number | boolean;
export type ReplyHeaders = Record<string, ReplyHeaderValue>;

export type Reply<TBody = unknown, TStatus extends number = number> = {
  readonly __adornReply: true;
  readonly status: TStatus;
  readonly body?: TBody;
  readonly headers?: ReplyHeaders;
  readonly contentType?: string;
};

export function isReply(x: unknown): x is Reply<any, any> {
  return !!x && typeof x === 'object' && (x as any).__adornReply === true && typeof (x as any).status === 'number';
