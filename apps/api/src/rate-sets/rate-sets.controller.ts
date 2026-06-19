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
import { CompanyId } from '../auth/current-user.decorator';

@Controller('rate-sets')
export class RateSetsController {
  constructor(
    private readonly rateSetsService: RateSetsService,
    private readonly extractionService: ExtractionService,
  ) {}

  /**
   * Stateless extraction: upload a rate sheet, get back the extracted rows for
   * review. Nothing is persisted here — the user reviews/edits, then POST /
   * to save (PRD Flow A: review before save). Needs no database, but auth'd —
   * it runs compute (and potentially paid vision calls).
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
  create(@CompanyId() companyId: string, @Body() body: CreateRateSetDto) {
    return this.rateSetsService.create(companyId, body);
  }

  @Get()
  findAll(@CompanyId() companyId: string) {
    return this.rateSetsService.findAll(companyId);
  }

  @Get(':id')
  findOne(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.rateSetsService.findOne(companyId, id);
  }

  @Patch(':id/rows/:rowId')
  updateRow(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Param('rowId') rowId: string,
    @Body() body: UpdateRateRowDto,
  ) {
    return this.rateSetsService.updateRow(companyId, id, rowId, body);
  }

  @Delete(':id')
  delete(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.rateSetsService.delete(companyId, id);
  }
}
