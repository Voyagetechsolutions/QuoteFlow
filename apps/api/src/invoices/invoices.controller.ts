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
import { CompanyId } from '../auth/current-user.decorator';

@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly pdf: PdfService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('from-quote')
  createFromQuote(
    @CompanyId() companyId: string,
    @Body() body: CreateInvoiceFromQuoteDto,
  ) {
    return this.invoicesService.createFromQuote(companyId, body);
  }

  /** Branded customer-facing invoice PDF. */
  @Get(':id/pdf')
  async downloadPdf(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const inv: any = await this.invoicesService.findOne(companyId, id);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
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
  findAll(@CompanyId() companyId: string) {
    return this.invoicesService.findAll(companyId);
  }

  @Get(':id')
  findOne(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.invoicesService.findOne(companyId, id);
  }

  @Patch(':id/status')
  updateStatus(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body('status') status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID',
  ) {
    return this.invoicesService.updateStatus(companyId, id, status);
  }

  @Delete(':id')
  delete(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.invoicesService.delete(companyId, id);
  }
}
