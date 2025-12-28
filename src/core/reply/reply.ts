import type { Reply, ReplyHeaders } from '../../contracts/reply';

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
    body,
    headers: init.headers,
    contentType: init.contentType,
  };
}

export function noContent<const TStatus extends number = 204>(
  status?: TStatus,
  init: ReplyInit = {},
): Reply<undefined, TStatus> {
  return {
    __adornReply: true,
    status: (status ?? (204 as TStatus)),
    body: undefined,
    headers: init.headers,
    contentType: init.contentType,
  };
}
