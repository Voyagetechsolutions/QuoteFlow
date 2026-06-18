import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import {
  QuotesService,
  CreateQuoteDto,
  UpdateQuoteDto,
  CreateQuoteLineDto,
  UpdateQuoteLineDto,
} from './quotes.service';

// TODO: companyId will come from auth JWT once auth is implemented
const DEMO_COMPANY_ID = 'demo-company-001';

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  create(@Body() body: CreateQuoteDto) {
    return this.quotesService.create(DEMO_COMPANY_ID, body);
  }

  @Get()
  findAll() {
    return this.quotesService.findAll(DEMO_COMPANY_ID);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quotesService.findOne(DEMO_COMPANY_ID, id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateQuoteDto) {
    return this.quotesService.update(DEMO_COMPANY_ID, id, body);
  }

  @Post(':id/lines')
  addLine(@Param('id') id: string, @Body() body: CreateQuoteLineDto) {
    return this.quotesService.addLine(DEMO_COMPANY_ID, id, body);
  }

  @Patch(':id/lines/:lineId')
  updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: UpdateQuoteLineDto,
  ) {
    return this.quotesService.updateLine(DEMO_COMPANY_ID, id, lineId, body);
  }

  @Delete(':id/lines/:lineId')
  deleteLine(@Param('id') id: string, @Param('lineId') lineId: string) {
    return this.quotesService.deleteLine(DEMO_COMPANY_ID, id, lineId);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.quotesService.delete(DEMO_COMPANY_ID, id);
  }
}
