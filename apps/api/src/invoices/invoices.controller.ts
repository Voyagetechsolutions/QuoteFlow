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
import { InvoicesService, CreateInvoiceFromQuoteDto } from './invoices.service';
import { PdfService } from '../pdf/pdf.service';
import { documentHtml } from '../pdf/templates';
import { PrismaService } from '../prisma/prisma.service';

// TODO: companyId will come from auth JWT once auth is implemented
const DEMO_COMPANY_ID = 'demo-company-001';

@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly pdf: PdfService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('from-quote')
  createFromQuote(@Body() body: CreateInvoiceFromQuoteDto) {
    return this.invoicesService.createFromQuote(DEMO_COMPANY_ID, body);
  }

  /** Branded customer-facing invoice PDF. */
  @Get(':id/pdf')
  async downloadPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const inv: any = await this.invoicesService.findOne(DEMO_COMPANY_ID, id);
    const company = await this.prisma.company.findUnique({
      where: { id: DEMO_COMPANY_ID },
    });
    const currency = inv.lines?.[0]?.currency ?? 'USD';
    const html = documentHtml(
      {
        kind: 'INVOICE',
        number: inv.number,
        status: inv.status,
        createdAt: inv.createdAt,
        dueDate: inv.dueDate,
        currency,
        customer: inv.customer,
        lines: inv.lines.map((l: any) => ({
          description: l.description,
          amount: l.amount,
          currency: l.currency,
        })),
        total: inv.total,
      },
      { name: company?.name ?? 'QuoteFlow' },
    );
    const buf = await this.pdf.render(html);
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${inv.number}.pdf"`,
      })
      .send(buf);
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
