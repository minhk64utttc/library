import { z } from 'zod';
import { pageQuerySchema } from './pagination.schema';

export const INVENTORY_RESULTS = ['unchecked', 'matched', 'misplaced', 'on_loan', 'moved', 'changed', 'pending_search', 'found', 'lost', 'excluded', 'unexpected'] as const;
export type InventoryResult = (typeof INVENTORY_RESULTS)[number];
export const inventoryCreateSchema = z.object({ name: z.string().trim().min(3).max(200), locationId: z.string().uuid() });
export const inventoryScanSchema = z.object({ code: z.string().trim().min(1).max(100), locationId: z.string().uuid() });
export const inventoryFoundSchema = z.object({ locationId: z.string().uuid(), note: z.string().trim().min(5).max(1000) });
export const inventoryDecisionSchema = z.object({ note: z.string().trim().min(10).max(1000) });
export const inventoryItemsQuerySchema = pageQuerySchema.extend({ result: z.enum(INVENTORY_RESULTS).optional() });
export type InventoryCreate = z.infer<typeof inventoryCreateSchema>;
export type InventoryScan = z.infer<typeof inventoryScanSchema>;
export type InventoryFound = z.infer<typeof inventoryFoundSchema>;
export type InventoryDecision = z.infer<typeof inventoryDecisionSchema>;
export type InventoryItemsQuery = z.infer<typeof inventoryItemsQuerySchema>;
export interface InventoryRunDto {
  id: string; name: string; locationId: string; locationName: string;
  createdAt: string; closedAt: string | null; total: number;
  counts: Partial<Record<InventoryResult, number>>;
}
export interface InventoryItemDto {
  inSnapshot: boolean;
  id: string; copyId: string; code: string; title: string;
  expectedLocationId: string | null; scannedLocationId: string | null;
  snapshotStatus: string; currentStatus: string; result: InventoryResult;
  scannedAt: string | null; note: string | null;
}
