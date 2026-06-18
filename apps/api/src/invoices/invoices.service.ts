import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/* ------------------------------------------------------------------ */
/*  DTOs                                                               */
/* ------------------------------------------------------------------ */

export interface CreateInvoiceFromQuoteDto {
  quoteId: string;
  dueDate?: string; // ISO date
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  private toNum(v: any): number {
    return v instanceof Prisma.Decimal ? v.toNumber() : Number(v);
  }

  private serialiseLine(line: Record<string, any>): Record<string, any> {
    return {
      ...line,
      amount: this.toNum(line.amount),
    };
  }

  private serialiseInvoice(inv: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = { ...inv };
    if (Array.isArray(result.lines)) {
      result.lines = result.lines.map((l: Record<string, any>) =>
        this.serialiseLine(l),
      );
      // findOne/updateStatus must carry `total` too (web detail renders it).
      result.total = result.lines.reduce(
        (sum: number, l: Record<string, any>) => sum + this.toNum(l.amount),
        0,
      );
    }
    return result;
  }

  /**
   * Generate an invoice number: INV-YYYYMMDD-NNN
   * NNN is the sequential count of invoices for this company today.
   */
  private async generateInvoiceNumber(companyId: string): Promise<string> {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    const prefix = `INV-${dateStr}-`;

    const count = await this.prisma.invoice.count({
      where: {
        companyId,
        number: { startsWith: prefix },
      },
    });

    const seq = String(count + 1).padStart(3, '0');
    return `${prefix}${seq}`;
  }

  /* ---------------------------------------------------------------- */
  /*  CRUD                                                             */
  /* ---------------------------------------------------------------- */

  /**
   * Create an invoice from an accepted quote.
   * - Copies each QuoteLine → InvoiceLine (sellRate → amount)
   * - Sets the quote status to ACCEPTED
   * - Auto-generates an INV-YYYYMMDD-NNN number
   */
  async createFromQuote(companyId: string, data: CreateInvoiceFromQuoteDto) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: data.quoteId, companyId },
      include: { lines: true },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${data.quoteId} not found`);
    }

    const number = await this.generateInvoiceNumber(companyId);

    // Run in a transaction: create invoice + update quote status
    const [invoice] = await this.prisma.$transaction([
      this.prisma.invoice.create({
        data: {
          companyId,
          quoteId: quote.id,
          customerId: quote.customerId,
          number,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          lines: {
            create: quote.lines.map((ql) => ({
              description: ql.description,
              amount: ql.sellRate, // Prisma passes Decimal through directly
              currency: ql.currency,
            })),
          },
        },
        include: { lines: true, customer: true },
      }),
      this.prisma.quote.update({
        where: { id: quote.id },
        data: { status: 'ACCEPTED' },
      }),
    ]);

    return this.serialiseInvoice(invoice);
  }

  /** List invoices with customer info and totals. */
  async findAll(companyId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true } },
        lines: { select: { amount: true } },
        _count: { select: { lines: true } },
      },
    });

    return invoices.map((inv) => ({
      id: inv.id,
      companyId: inv.companyId,
      quoteId: inv.quoteId,
      customerId: inv.customerId,
      customerName: inv.customer.name,
      number: inv.number,
      status: inv.status,
      dueDate: inv.dueDate,
      createdAt: inv.createdAt,
      lineCount: inv._count.lines,
      total: inv.lines.reduce(
        (sum, l) => sum + this.toNum(l.amount),
        0,
      ),
    }));
  }

  /** Get one invoice with lines and customer. */
  async findOne(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      include: {
        lines: { orderBy: { id: 'asc' } },
        customer: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    return this.serialiseInvoice(invoice);
  }

  /** Update invoice status (SENT, PARTIAL, PAID). */
  async updateStatus(
    companyId: string,
    id: string,
    status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID',
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status },
      include: { lines: true, customer: true },
    });

    return this.serialiseInvoice(updated);
  }

  /** Delete an invoice and all its lines (cascade). */
  async delete(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    await this.prisma.invoice.delete({ where: { id } });

    return { deleted: true };
  }
}
