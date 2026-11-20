import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  locationInputSchema,
  pageQuerySchema,
  type LocationDto,
  type LocationInput,
  type PageQuery,
  type Paginated,
} from '@thu-vien/shared';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { LocationsService } from './locations.service';

@Controller('holdings/locations')
@UseGuards(AuthGuard, PermissionsGuard)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @RequirePermissions('catalog:read')
  list(
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ): Promise<Paginated<LocationDto>> {
    return this.locations.list(query);
  }

  @Post()
  @RequirePermissions('holdings:manage')
  create(
    @Body(new ZodValidationPipe(locationInputSchema)) body: LocationInput,
  ): Promise<LocationDto> {
    return this.locations.create(body);
  }
}
