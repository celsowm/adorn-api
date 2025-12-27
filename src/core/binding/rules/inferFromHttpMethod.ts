export type PayloadConvention = {
  primary: 'query' | 'body' | 'none';
  secondary: 'query' | 'body' | 'none';
};

export function conventionForMethod(method: string): PayloadConvention {
  const m = method.toUpperCase();

  if (m === 'GET' || m === 'DELETE') {
    return { primary: 'query', secondary: 'none' };
  }

  if (m === 'POST' || m === 'PUT' || m === 'PATCH') {
    return { primary: 'body', secondary: 'query' };
  }

  return { primary: 'none', secondary: 'none' };
}
