import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { InvoicesService, CreateInvoiceFromQuoteDto } from './invoices.service';

// TODO: companyId will come from auth JWT once auth is implemented
const DEMO_COMPANY_ID = 'demo-company-001';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('from-quote')
  createFromQuote(@Body() body: CreateInvoiceFromQuoteDto) {
    return this.invoicesService.createFromQuote(DEMO_COMPANY_ID, body);
  }

  @Get()
  findAll() {
    return this.invoicesService.findAll(DEMO_COMPANY_ID);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(DEMO_COMPANY_ID, id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID',
  ) {
    return this.invoicesService.updateStatus(DEMO_COMPANY_ID, id, status);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.invoicesService.delete(DEMO_COMPANY_ID, id);
  }
}
