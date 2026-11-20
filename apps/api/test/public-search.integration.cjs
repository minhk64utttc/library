// Run after migrate deploy with DATABASE_URL pointing at a dedicated public_test_* schema.
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
require('ts-node').register({ project: path.join(__dirname, '../tsconfig.json'), transpileOnly: true });
const { PrismaClient } = require('@prisma/client');
const { PublicService } = require('../src/modules/public/public.service');
const { publicSearchQuerySchema } = require('@thu-vien/shared');
assert.match(new URL(process.env.DATABASE_URL).searchParams.get('schema') || '', /^public_test_/);
const db = new PrismaClient();
const service = new PublicService(db);

async function main() {
  const marker = randomUUID();
  const location = await db.location.create({ data: { code: marker, name: 'Tầng 2 · Kệ B4' } });
  const publisher = await db.publisher.create({ data: { code: marker, name: 'Nhà xuất bản Đại học' } });
  async function work(title, status, year, copyStatus) {
    return db.work.create({ data: { title, author: 'Đặng Thị Hà', subject: marker, status, editions: { create: { language: 'Tiếng Việt', publishYear: year, publisherId: publisher.id, callNumber: 'QA 123', copies: { create: { code: randomUUID(), locationId: location.id, status: copyStatus } } } } } });
  }
  const exact = await work('Toán rời rạc', 'published', 2020, 'available');
  const secondary = await work('Bài tập Toán rời rạc', 'published', 2024, 'on_loan');
  await work('Toán rời rạc chưa công bố', 'draft', 2026, 'available');
  const search = input => service.search(publicSearchQuerySchema.parse({ subject: marker, ...input }));
  let result = await search({ q: 'toan roi rac' });
  assert.equal(result.total, 2);
  assert.equal(result.items[0].id, exact.id, 'exact title ranks before substring');
  result = await search({ author: 'dang thi ha', language: 'tieng viet', publisher: 'nha xuat ban dai hoc', availableOnly: 'true' });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, exact.id);
  assert.equal(result.items[0].editions[0].callNumber, 'QA 123');
  assert.equal(result.items[0].editions[0].copies[0].locationName, location.name);
  assert.ok(result.items[0].editions[0].copies[0].code);
  result = await search({ sort: 'year', pageSize: 1 });
  assert.equal(result.items[0].id, secondary.id);
  const next = await search({ sort: 'year', pageSize: 1, page: 2 });
  assert.equal(next.items[0].id, exact.id);
  assert.equal(next.total, 2);
  assert.equal((await search({ q: "' OR 1=1 --" })).total, 0);
  assert.equal((await search({ availableOnly: 'false' })).total, 2);
  const facets = await service.facets();
  assert.equal(facets.subjects.find(item => item.value === marker).count, 2);
  await assert.rejects(() => service.detail('not-an-id'));
  console.log('PASS public search: Vietnamese folding, published visibility, filters, ranking, pagination, SQL parameters, metadata and facets');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
