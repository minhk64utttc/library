import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { inventoryCreateSchema, inventoryScanSchema, inventoryFoundSchema, inventoryDecisionSchema, inventoryItemsQuerySchema, pageQuerySchema,
  type InventoryCreate, type InventoryScan, type InventoryFound, type InventoryDecision, type InventoryItemsQuery, type PageQuery } from '@thu-vien/shared';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import type { SessionContext } from '../auth/session.service';
import { InventoryService } from './inventory.service';

const uuid = new ZodValidationPipe(z.string().uuid());

@Controller('inventory')
@UseGuards(AuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermissions('inventory:read')
  list(@Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery) { return this.inventory.list(query); }

  @Get(':id')
  @RequirePermissions('inventory:read')
  detail(@Param('id', uuid) id: string) { return this.inventory.detail(id); }

  @Get(':id/items')
  @RequirePermissions('inventory:read')
  items(@Param('id', uuid) id: string, @Query(new ZodValidationPipe(inventoryItemsQuerySchema)) query: InventoryItemsQuery) { return this.inventory.items(id, query); }

  @Post()
  @RequirePermissions('inventory:manage')
  create(@Body(new ZodValidationPipe(inventoryCreateSchema)) body: InventoryCreate, @CurrentSession() session: SessionContext) { return this.inventory.create(body, session.accountId); }

  @Post(':id/scan')
  @RequirePermissions('inventory:manage')
  scan(@Param('id', uuid) id: string, @Body(new ZodValidationPipe(inventoryScanSchema)) body: InventoryScan, @CurrentSession() session: SessionContext) { return this.inventory.scan(id, body, session.accountId); }

  @Post(':id/reconcile')
  @RequirePermissions('inventory:manage')
  reconcile(@Param('id', uuid) id: string, @CurrentSession() session: SessionContext) { return this.inventory.reconcile(id, session.accountId); }

  @Post(':id/items/:itemId/found')
  @RequirePermissions('inventory:manage')
  found(@Param('id', uuid) id: string, @Param('itemId', uuid) itemId: string, @Body(new ZodValidationPipe(inventoryFoundSchema)) body: InventoryFound, @CurrentSession() session: SessionContext) { return this.inventory.found(id, itemId, body, session.accountId); }

  @Post(':id/items/:itemId/lost')
  @RequirePermissions('inventory:decide')
  lost(@Param('id', uuid) id: string, @Param('itemId', uuid) itemId: string, @Body(new ZodValidationPipe(inventoryDecisionSchema)) body: InventoryDecision, @CurrentSession() session: SessionContext) { return this.inventory.confirmLost(id, itemId, body, session.accountId); }

  @Post(':id/close')
  @RequirePermissions('inventory:manage')
  close(@Param('id', uuid) id: string, @CurrentSession() session: SessionContext) { return this.inventory.close(id, session.accountId); }
}
