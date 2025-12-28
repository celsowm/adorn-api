import type { Reply, ReplyHeaders } from '../../contracts/reply.js';

export type ReplyInit = {
  headers?: ReplyHeaders;
  contentType?: string;
};

export function reply<TBody, const TStatus extends number>(
  status: TStatus,
  body: TBody,
  init: ReplyInit = {},
): Reply<TBody, TStatus> {
  return {
    __adornReply: true,
    status,
    ...(body !== undefined ? { body } : {}),
    ...(init.headers !== undefined ? { headers: init.headers } : {}),
    ...(init.contentType !== undefined ? { contentType: init.contentType } : {}),
  };
}

export function noContent<const TStatus extends number = 204>(
  status?: TStatus,
  init: ReplyInit = {},
): Reply<undefined, TStatus> {
  return {
    __adornReply: true,
    status: (status ?? (204 as TStatus)),
    ...(init.headers !== undefined ? { headers: init.headers } : {}),
    ...(init.contentType !== undefined ? { contentType: init.contentType } : {}),
  };
}
