import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { RateSetsService, CreateRateSetDto, UpdateRateRowDto } from './rate-sets.service';

// TODO: companyId will come from auth JWT once auth is implemented
const DEMO_COMPANY_ID = 'demo-company-001';

@Controller('rate-sets')
export class RateSetsController {
  constructor(private readonly rateSetsService: RateSetsService) {}

  @Post()
  create(@Body() body: CreateRateSetDto) {
    return this.rateSetsService.create(DEMO_COMPANY_ID, body);
  }

  @Get()
  findAll() {
    return this.rateSetsService.findAll(DEMO_COMPANY_ID);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rateSetsService.findOne(DEMO_COMPANY_ID, id);
  }

  @Patch(':id/rows/:rowId')
  updateRow(
    @Param('id') id: string,
    @Param('rowId') rowId: string,
    @Body() body: UpdateRateRowDto,
  ) {
    return this.rateSetsService.updateRow(DEMO_COMPANY_ID, id, rowId, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.rateSetsService.delete(DEMO_COMPANY_ID, id);
  }
}
