export const EXPIRED_SESSION_MESSAGE = "Sua sessão expirou. Entre novamente.";
export const SESSION_EXPIRED_EVENT = "agrolico:session-expired";
export const AUTH_CHECK_TIMEOUT_MS = 12000;

export function withAuthTimeout<T>(request: PromiseLike<T>, timeoutMs = AUTH_CHECK_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    Promise.resolve(request),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error("A consulta de acesso demorou demais.")), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  error_description?: unknown;
};

export function isExpiredAuthError(error: ErrorLike | string | null | undefined) {
  if (!error) return false;
  if (typeof error === "string") return hasExpiredTokenSignal(error);

  const code = String(error.code ?? "").toUpperCase();
  if (code === "PGRST303") return true;

  return hasExpiredTokenSignal(
    [error.message, error.details, error.error_description]
      .filter(Boolean)
      .join(" "),
  );
}

function hasExpiredTokenSignal(value: string) {
  const normalized = value.toLowerCase();
  return (
    /jwt[^a-z0-9]+expired/.test(normalized) ||
    /token[^a-z0-9]+(has[^a-z0-9]+)?expired/.test(normalized) ||
    normalized.includes("invalid refresh token") ||
    normalized.includes("refresh token not found")
  );
}
