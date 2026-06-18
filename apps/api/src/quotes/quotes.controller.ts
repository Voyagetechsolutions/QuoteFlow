import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  QuotesService,
  CreateQuoteDto,
  UpdateQuoteDto,
  CreateQuoteLineDto,
  UpdateQuoteLineDto,
} from './quotes.service';
import { PdfService } from '../pdf/pdf.service';
import { documentHtml } from '../pdf/templates';
import { PrismaService } from '../prisma/prisma.service';

// TODO: companyId will come from auth JWT once auth is implemented
const DEMO_COMPANY_ID = 'demo-company-001';

@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly pdf: PdfService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  create(@Body() body: CreateQuoteDto) {
    return this.quotesService.create(DEMO_COMPANY_ID, body);
  }

  /** Branded customer-facing PDF (sell prices only — no cost/margin). */
  @Get(':id/pdf')
  async downloadPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const quote: any = await this.quotesService.findOne(DEMO_COMPANY_ID, id);
    const company = await this.prisma.company.findUnique({
      where: { id: DEMO_COMPANY_ID },
    });
    const html = documentHtml(
      {
        kind: 'QUOTATION',
        number: quote.number,
        status: quote.status,
        createdAt: quote.createdAt,
        currency: quote.currency,
        customer: quote.customer,
        lines: quote.lines.map((l: any) => ({
          description: l.description,
          unit: l.unit,
          amount: l.sellRate,
          currency: l.currency,
        })),
        total: quote.totalSell,
      },
      { name: company?.name ?? 'QuoteFlow' },
    );
    const buf = await this.pdf.render(html);
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${quote.number}.pdf"`,
      })
      .send(buf);
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
