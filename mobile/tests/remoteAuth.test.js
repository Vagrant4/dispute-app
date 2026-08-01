const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadRemoteAuthModule() {
  const sourcePath = path.join(__dirname, "..", "src", "auth", "remoteAuth.ts");
  const source = readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", compiled)(module.exports, module);
  return module.exports;
}

test("registerRemoteAccount sends backend registration and returns pending email verification", async () => {
  const { registerRemoteAccount } = loadRemoteAuthModule();
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return Response.json({
      message: "Check your email to verify your account before logging in.",
      devVerificationCode: "971986",
      user: {
        id: "user_123",
        email: "worker@example.com",
        status: "PENDING_EMAIL_VERIFICATION",
      },
    }, { status: 201 });
  };

  const result = await registerRemoteAccount({
    name: "Local Worker",
    email: "Worker@Example.com",
    phone: "+65 9000 0000",
    password: "Password123!",
    confirmPassword: "Password123!",
  }, fetcher);

  assert.equal(result.ok, true);
  assert.equal(result.pending.email, "worker@example.com");
  assert.equal(result.pending.devVerificationCode, "971986");
  assert.equal(calls[0].url, "https://dispute-api-live.onrender.com/auth/register");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    email: "worker@example.com",
    password: "Password123!",
    fullName: "Local Worker",
    phone: "+65 9000 0000",
  });
});

test("verifyRemoteEmail posts the Gmail code and saves verified phone account", async () => {
  const { verifyRemoteEmail } = loadRemoteAuthModule();
  let savedAccounts = [];
  const storage = {
    async loadAccounts() {
      return [];
    },
    async saveAccounts(accounts) {
      savedAccounts = accounts;
    },
  };
  const fetcher = async () => Response.json({
    message: "Email verified. You are logged in.",
    user: {
      id: "user_123",
      email: "worker@example.com",
      status: "ACTIVE",
    },
  });

  const result = await verifyRemoteEmail({
    email: "worker@example.com",
    name: "Local Worker",
    phone: "+65 9000 0000",
    password: "Password123!",
    message: "Verification email sent.",
  }, "971986", storage, fetcher);

  assert.equal(result.ok, true);
  assert.equal(result.account.emailVerified, true);
  assert.equal(savedAccounts.length, 1);
  assert.equal(savedAccounts[0].id, "user_123");
  assert.equal("password" in savedAccounts[0], false);
});

test("verifyRemoteEmail rejects invalid code before calling backend", async () => {
  const { verifyRemoteEmail } = loadRemoteAuthModule();
  let called = false;
  const fetcher = async () => {
    called = true;
    return Response.json({});
  };

  const result = await verifyRemoteEmail({
    email: "worker@example.com",
    name: "Local Worker",
    phone: "+65 9000 0000",
    password: "Password123!",
    message: "Verification email sent.",
  }, "123", undefined, fetcher);

  assert.equal(result.ok, false);
  assert.equal(called, false);
});

test("resendRemoteVerificationCode requests a new backend code for pending account", async () => {
  const { resendRemoteVerificationCode } = loadRemoteAuthModule();
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return Response.json({
      message: "A new verification code was sent to your email.",
      devVerificationCode: "529899",
      user: {
        id: "user_123",
        email: "worker@example.com",
        status: "PENDING_EMAIL_VERIFICATION",
      },
    }, { status: 201 });
  };

  const result = await resendRemoteVerificationCode({
    email: "worker@example.com",
    name: "Local Worker",
    phone: "+65 9000 0000",
    password: "Password123!",
    message: "Verification email sent.",
  }, fetcher);

  assert.equal(result.ok, true);
  assert.equal(result.pending.devVerificationCode, "529899");
  assert.equal(result.pending.message, "A new verification code was sent to your email.");
  assert.equal(calls[0].url, "https://dispute-api-live.onrender.com/auth/resend-verification");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    email: "worker@example.com",
  });
});

test("requestRemoteEmailVerification recovers pending account from login credentials", async () => {
  const { requestRemoteEmailVerification } = loadRemoteAuthModule();
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return Response.json({
      message: "A new verification code was sent to your email.",
      devVerificationCode: "135876",
      user: {
        id: "user_123",
        email: "worker@example.com",
        status: "PENDING_EMAIL_VERIFICATION",
      },
    }, { status: 201 });
  };

  const result = await requestRemoteEmailVerification({
    email: "Worker@Example.com",
    password: "Password123!",
  }, fetcher);

  assert.equal(result.ok, true);
  assert.equal(result.pending.email, "worker@example.com");
  assert.equal(result.pending.name, "worker");
  assert.equal(result.pending.phone, "");
  assert.equal(result.pending.devVerificationCode, "135876");
  assert.equal(calls[0].url, "https://dispute-api-live.onrender.com/auth/resend-verification");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    email: "worker@example.com",
  });
});

test("loginRemoteAccount restores the server signup profile without storing a password", async () => {
  const { loginRemoteAccount } = loadRemoteAuthModule();
  const result = await loginRemoteAccount({
    email: "worker@example.com",
    password: "Password123!",
  }, async () => Response.json({
    user: { id: "user_123", email: "worker@example.com", status: "ACTIVE" },
    profile: { fullName: "Local Worker", phone: "+65 9000 0000" },
  }));

  assert.equal(result.ok, true);
  assert.equal(result.account.name, "Local Worker");
  assert.equal(result.account.phone, "+65 9000 0000");
  assert.equal("password" in result.account, false);
});

test("network failures do not expose the local development server URL to users", async () => {
  const { loginRemoteAccount, registerRemoteAccount } = loadRemoteAuthModule();
  const failingFetcher = async () => {
    throw new Error("network unavailable");
  };

  const loginResult = await loginRemoteAccount({
    email: "worker@example.com",
    password: "Password123!",
  }, failingFetcher);
  const registerResult = await registerRemoteAccount({
    name: "Local Worker",
    email: "worker@example.com",
    phone: "+65 9000 0000",
    password: "Password123!",
    confirmPassword: "Password123!",
  }, failingFetcher);

  assert.equal(loginResult.ok, false);
  assert.equal(registerResult.ok, false);
  assert.doesNotMatch(loginResult.message, /127\.0\.0\.1|4000|http/);
  assert.doesNotMatch(registerResult.message, /127\.0\.0\.1|4000|http/);
});

test("deleteRemoteAccount requires confirmation and sends authenticated permanent deletion", async () => {
  const { deleteRemoteAccount } = loadRemoteAuthModule();
  const calls = [];
  const result = await deleteRemoteAccount({
    password: "Password123!",
    confirmation: "DELETE",
    requestId: "22222222-2222-4222-8222-222222222222",
  }, async (url, init) => {
    calls.push({ url, init });
    return Response.json({
      requestId: "22222222-2222-4222-8222-222222222222",
      storageCleanupComplete: true,
      message: "Your Dispute account and associated data were permanently deleted.",
    });
  });

  assert.equal(result.ok, true);
  assert.equal(result.storageCleanupComplete, true);
  assert.equal(calls[0].url, "https://dispute-api-live.onrender.com/auth/account");
  assert.equal(calls[0].init.method, "DELETE");
  assert.equal(calls[0].init.credentials, "include");
});

test("deleteRemoteAccount preserves an uncertain outcome after a lost server response", async () => {
  const { deleteRemoteAccount } = loadRemoteAuthModule();
  const result = await deleteRemoteAccount({
    password: "Password123!",
    confirmation: "DELETE",
    requestId: "77777777-7777-4777-8777-777777777777",
  }, async () => {
    throw new Error("response lost");
  });

  assert.equal(result.ok, false);
  assert.equal(result.outcomeUncertain, true);
});

test("getRemoteAccountDeletionStatus distinguishes completed and unknown requests", async () => {
  const { getRemoteAccountDeletionStatus } = loadRemoteAuthModule();
  const requestId = "88888888-8888-4888-8888-888888888888";
  const completed = await getRemoteAccountDeletionStatus(requestId, async () =>
    Response.json({
      deleted: true,
      requestId,
      storageCleanupComplete: true,
    }),
  );
  const unknown = await getRemoteAccountDeletionStatus(requestId, async () =>
    Response.json({ deleted: false }, { status: 404 }),
  );

  assert.deepEqual(completed, {
    ok: true,
    deleted: true,
    requestId,
    storageCleanupComplete: true,
  });
  assert.deepEqual(unknown, { ok: true, deleted: false });
});
