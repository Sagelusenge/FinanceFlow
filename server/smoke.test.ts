import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';

test('sessions, ownership, balances and transfers', async () => {
  const port = 32000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server/index.ts'], { env: { ...process.env, PORT: String(port), DATABASE_FILE: `data/test-${randomUUID()}.sqlite` }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    let ready = false;
    child.stdout.on('data', chunk => { if (String(chunk).includes('FinanceFlow:')) ready = true; });
    for (let i = 0; i < 100 && !ready; i++) await new Promise(r => setTimeout(r, 100));
    assert.ok(ready, 'server starts');
    const call = async (path: string, method = 'GET', data?: unknown, cookie = '') => {
      const response = await fetch(`http://localhost:${port}/api${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: data ? JSON.stringify(data) : undefined });
      return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
    };
    const first = await call('/auth/register', 'POST', { name: 'Alice', email: 'alice@test.local', password: 'correct horse battery' });
    assert.equal(first.status, 201);
    assert.ok(first.body.recoveryCode);
    const cookie = first.cookie;
    const accountA = await call('/accounts', 'POST', { name: 'Cash', type: 'cash', currency: 'USD', openingBalance: 100 }, cookie);
    const accountB = await call('/accounts', 'POST', { name: 'Bank', type: 'bank', currency: 'USD', openingBalance: 0 }, cookie);
    const cats = await call('/categories', 'GET', undefined, cookie);
    const category = cats.body.find((x: {type:string}) => x.type === 'expense').id;
    const expense = await call('/transactions', 'POST', { type: 'expense', amount: 10, currency: 'USD', account_id: accountA.body.id, category_id: category, description: 'Test expense', transaction_date: '2026-11-01' }, cookie);
    assert.equal(expense.status, 201);
    const transfer = await call('/transactions', 'POST', { type: 'transfer', amount: 20, currency: 'USD', account_id: accountA.body.id, target_account_id: accountB.body.id, description: 'Move', transaction_date: '2026-11-01' }, cookie);
    assert.equal(transfer.status, 201);
    const accounts = await call('/accounts', 'GET', undefined, cookie);
    assert.equal(accounts.body.find((x: {id:string}) => x.id === accountA.body.id).balance_cents, 7000);
    assert.equal(accounts.body.find((x: {id:string}) => x.id === accountB.body.id).balance_cents, 2000);
    const analytics = await call('/analytics?from=2026-11-01&to=2026-11-30&currency=USD', 'GET', undefined, cookie);
    assert.deepEqual(analytics.body.totals, [{ type: 'expense', amount_cents: 1000 }]);
    const second = await call('/auth/register', 'POST', { name: 'Bob', email: 'bob@test.local', password: 'another correct password' });
    assert.equal(second.status, 201);
    assert.equal((await call(`/transactions/${expense.body.id}`, 'GET', undefined, second.cookie)).status, 404);
    assert.equal((await call(`/accounts/${accountA.body.id}`, 'DELETE', undefined, second.cookie)).status, 404);
    assert.equal((await call('/transactions', 'GET', undefined, second.cookie)).body.total, 0);
    assert.equal((await call('/me', 'GET', undefined, '')).status, 401);
  } finally { child.kill(); await Promise.race([once(child, 'exit'), new Promise(r => setTimeout(r, 1000))]); }
});
