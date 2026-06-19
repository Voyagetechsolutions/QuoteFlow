import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  QuotesService,
  CreateQuoteDto,
  CreateQuoteFromRateSetDto,
  UpdateQuoteDto,
  CreateQuoteLineDto,
  UpdateQuoteLineDto,
} from './quotes.service';
import { PdfService } from '../pdf/pdf.service';
import { documentHtml } from '../pdf/templates';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyId } from '../auth/current-user.decorator';

@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly pdf: PdfService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {}

  /** Render a quote to a branded PDF buffer (sell prices only). */
  private async renderPdf(companyId: string, id: string) {
    const quote: any = await this.quotesService.findOne(companyId, id);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
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
    return { buffer: await this.pdf.render(html), quote, company };
  }

  @Post()
  create(@CompanyId() companyId: string, @Body() body: CreateQuoteDto) {
    return this.quotesService.create(companyId, body);
  }

  /** One-click: generate a priced draft quote from a saved rate set. */
  @Post('from-rate-set')
  createFromRateSet(
    @CompanyId() companyId: string,
    @Body() body: CreateQuoteFromRateSetDto,
  ) {
    return this.quotesService.createFromRateSet(companyId, body);
  }

  /** Branded customer-facing PDF (sell prices only — no cost/margin). */
  @Get(':id/pdf')
  async downloadPdf(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, quote } = await this.renderPdf(companyId, id);
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${quote.number}.pdf"`,
      })
      .send(buffer);
  }

  /** Email the quote PDF to the customer and mark it SENT. */
  @Post(':id/send')
  async send(@CompanyId() companyId: string, @Param('id') id: string) {
    const { buffer, quote, company } = await this.renderPdf(companyId, id);
    const to = quote.customer?.email;
    if (!to) {
      throw new BadRequestException(
        'Customer has no email address on file.',
      );
    }
    const result = await this.mail.sendDocument({
      to,
      subject: `Quotation ${quote.number} from ${company?.name ?? 'QuoteFlow'}`,
      text: `Dear ${quote.customer.name},\n\nPlease find attached quotation ${quote.number}.\n\nRegards,\n${company?.name ?? 'QuoteFlow'}`,
      filename: `${quote.number}.pdf`,
      pdf: buffer,
    });
    await this.quotesService.update(companyId, id, { status: 'SENT' });
    return result;
  }

  @Get()
  findAll(@CompanyId() companyId: string) {
    return this.quotesService.findAll(companyId);
  }

  @Get(':id')
  findOne(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.quotesService.findOne(companyId, id);
  }

  @Patch(':id')
  update(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body() body: UpdateQuoteDto,
  ) {
    return this.quotesService.update(companyId, id, body);
  }

  @Post(':id/lines')
  addLine(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body() body: CreateQuoteLineDto,
  ) {
    return this.quotesService.addLine(companyId, id, body);
  }

  @Patch(':id/lines/:lineId')
  updateLine(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: UpdateQuoteLineDto,
  ) {
    return this.quotesService.updateLine(companyId, id, lineId, body);
  }

  @Delete(':id/lines/:lineId')
  deleteLine(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.quotesService.deleteLine(companyId, id, lineId);
  }

  @Delete(':id')
  delete(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.quotesService.delete(companyId, id);
  }
}
