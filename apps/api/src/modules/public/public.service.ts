import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Paginated, PublicRecordDto, PublicSearchQuery, PublicSearchFacets, PublicFacetOption } from '@thu-vien/shared';

import { PrismaService } from '../../infrastructure/database/prisma.service';

const PUBLIC_INCLUDE = {
  editions: {
    include: {
      publisher: true,
      copies: { include: { location: true }, orderBy: { code: 'asc' } },
    },
    orderBy: { editionNo: 'asc' },
  },
} as const;

type WorkWithEditions = Prisma.WorkGetPayload<{ include: typeof PUBLIC_INCLUDE }>;

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: PublicSearchQuery): Promise<Paginated<PublicRecordDto>> {
    const { page, pageSize, q, subject, author, language, publisher, yearFrom, yearTo, availableOnly, sort } = query;
    // Parameterized SQL keeps filtering, ranking and pagination in PostgreSQL.
    // translate avoids requiring a database extension for Vietnamese diacritics.
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
    const folded = (column: Prisma.Sql) => Prisma.sql`translate(lower(coalesce(${column}, '')), 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')`;
    const title = folded(Prisma.sql`w."title"`);
    const searchable = folded(Prisma.sql`concat_ws(' ', w."title", w."author", w."subject")`);
    const contains = (column: Prisma.Sql, value: string) => Prisma.sql`position(${normalize(value)} in ${column}) > 0`;
    const conditions: Prisma.Sql[] = [Prisma.sql`w."status" = 'published'`];
    if (q) conditions.push(contains(searchable, q));
    if (subject) conditions.push(contains(folded(Prisma.sql`w."subject"`), subject));
    if (author) conditions.push(contains(folded(Prisma.sql`w."author"`), author));
    const editionConditions: Prisma.Sql[] = [Prisma.sql`e."workId" = w."id"`];
    if (language) editionConditions.push(Prisma.sql`${folded(Prisma.sql`e."language"`)} = ${normalize(language)}`);
    if (publisher) editionConditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "Publisher" p WHERE p."id" = e."publisherId" AND ${folded(Prisma.sql`p."name"`)} = ${normalize(publisher)})`);
    if (yearFrom !== undefined) editionConditions.push(Prisma.sql`e."publishYear" >= ${yearFrom}`);
    if (yearTo !== undefined) editionConditions.push(Prisma.sql`e."publishYear" <= ${yearTo}`);
    if (availableOnly) editionConditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "Copy" c WHERE c."editionId" = e."id" AND c."status" = 'available')`);
    if (editionConditions.length > 1) conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "Edition" e WHERE ${Prisma.join(editionConditions, ' AND ')})`);
    const where = Prisma.join(conditions, ' AND ');
    const availableCount = Prisma.sql`(SELECT count(*) FROM "Copy" c JOIN "Edition" e ON c."editionId" = e."id" WHERE e."workId" = w."id" AND c."status" = 'available')`;
    const order = sort === 'title' ? Prisma.sql`w."title" ASC`
      : sort === 'year' ? Prisma.sql`(SELECT max(e."publishYear") FROM "Edition" e WHERE e."workId" = w."id") DESC NULLS LAST`
      : sort === 'available' ? Prisma.sql`${availableCount} DESC`
      : sort === 'relevance' && q ? Prisma.sql`CASE WHEN ${title} = ${normalize(q)} THEN 0 WHEN position(${normalize(q)} in ${title}) = 1 THEN 1 WHEN position(${normalize(q)} in ${title}) > 0 THEN 2 ELSE 3 END ASC`
      : Prisma.sql`w."updatedAt" DESC`;
    const [ids, counts] = await this.prisma.$transaction([
      this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT w."id" FROM "Work" w WHERE ${where} ORDER BY ${order}, w."id" ASC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`),
      this.prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT count(*) AS total FROM "Work" w WHERE ${where}`),
    ]);
    const rows = await this.prisma.work.findMany({ where: { id: { in: ids.map(row => row.id) }, status: 'published' }, include: PUBLIC_INCLUDE });
    const byId = new Map(rows.map(row => [row.id, row]));
    return { items: ids.flatMap(({ id }) => { const row = byId.get(id); return row ? [this.toDto(row)] : []; }), total: Number(counts[0]?.total ?? 0), page, pageSize };
  }

  async facets(): Promise<PublicSearchFacets> {
    const aggregate = (select: Prisma.Sql) => this.prisma.$queryRaw<{ value: string; count: bigint }[]>(Prisma.sql`
      SELECT value, count(DISTINCT id) AS count FROM (${select}) options
      WHERE value IS NOT NULL AND value <> '' GROUP BY value ORDER BY count DESC, value ASC LIMIT 500`);
    const [subjects, authors, languages, publishers] = await Promise.all([
      aggregate(Prisma.sql`SELECT "id", "subject" AS value FROM "Work" WHERE "status" = 'published'`),
      aggregate(Prisma.sql`SELECT "id", "author" AS value FROM "Work" WHERE "status" = 'published'`),
      aggregate(Prisma.sql`SELECT w."id", e."language" AS value FROM "Work" w JOIN "Edition" e ON e."workId" = w."id" WHERE w."status" = 'published'`),
      aggregate(Prisma.sql`SELECT w."id", p."name" AS value FROM "Work" w JOIN "Edition" e ON e."workId" = w."id" JOIN "Publisher" p ON p."id" = e."publisherId" WHERE w."status" = 'published'`),
    ]);
    const convert = (rows: { value: string; count: bigint }[]): PublicFacetOption[] => rows.map(row => ({ value: row.value, count: Number(row.count) }));
    return { subjects: convert(subjects), authors: convert(authors), languages: convert(languages), publishers: convert(publishers) };
  }

  async detail(id: string): Promise<PublicRecordDto> {
    const row = await this.prisma.work.findFirst({
      where: { id, status: 'published' },
      include: PUBLIC_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Không tìm thấy tài liệu' });
    }
    return this.toDto(row);
  }

  private toDto(row: WorkWithEditions): PublicRecordDto {
    return {
      id: row.id,
      title: row.title,
      author: row.author,
      subject: row.subject,
      classification: row.classification,
      editions: row.editions.map((edition) => ({
        id: edition.id,
        publisherName: edition.publisher?.name ?? null,
        isbn: edition.isbn,
        language: edition.language,
        publishYear: edition.publishYear,
        editionNo: edition.editionNo,
        callNumber: edition.callNumber,
        availableCount: edition.copies.filter((copy) => copy.status === 'available').length,
        totalCount: edition.copies.length,
        copies: edition.copies.map((copy) => ({
          code: copy.code,
          status: copy.status === 'available' ? 'available' : copy.status === 'on_loan' ? 'on_loan' : copy.status === 'reserved' ? 'reserved' : 'other',
          locationName: copy.location?.name ?? null,
        })),
      })),
    };
  }
}
