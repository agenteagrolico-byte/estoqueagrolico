export const EXPIRED_SESSION_MESSAGE = "Sua sessão expirou. Entre novamente.";
export const SESSION_EXPIRED_EVENT = "agrolico:session-expired";

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
