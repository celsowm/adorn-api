export interface AuthResult {
  principal: any;
  scopes?: string[];
}

export interface AuthSchemeRuntime {
  name: string;
  authenticate(req: any): Promise<AuthResult | null>;
  challenge(res: any): void;
  authorize?(auth: AuthResult, requiredScopes: string[]): boolean;
}

export function createBearerJwtRuntime(options: {
  getToken: (req: any) => string | undefined;
  verify?: (token: string) => Promise<any>;
  getScopes?: (payload: any) => string[];
}) {
  const { getToken, verify = async (token: string) => ({ token }), getScopes = () => [] } = options;

  return {
    name: "BearerAuth",
    async authenticate(req: any) {
      const token = getToken(req);
      if (!token) return null;

      try {
        const payload = await verify(token);
        const scopes = getScopes(payload);
        return { principal: payload, scopes };
      } catch {
        return null;
      }
    },
    challenge(res: any) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="access"');
      res.status(401).json({ error: "Unauthorized", message: "Missing or invalid Bearer token" });
    },
    authorize(auth: AuthResult, requiredScopes: string[]) {
      if (requiredScopes.length === 0) return true;
      const userScopes = auth.scopes || [];
      return requiredScopes.every(scope => userScopes.includes(scope));
    },
  };
}

export function createApiKeyHeaderRuntime(options: {
  headerName: string;
  validate: (key: string) => Promise<any>;
}) {
  const { headerName, validate } = options;

  return {
    name: "ApiKeyAuth",
    async authenticate(req: any) {
      const key = req.headers[headerName.toLowerCase()];
      if (!key) return null;

      try {
        const principal = await validate(key);
        return { principal };
      } catch {
        return null;
      }
    },
    challenge(res: any) {
      res.status(401).json({ error: "Unauthorized", message: `Missing or invalid ${headerName}` });
    },
  };
}
