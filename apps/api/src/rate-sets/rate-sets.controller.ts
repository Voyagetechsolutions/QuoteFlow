import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RateSetsService, CreateRateSetDto, UpdateRateRowDto } from './rate-sets.service';
import { ExtractionService, UploadedRateSheet } from './extraction.service';

// TODO: companyId will come from auth JWT once auth is implemented
const DEMO_COMPANY_ID = 'demo-company-001';

@Controller('rate-sets')
export class RateSetsController {
  constructor(
    private readonly rateSetsService: RateSetsService,
    private readonly extractionService: ExtractionService,
  ) {}

  /**
   * Stateless extraction: upload a rate sheet, get back the extracted rows for
   * review. Nothing is persisted here — the user reviews/edits, then POST /
   * to save (PRD Flow A: review before save). Needs no database.
   */
  @Post('extract')
  @UseInterceptors(FileInterceptor('file'))
  extract(@UploadedFile() file?: UploadedRateSheet) {
    if (!file) {
      throw new BadRequestException('No file uploaded (form field "file").');
    }
    return this.extractionService.extract(file);
  }

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
