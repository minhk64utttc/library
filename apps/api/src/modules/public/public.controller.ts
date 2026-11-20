import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  publicSearchQuerySchema,
  type Paginated,
  type PublicRecordDto,
  type PublicSearchQuery,
} from '@thu-vien/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PublicService } from './public.service';

@Controller('public/records')
export class PublicController {
  constructor(private readonly records: PublicService) {}

  @Get()
  search(
    @Query(new ZodValidationPipe(publicSearchQuerySchema)) query: PublicSearchQuery,
  ): Promise<Paginated<PublicRecordDto>> {
    return this.records.search(query);
  }

  @Get('facets')
  facets() {
    return this.records.facets();
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<PublicRecordDto> {
    return this.records.detail(id);
  }
}
