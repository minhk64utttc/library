import { describe, expect, it } from 'vitest';
import { recordListQuerySchema, recordRejectSchema } from './catalog.schema';

describe('catalog query validation', () => {
  it('parses URL values and keeps staff view filters', () => {
    expect(recordListQuerySchema.parse({ page: '2', pageSize: '10', status: 'draft', rejected: 'true', q: '  ISBN  ', sort: 'title' }))
      .toEqual({ page: 2, pageSize: 10, status: 'draft', rejected: 'true', q: 'ISBN', sort: 'title' });
  });
  it('rejects unsafe sort names, oversized pages and unknown workflow states', () => {
    for (const input of [{ sort: 'passwordHash' }, { pageSize: 101 }, { page: 0 }, { status: 'deleted' }, { rejected: 'yes' }, { q: 'a'.repeat(201) }]) {
      expect(recordListQuerySchema.safeParse(input).success).toBe(false);
    }
  });
  it('requires a meaningful reason when returning a record for changes', () => {
    expect(recordRejectSchema.safeParse({ reason: '   ' }).success).toBe(false);
    expect(recordRejectSchema.parse({ reason: '  Bổ sung năm xuất bản  ' }).reason).toBe('Bổ sung năm xuất bản');
  });
});
