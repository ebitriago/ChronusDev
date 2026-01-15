// Utilidades

export function uuid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

export function generateToken(): string {
  return `token-${Math.random().toString(36).slice(2, 15)}${Math.random().toString(36).slice(2, 15)}`;
}

export function getAuthToken(req: any): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return req.headers["x-auth-token"] || req.headers["x-user-id"];
}
