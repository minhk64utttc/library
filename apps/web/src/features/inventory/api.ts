import type { InventoryCreate, InventoryScan, InventoryFound, InventoryDecision, InventoryItemDto, InventoryResult, InventoryRunDto, LocationDto, Paginated } from '@thu-vien/shared';
import { apiFetch } from '@/shared/api/client';

const post = <T>(path: string, body?: unknown): Promise<T> => apiFetch<T>(path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
export const listRuns = (page: number) => apiFetch<Paginated<InventoryRunDto>>(`/inventory?page=${page}&pageSize=20`);
export const getRun = (id: string) => apiFetch<InventoryRunDto>(`/inventory/${id}`);
export const createRun = (input: InventoryCreate) => post<InventoryRunDto>('/inventory', input);
export const scan = (id: string, input: InventoryScan) => post<InventoryItemDto>(`/inventory/${id}/scan`, input);
export const reconcile = (id: string) => post<InventoryRunDto>(`/inventory/${id}/reconcile`);
export const closeRun = (id: string) => post<InventoryRunDto>(`/inventory/${id}/close`);
export const found = (id: string, itemId: string, input: InventoryFound) => post<InventoryItemDto>(`/inventory/${id}/items/${itemId}/found`, input);
export const lost = (id: string, itemId: string, input: InventoryDecision) => post<InventoryItemDto>(`/inventory/${id}/items/${itemId}/lost`, input);
export function listItems(id: string, page: number, result?: InventoryResult) {
  const query = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (result) query.set('result', result);
  return apiFetch<Paginated<InventoryItemDto>>(`/inventory/${id}/items?${query}`);
}
export async function locations(): Promise<LocationDto[]> {
  const rows: LocationDto[] = [];
  for (let page = 1; ; page += 1) {
    const result = await apiFetch<Paginated<LocationDto>>(`/holdings/locations?page=${page}&pageSize=100`);
    rows.push(...result.items);
    if (rows.length >= result.total || !result.items.length) return rows;
  }
}
