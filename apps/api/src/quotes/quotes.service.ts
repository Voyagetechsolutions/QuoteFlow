import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/* ------------------------------------------------------------------ */
/*  DTOs                                                               */
/* ------------------------------------------------------------------ */

export interface CreateQuoteLineDto {
  description: string;
  chargeType?: string;
  unit?: string;
  costRate: number;
  sellRate: number;
  marginPct: number;
  currency: string;
}

export interface CreateQuoteDto {
  customerId: string;
  currency?: string;
  defaultMarginPct?: number;
  lines: CreateQuoteLineDto[];
}

export interface UpdateQuoteDto {
  status?: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
  currency?: string;
  defaultMarginPct?: number;
}

export interface UpdateQuoteLineDto {
  description?: string;
  chargeType?: string | null;
  unit?: string | null;
  costRate?: number;
  sellRate?: number;
  marginPct?: number;
  currency?: string;
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  /** Convert Prisma Decimal → plain number for JSON. */
  private toNum(v: any): number {
    return v instanceof Prisma.Decimal ? v.toNumber() : Number(v);
  }

  private serialiseLine(line: Record<string, any>): Record<string, any> {
    return {
      ...line,
      costRate: this.toNum(line.costRate),
      sellRate: this.toNum(line.sellRate),
      marginPct: this.toNum(line.marginPct),
    };
  }

  private serialiseQuote(q: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {
      ...q,
      defaultMarginPct: this.toNum(q.defaultMarginPct),
    };
    if (Array.isArray(result.lines)) {
      result.lines = result.lines.map((l: Record<string, any>) =>
        this.serialiseLine(l),
      );
    }
    return result;
  }

  /**
   * Generate a quote number: QF-YYYYMMDD-NNN
   * NNN is the sequential count of quotes for this company today.
   */
  private async generateQuoteNumber(companyId: string): Promise<string> {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    const prefix = `QF-${dateStr}-`;

    const count = await this.prisma.quote.count({
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

  /** Create a quote with its lines. */
  async create(companyId: string, data: CreateQuoteDto) {
    const number = await this.generateQuoteNumber(companyId);

    const quote = await this.prisma.quote.create({
      data: {
        companyId,
        customerId: data.customerId,
        number,
        currency: data.currency ?? 'USD',
        defaultMarginPct: data.defaultMarginPct != null
          ? new Prisma.Decimal(data.defaultMarginPct)
          : new Prisma.Decimal(0),
        lines: {
          create: data.lines.map((l) => ({
            description: l.description,
            chargeType: l.chargeType ?? null,
            unit: l.unit ?? null,
            costRate: new Prisma.Decimal(l.costRate),
            sellRate: new Prisma.Decimal(l.sellRate),
            marginPct: new Prisma.Decimal(l.marginPct),
            currency: l.currency,
          })),
        },
      },
      include: { lines: true, customer: true },
    });

    return this.serialiseQuote(quote);
  }

  /** List quotes for a company with customer name, line count, and total. */
  async findAll(companyId: string) {
    const quotes = await this.prisma.quote.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true } },
        lines: { select: { sellRate: true } },
        _count: { select: { lines: true } },
      },
    });

    return quotes.map((q) => ({
      id: q.id,
      companyId: q.companyId,
      customerId: q.customerId,
      customerName: q.customer.name,
      number: q.number,
      status: q.status,
      currency: q.currency,
      defaultMarginPct: this.toNum(q.defaultMarginPct),
      createdAt: q.createdAt,
      lineCount: q._count.lines,
      total: q.lines.reduce(
        (sum, l) => sum + this.toNum(l.sellRate),
        0,
      ),
    }));
  }

  /** Get one quote with lines and customer. */
  async findOne(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId },
      include: {
        lines: { orderBy: { id: 'asc' } },
        customer: true,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${id} not found`);
    }

    return this.serialiseQuote(quote);
  }

  /** Update quote header (status, currency, margin). */
  async update(companyId: string, id: string, data: UpdateQuoteDto) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${id} not found`);
    }

    const updateData: Record<string, any> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.defaultMarginPct !== undefined)
      updateData.defaultMarginPct = new Prisma.Decimal(data.defaultMarginPct);

    const updated = await this.prisma.quote.update({
      where: { id },
      data: updateData,
      include: { lines: true, customer: true },
    });

    return this.serialiseQuote(updated);
  }

  /** Update a single quote line. */
  async updateLine(
    companyId: string,
    quoteId: string,
    lineId: string,
    data: UpdateQuoteLineDto,
  ) {
    // Verify quote belongs to company
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, companyId },
    });
    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    // Verify line belongs to quote
    const existing = await this.prisma.quoteLine.findFirst({
      where: { id: lineId, quoteId },
    });
    if (!existing) {
      throw new NotFoundException(
        `QuoteLine ${lineId} not found in Quote ${quoteId}`,
      );
    }

    const updateData: Record<string, any> = {};
    if (data.description !== undefined) updateData.description = data.description;
    if (data.chargeType !== undefined) updateData.chargeType = data.chargeType;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.costRate !== undefined)
      updateData.costRate = new Prisma.Decimal(data.costRate);
    if (data.sellRate !== undefined)
      updateData.sellRate = new Prisma.Decimal(data.sellRate);
    if (data.marginPct !== undefined)
      updateData.marginPct = new Prisma.Decimal(data.marginPct);
    if (data.currency !== undefined) updateData.currency = data.currency;

    const updated = await this.prisma.quoteLine.update({
      where: { id: lineId },
      data: updateData,
    });

    return this.serialiseLine(updated);
  }

  /** Add a new line to an existing quote. */
  async addLine(companyId: string, quoteId: string, data: CreateQuoteLineDto) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, companyId },
    });
    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    const line = await this.prisma.quoteLine.create({
      data: {
        quoteId,
        description: data.description,
        chargeType: data.chargeType ?? null,
        unit: data.unit ?? null,
        costRate: new Prisma.Decimal(data.costRate),
        sellRate: new Prisma.Decimal(data.sellRate),
        marginPct: new Prisma.Decimal(data.marginPct),
        currency: data.currency,
      },
    });

    return this.serialiseLine(line);
  }

  /** Delete a single line from a quote. */
  async deleteLine(companyId: string, quoteId: string, lineId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, companyId },
    });
    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    const existing = await this.prisma.quoteLine.findFirst({
      where: { id: lineId, quoteId },
    });
    if (!existing) {
      throw new NotFoundException(
        `QuoteLine ${lineId} not found in Quote ${quoteId}`,
      );
    }

    await this.prisma.quoteLine.delete({ where: { id: lineId } });

    return { deleted: true };
  }

  /** Delete a quote and all its lines (cascade). */
  async delete(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${id} not found`);
    }

    await this.prisma.quote.delete({ where: { id } });

    return { deleted: true };
  }
}
