import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPIRED_SESSION_MESSAGE,
  isExpiredAuthError,
} from "../src/lib/auth-errors.ts";

test("identifica o erro JWT expirado retornado pelo PostgREST", () => {
  assert.equal(
    isExpiredAuthError({ code: "PGRST303", message: "JWT expired" }),
    true,
  );
  assert.equal(EXPIRED_SESSION_MESSAGE, "Sua sessão expirou. Entre novamente.");
});

test("não encerra a sessão por um erro comum de permissão", () => {
  assert.equal(
    isExpiredAuthError({ code: "42501", message: "permission denied" }),
    false,
  );
});
