import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPIRED_SESSION_MESSAGE,
  isExpiredAuthError,
  withAuthTimeout,
} from "../src/lib/auth-errors.ts";

test("encerra uma verificacao de acesso que nunca responde", async () => {
  await assert.rejects(
    withAuthTimeout(new Promise<never>(() => {}), 10),
    /consulta de acesso demorou demais/i,
  );
});

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
