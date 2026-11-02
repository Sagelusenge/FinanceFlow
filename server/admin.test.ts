import { test } from "node:test";
import { strict as assert } from "node:assert";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";

test("one admin can manage users after changing the initial password", async () => {
  const port = 33000 + Math.floor(Math.random() * 1000);
  const databaseFile = `data/admin-test-${randomUUID()}.sqlite`;
  const environment = {
    ...process.env,
    PORT: String(port),
    DATABASE_FILE: databaseFile,
    ADMIN_EMAIL: "root@test.local",
    ADMIN_INITIAL_PASSWORD: "test admin password",
  };
  async function start() {
    const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "server/index.ts"], {
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    for (let attempt = 0; attempt < 100 && !output.includes("FinanceFlow:"); attempt++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    assert.match(output, /FinanceFlow:/, output);
    return child;
  }
  async function stop(child: ChildProcess) {
    child.kill();
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 1000))]);
  }
  async function call(path: string, method = "GET", data?: unknown, cookie = "") {
    const response = await fetch(`http://localhost:${port}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
    };
  }
  let child = await start();
  try {
    const admin = await call("/auth/login", "POST", { email: "root@test.local", password: "test admin password" });
    assert.equal(admin.status, 200);
    assert.equal(admin.body.user.is_admin, true);
    assert.equal(admin.body.user.must_change_password, true);
    assert.match(admin.body.recoveryCode, /^[0-9a-f]{32}$/);
    assert.equal((await call("/auth/register", "POST", { name: "Impostor", email: "root@test.local", password: "another password 123" })).status, 403);
    assert.equal((await call("/admin/summary", "GET", undefined, admin.cookie)).status, 403);
    const changed = await call("/me/password", "PUT", { currentPassword: "test admin password", newPassword: "changed admin password" }, admin.cookie);
    assert.equal(changed.status, 200);
    assert.equal(changed.body.must_change_password, false);
    assert.equal((await call("/admin/summary", "GET", undefined, admin.cookie)).body.users, 1);
    const member = await call("/auth/register", "POST", { name: "Member", email: "member@test.local", password: "member password 123" });
    assert.equal(member.status, 201);
    assert.equal((await call("/admin/summary", "GET", undefined, member.cookie)).status, 403);
    const users = await call("/admin/users", "GET", undefined, admin.cookie);
    assert.equal(users.status, 200);
    assert.equal(users.body.total, 2);
    assert.equal(users.body.items.some((item: { password_hash?: string }) => item.password_hash), false);
    assert.equal((await call(`/admin/users/${admin.body.user.id}/status`, "PUT", { disabled: true }, admin.cookie)).status, 403);
    assert.equal((await call(`/admin/users/${member.body.user.id}/status`, "PUT", { disabled: true }, admin.cookie)).status, 200);
    assert.equal((await call("/me", "GET", undefined, member.cookie)).status, 401);
    assert.equal((await call("/auth/login", "POST", { email: "member@test.local", password: "member password 123" })).status, 403);
    assert.equal((await call(`/admin/users/${member.body.user.id}/status`, "PUT", { disabled: false }, admin.cookie)).status, 200);
    assert.equal((await call("/auth/login", "POST", { email: "member@test.local", password: "member password 123" })).status, 200);
    await stop(child);
    child = await start();
    assert.equal((await call("/auth/login", "POST", { email: "root@test.local", password: "test admin password" })).status, 401);
    assert.equal((await call("/auth/login", "POST", { email: "root@test.local", password: "changed admin password" })).status, 200);
  } finally {
    await stop(child);
  }
});
