// Isolated PostgreSQL integration check for fine payments and incident images.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { hash } = require('@node-rs/argon2');
const sharp = require('sharp');

const root = resolve(__dirname, '../../..');
const configured = process.env.DATABASE_URL || readFileSync(resolve(root, '.env'), 'utf8').match(/^DATABASE_URL=["']?([^\r\n"']+)/m)?.[1];
assert.ok(configured, 'DATABASE_URL is required');
const database = new URL(configured);
const schema = `fine_incident_test_${Date.now()}`;
database.searchParams.set('schema', schema);
const storageRoot = join(tmpdir(), `thu-vien-${schema}`);
const port = String(3200 + Math.floor(Math.random() * 1000));
const env = { ...process.env, DATABASE_URL: database.toString(), DOCUMENT_STORAGE_PATH: storageRoot, NODE_ENV: 'test', PORT: port, SESSION_SECRET: randomUUID(), WEB_ORIGIN: 'http://localhost:5173' };
const migrated = spawnSync(process.execPath, [resolve(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy', '--schema', 'apps/api/prisma/schema.prisma'], { cwd: root, env, encoding: 'utf8' });
assert.equal(migrated.status, 0, migrated.stderr);
const db = new PrismaClient({ datasources: { db: { url: database.toString() } } });
const base = `http://localhost:${port}/api`;
let app;
let appLog = '';

async function jsonCall(path, cookie, body, headers = {}) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json().catch(() => null), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function uploadCall(path, cookie, files) {
  const form = new FormData();
  for (const file of files) form.append('files', new Blob([file.buffer], { type: file.mimeType }), file.name);
  const response = await fetch(base + path, { method: 'POST', headers: { Cookie: cookie }, body: form });
  return { status: response.status, data: await response.json().catch(() => null) };
}

async function main() {
  app = spawn(process.execPath, [resolve(root, 'apps/api/dist/main.js')], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  app.stdout.on('data', data => { appLog += data; });
  app.stderr.on('data', data => { appLog += data; });
  let ready = false;
  for (let retry = 0; retry < 150; retry++) {
    try { if ((await jsonCall('/auth/me')).status === 401) { ready = true; break; } } catch {}
    if (app.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, `API failed to start: ${appLog}`);

  const password = 'FineIncidentTest-Strong!';
  const passwordHash = await hash(password);
  async function account(role) {
    const user = await db.account.create({ data: { email: `${role}-${randomUUID()}@test.local`, passwordHash, roles: { create: { role } }, profile: { create: { fullName: role } } } });
    const login = await jsonCall('/auth/login', null, { email: user.email, password });
    assert.equal(login.status, 200);
    return { ...user, cookie: login.cookie };
  }
  const collector = await account('circulation');
  const reader = await account('reader');
  const work = await db.work.create({ data: { title: 'TEST fine and incident attachments', status: 'published' } });
  const edition = await db.edition.create({ data: { workId: work.id } });
  const loanCopy = await db.copy.create({ data: { code: `TEST-FINE-${randomUUID()}`, editionId: edition.id, status: 'on_loan' } });
  const loan = await db.loan.create({ data: { copyId: loanCopy.id, borrowerId: reader.id, dueAt: new Date(Date.now() + 86400000), loanDays: 14, renewLimit: 1, renewDays: 7, overdueFinePerDay: 5000 } });
  const fine = await db.fine.create({ data: { loanId: loan.id, amount: 10000 } });

  const key = randomUUID();
  const repeated = await Promise.all([
    jsonCall(`/circulation/fines/${fine.id}/pay`, collector.cookie, { amount: 5000 }, { 'Idempotency-Key': key }),
    jsonCall(`/circulation/fines/${fine.id}/pay`, collector.cookie, { amount: 5000 }, { 'Idempotency-Key': key }),
  ]);
  assert.ok(repeated.every(result => result.status === 201), `${JSON.stringify(repeated.map(result => ({ status: result.status, data: result.data })))}\n${appLog}`);
  assert.equal(repeated[0].data.payment.id, repeated[1].data.payment.id);
  assert.equal(await db.finePayment.count({ where: { fineId: fine.id } }), 1);
  assert.equal((await jsonCall(`/circulation/fines/${fine.id}/pay`, collector.cookie, { amount: 4000 }, { 'Idempotency-Key': key })).data.code, 'IDEMPOTENCY_CONFLICT');
  const settled = await jsonCall(`/circulation/fines/${fine.id}/pay`, collector.cookie, { amount: 5000 }, { 'Idempotency-Key': randomUUID() });
  assert.equal(settled.status, 201);
  assert.equal(settled.data.fine.remainingAmount, 0);
  assert.equal(await db.finePayment.count({ where: { fineId: fine.id } }), 2);

  const incidentCopy = await db.copy.create({ data: { code: `TEST-INCIDENT-${randomUUID()}`, editionId: edition.id, status: 'available' } });
  const incident = await jsonCall('/incidents', collector.cookie, { copyId: incidentCopy.id, kind: 'damaged', description: 'TEST attachment report with enough detail' });
  assert.equal(incident.status, 201);
  const png = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#b42318' } }).png().toBuffer();
  const uploaded = await uploadCall(`/incidents/${incident.data.id}/attachments`, collector.cookie, [{ buffer: png, mimeType: 'image/png', name: 'evidence.png' }]);
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.data));
  assert.equal(uploaded.data[0].mimeType, 'image/jpeg');
  const attachment = uploaded.data[0];
  const imageResponse = await fetch(`${base}/incidents/${incident.data.id}/attachments/${attachment.id}`, { headers: { Cookie: collector.cookie } });
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get('content-type'), 'image/jpeg');
  assert.equal(imageResponse.headers.get('x-content-type-options'), 'nosniff');
  const jpeg = Buffer.from(await imageResponse.arrayBuffer());
  assert.deepEqual([...jpeg.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  assert.equal((await jsonCall(`/incidents/${incident.data.id}/attachments/${attachment.id}`, reader.cookie)).status, 403);
  const listed = await jsonCall('/incidents?page=1&pageSize=20', collector.cookie);
  assert.equal(listed.data.items.find(row => row.id === incident.data.id).attachments.length, 1);
  const invalid = await uploadCall(`/incidents/${incident.data.id}/attachments`, collector.cookie, [{ buffer: Buffer.from('not an image'), mimeType: 'text/plain', name: 'evidence.txt' }]);
  assert.equal(invalid.status, 400);
  console.log(`PASS fines/incidents PostgreSQL: idempotent repeated collection, payment conflict, image normalization, authorized private download (${schema})`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (app) app.kill();
  await db.$disconnect();
  if (storageRoot.startsWith(tmpdir())) await rm(storageRoot, { recursive: true, force: true });
});
