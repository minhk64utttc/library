// Run inside a test API container using a dedicated inventory_test_* PostgreSQL schema.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { hash } = require('@node-rs/argon2');
const database = new URL(process.env.DATABASE_URL);
assert.match(database.searchParams.get('schema') || '', /^inventory_test_/);
const db = new PrismaClient();
const base = 'http://localhost:3000/api';
async function call(path, cookie, body) {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(cookie ? { Cookie: cookie } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json().catch(() => null), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function main() {
  const suffix = randomUUID();
  const password = randomUUID();
  const passwordHash = await hash(password);
  async function account(role) {
    const user = await db.account.create({ data: { email: `${role}-${suffix}@test.local`, passwordHash, roles: { create: { role } }, profile: { create: { fullName: role } } } });
    const login = await call('/auth/login', null, { email: user.email, password });
    assert.equal(login.status, 200);
    return { ...user, cookie: login.cookie };
  }
  const staff = await account('inventory');
  const manager = await account('manager');
  const reader = await account('reader');
  const cataloger = await account('cataloging');
  const collector = await account('circulation');
  const admin = await account('admin');
  for (const user of [cataloger, reader, admin]) {
    assert.equal((await call('/circulation/fines', user.cookie)).status, 403);
    assert.equal((await call('/circulation/reservations', user.cookie)).status, 403);
  }
  for (const user of [manager, collector]) {
    assert.equal((await call('/circulation/fines', user.cookie)).status, 200);
    assert.equal((await call('/circulation/reservations', user.cookie)).status, 200);
  }
  assert.equal((await call(`/circulation/fines/${randomUUID()}/pay`, manager.cookie, {})).status, 403);
  assert.equal((await call(`/circulation/fines/${randomUUID()}/waive`, collector.cookie, {})).status, 403);
  const shelf = await db.location.create({ data: { code: suffix, name: 'Kệ kiểm thử' } });
  const elsewhere = await db.location.create({ data: { code: `${suffix}-B`, name: 'Kệ B' } });
  const work = await db.work.create({ data: { title: 'Kiểm thử kiểm kê', status: 'published' } });
  const edition = await db.edition.create({ data: { workId: work.id, callNumber: suffix } });
  const copies = [];
  for (let i = 0; i < 5; i++) copies.push(await db.copy.create({ data: { code: `${suffix}-${i}`, editionId: edition.id, locationId: shelf.id, status: i === 4 ? 'on_loan' : 'available' } }));
  await db.loan.create({ data: { copyId: copies[4].id, borrowerId: reader.id, dueAt: new Date(Date.now() + 86400000), loanDays: 1 } });
  assert.equal((await call('/inventory')).status, 401);
  assert.equal((await call('/inventory', reader.cookie)).status, 403);
  assert.equal((await call('/inventory', manager.cookie, { name: 'Không được tạo', locationId: shelf.id })).status, 403);
  const created = await Promise.all([1, 2].map(() => call('/inventory', staff.cookie, { name: 'Kiểm kê thử', locationId: shelf.id })));
  assert.deepEqual(created.map(r => r.status).sort(), [201, 409]);
  const run = created.find(r => r.status === 201).data;
  assert.equal(run.total, 5);
  const path = `/inventory/${run.id}`;
  assert.equal((await call(path + '/close', staff.cookie, {})).status, 409);
  assert.equal((await call(path + '/scan', staff.cookie, { code: copies[0].code, locationId: elsewhere.id })).data.result, 'misplaced');
  assert.equal((await call(path + '/scan', staff.cookie, { code: copies[0].code, locationId: shelf.id })).data.result, 'matched');
  await db.copy.update({ where: { id: copies[3].id }, data: { locationId: elsewhere.id } });
  assert.equal((await call(path + '/reconcile', staff.cookie, {})).status, 201);
  const items = (await call(path + '/items?pageSize=100', staff.cookie)).data.items;
  assert.equal(items.find(r => r.copyId === copies[3].id).result, 'moved');
  assert.equal(items.find(r => r.copyId === copies[4].id).result, 'on_loan');
  assert.equal((await db.copy.findUnique({ where: { id: copies[4].id } })).status, 'on_loan');
  assert.equal((await call(path + '/scan', staff.cookie, { code: copies[4].code, locationId: shelf.id })).status, 409);
  const unexpected = await db.copy.create({ data: { code: `${suffix}-unexpected`, editionId: edition.id, locationId: elsewhere.id, status: 'available' } });
  assert.equal((await call(path + '/scan', staff.cookie, { code: unexpected.code, locationId: elsewhere.id })).status, 400);
  assert.equal((await call(path + '/scan', staff.cookie, { code: unexpected.code, locationId: shelf.id })).data.result, 'unexpected');
  assert.equal((await call(path, staff.cookie)).data.total, 5);
  const missing = items.filter(r => r.result === 'pending_search');
  assert.equal(missing.length, 2);
  assert.equal(missing[0].scannedLocationId, null);
  assert.equal((await call(path + `/items/${missing[0].id}/lost`, staff.cookie, { note: 'Cán bộ không được tự xác nhận mất' })).status, 403);
  const decisions = await Promise.all([1, 2].map(() => call(path + `/items/${missing[0].id}/lost`, manager.cookie, { note: 'Đã tra soát toàn bộ và xác nhận thất lạc' })));
  assert.deepEqual(decisions.map(r => r.status).sort(), [201, 409]);
  assert.equal((await call(path + `/items/${missing[1].id}/found`, staff.cookie, { locationId: shelf.id, note: 'Đã tìm thấy tại kệ' })).status, 201);
  assert.equal((await db.copy.findUnique({ where: { id: missing[1].copyId } })).status, 'available');
  assert.equal((await call(path + '/close', staff.cookie, {})).status, 201);
  assert.equal((await call(path + '/close', staff.cookie, {})).status, 201);
  assert.equal((await call(path + '/scan', staff.cookie, { code: copies[0].code, locationId: shelf.id })).status, 409);
  assert.ok(await db.inventoryEvent.count({ where: { runId: run.id, actorId: manager.id, action: 'confirmed_lost' } }));
  console.log('PASS inventory: authorization, snapshot, scan, reconcile, lost/found, audit, retries, concurrent requests');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
