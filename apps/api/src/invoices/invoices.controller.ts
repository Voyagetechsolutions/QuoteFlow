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
  InvoicesService,
  CreateInvoiceFromQuoteDto,
  UpdateInvoiceDto,
  CreateInvoiceLineDto,
  UpdateInvoiceLineDto,
} from './invoices.service';
import { PdfService } from '../pdf/pdf.service';
import { documentHtml } from '../pdf/templates';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyId } from '../auth/current-user.decorator';

@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly pdf: PdfService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {}

  /** Render an invoice to a branded PDF buffer. */
  private async renderPdf(companyId: string, id: string) {
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
      { name: company?.name ?? 'QuoteFlow', logo: company?.logo },
    );
    return { buffer: await this.pdf.render(html), inv, company };
  }

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
    const { buffer, inv } = await this.renderPdf(companyId, id);
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${inv.number}.pdf"`,
      })
      .send(buffer);
  }

  /** Email the invoice PDF to the customer and mark it SENT. */
  @Post(':id/send')
  async send(@CompanyId() companyId: string, @Param('id') id: string) {
    const { buffer, inv, company } = await this.renderPdf(companyId, id);
    const to = inv.customer?.email;
    if (!to) {
      throw new BadRequestException('Customer has no email address on file.');
    }
    const result = await this.mail.sendDocument({
      to,
      subject: `Invoice ${inv.number} from ${company?.name ?? 'QuoteFlow'}`,
      text: `Dear ${inv.customer.name},\n\nPlease find attached invoice ${inv.number}.\n\nRegards,\n${company?.name ?? 'QuoteFlow'}`,
      filename: `${inv.number}.pdf`,
      pdf: buffer,
    });
    if (inv.status === 'DRAFT') {
      await this.invoicesService.updateStatus(companyId, id, 'SENT');
    }
    return result;
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

  @Patch(':id')
  update(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body() body: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(companyId, id, body);
  }

  @Post(':id/lines')
  addLine(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body() body: CreateInvoiceLineDto,
  ) {
    return this.invoicesService.addLine(companyId, id, body);
  }

  @Patch(':id/lines/:lineId')
  updateLine(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: UpdateInvoiceLineDto,
  ) {
    return this.invoicesService.updateLine(companyId, id, lineId, body);
  }

  @Delete(':id/lines/:lineId')
  deleteLine(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.invoicesService.deleteLine(companyId, id, lineId);
  }

  @Delete(':id')
  delete(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.invoicesService.delete(companyId, id);
  }
}
