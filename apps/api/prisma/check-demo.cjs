const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { createHash } = require('node:crypto');
const { readFile, writeFile } = require('node:fs/promises');
const { resolve, join } = require('node:path');
const prisma = new PrismaClient();
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const id = label => {
  const value = createHash('sha256').update(`thu-vien-rich-demo-v1:${label}`).digest('hex');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-a${value.slice(17, 20)}-${value.slice(20, 32)}`;
};
const models = ['account', 'work', 'edition', 'copy', 'location', 'loan', 'reservation', 'fine', 'incident', 'inventoryRun', 'policy', 'policyVersion'];
async function main() {
  const snapshot = process.argv.indexOf('--snapshot');
  if (snapshot >= 0) {
    const data = [];
    for (const model of [...models, 'profile']) {
      const key = model === 'profile' ? 'accountId' : 'id';
      const rows = await prisma[model].findMany({ orderBy: { [key]: 'asc' } });
      data.push({ model, key, ids: rows.map(row => row[key]), digest: digest(rows) });
    }
    await writeFile(process.argv[snapshot + 1], JSON.stringify(data), { flag: 'wx', mode: 0o600 });
    console.log('PASS captured existing-row fingerprints only; no personal data or passwords exported.');
    return;
  }
  const preserve = process.argv.indexOf('--preserve');
  if (preserve >= 0) {
    const data = JSON.parse(await readFile(process.argv[preserve + 1], 'utf8'));
    for (const entry of data) {
      const rows = await prisma[entry.model].findMany({ where: { [entry.key]: { in: entry.ids } }, orderBy: { [entry.key]: 'asc' } });
      assert.equal(digest(rows), entry.digest, `Existing ${entry.model} rows changed`);
    }
    console.log('PASS all original account/profile/catalog/circulation/policy/inventory rows unchanged.');
  }
  assert.ok(await prisma.auditEvent.findUnique({ where: { id: id('complete') } }), 'Seed completion marker required');
  const workIds = Array.from({ length: 120 }, (_, index) => id(`work-${index}`));
  assert.equal(await prisma.work.count({ where: { id: { in: workIds } } }), 120);
  assert.equal(await prisma.edition.count({ where: { workId: { in: workIds } } }), 150);
  assert.equal(await prisma.copy.count({ where: { edition: { workId: { in: workIds } } } }), 750);
  assert.equal(await prisma.copy.count({ where: { edition: { workId: { in: workIds }, work: { status: { not: 'published' } } } } }), 0);
  const loans = await prisma.loan.findMany({ where: { copy: { edition: { workId: { in: workIds } } } }, include: { copy: { include: { edition: { include: { work: true } } } }, borrower: { include: { libraryCard: true } }, renewals: true } });
  for (const loan of loans) { assert.ok(loan.borrowedAt >= loan.borrower.libraryCard.createdAt); assert.ok(loan.borrowedAt >= loan.copy.edition.work.decidedAt); }
  const active = loans.filter(loan => loan.status === 'active');
  assert.equal(active.length, 132); assert.equal(loans.filter(loan => loan.status === 'returned').length, 64);
  assert.equal(new Set(active.map(loan => loan.copyId)).size, active.length);
  const borrowerCounts = new Map();
  for (const loan of active) {
    assert.equal(loan.copy.status, 'on_loan'); assert.equal(loan.borrower.status, 'active');
    assert.equal(loan.borrower.libraryCard.status, 'active'); assert.ok(loan.borrower.libraryCard.expiresAt > new Date());
    assert.equal(loan.renewCount, loan.renewals.length);
    for (const renewal of loan.renewals) { assert.ok(renewal.createdAt >= loan.borrowedAt && renewal.createdAt <= renewal.previousDueAt); assert.ok(renewal.dueAt > renewal.previousDueAt); }
    borrowerCounts.set(loan.borrowerId, (borrowerCounts.get(loan.borrowerId) || 0) + 1);
  }
  assert.ok([...borrowerCounts.values()].every(count => count <= 5));
  const reservations = await prisma.reservation.findMany({ where: { edition: { workId: { in: workIds } }, status: { in: ['waiting', 'ready_for_pickup'] } }, include: { edition: { include: { copies: true } } } });
  const reservationKeys = new Set();
  for (const reservation of reservations) {
    const key = `${reservation.editionId}:${reservation.borrowerId}`;
    assert.ok(!reservationKeys.has(key)); reservationKeys.add(key);
    assert.ok(!reservation.edition.copies.some(copy => copy.status === 'available'));
    if (reservation.status === 'ready_for_pickup') assert.equal(reservation.edition.copies.filter(copy => copy.status === 'reserved').length, 1);
    assert.ok(!active.some(loan => loan.borrowerId === reservation.borrowerId && loan.copy.editionId === reservation.editionId));
  }
  const fulfilled = await prisma.reservation.findMany({ where: { edition: { workId: { in: workIds } }, status: 'fulfilled' } });
  for (const reservation of fulfilled) assert.ok(loans.some(loan => loan.borrowerId === reservation.borrowerId && loan.copy.editionId === reservation.editionId && loan.borrowedAt >= reservation.readyAt && loan.borrowedAt <= reservation.expiresAt));
  const fines = await prisma.fine.findMany({ where: { loan: { copy: { edition: { workId: { in: workIds } } } } }, include: { payments: true, waiverRequests: true } });
  assert.equal(fines.length, 32);
  for (const fine of fines) {
    const paid = fine.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const waived = fine.waiverRequests.filter(request => request.status === 'approved').reduce((sum, request) => sum + request.approvedAmount, 0);
    const remaining = fine.amount - paid - waived;
    assert.ok(remaining >= 0); assert.equal(fine.status === 'unpaid', remaining > 0);
  }
  const runs = await prisma.inventoryRun.findMany({ where: { id: { in: [0, 1, 2].map(number => id(`inventory-${number}`)) } }, include: { items: true } });
  for (const run of runs) for (const item of run.items) {
    assert.ok(item.snapshotUpdatedAt <= run.createdAt);
    if (item.scannedAt) { assert.equal(item.result, 'matched'); assert.ok(item.scannedAt >= run.createdAt && item.scannedAt <= run.closedAt); }
    if (['on_loan', 'excluded'].includes(item.result)) assert.equal(item.scannedAt, null);
    if (item.snapshotStatus === 'pending_search' && run.closedAt) assert.equal(item.result, 'excluded');
  }
  const digital = await prisma.digitalSubmission.findMany({ where: { submissionCode: { startsWith: 'DEMO-HS-' } }, include: { files: true } });
  assert.equal(digital.length, 24);
  for (const submission of digital) for (const file of submission.files) {
    const buffer = await readFile(join(resolve(process.env.DOCUMENT_STORAGE_PATH || join(process.cwd(), '.private', 'digital')), file.storageKey));
    assert.equal(buffer.length, file.sizeBytes); assert.equal(createHash('sha256').update(buffer).digest('hex'), file.checksumSha256);
    assert.ok(buffer.subarray(0, 5).equals(Buffer.from('%PDF-')));
  }
  console.log('PASS rich demo: counts, copy/loan/card/renewal/queue consistency, fines, inventory chronology and real PDF files.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
