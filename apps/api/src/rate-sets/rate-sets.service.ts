import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/** Shape accepted when creating a RateSet with its rows. */
export interface CreateRateSetDto {
  name: string;
  sourceFilename?: string;
  extractor?: string;
  validFrom?: string; // ISO date
  validTo?: string;   // ISO date
  rows: RateRowInput[];
}

export interface RateRowInput {
  chargeType?: string | null;
  laneOrigin?: string | null;
  laneDestination?: string | null;
  unit?: string | null;
  rate?: number | null;
  currency?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  remark?: string | null;
  chargeCode?: string | null;
  chargeLabel?: string | null;
  basis?: string | null;
  confidence?: number;
  needsReview?: boolean;
  issues?: string[];
  source?: string | null;
}

/** Shape accepted when patching a single RateRow. */
export interface UpdateRateRowDto {
  chargeType?: string | null;
  laneOrigin?: string | null;
  laneDestination?: string | null;
  unit?: string | null;
  rate?: number | null;
  currency?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  remark?: string | null;
  chargeCode?: string | null;
  chargeLabel?: string | null;
  basis?: string | null;
  confidence?: number;
  needsReview?: boolean;
  issues?: string[];
  source?: string | null;
}

@Injectable()
export class RateSetsService {
  constructor(private readonly prisma: PrismaService) {}

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  /** Convert Prisma Decimal fields to plain numbers for JSON serialisation. */
  private serialiseRow(row: Record<string, any>): Record<string, any> {
    return {
      ...row,
      rate: row.rate instanceof Prisma.Decimal ? row.rate.toNumber() : row.rate,
    };
  }

  private serialiseRateSet(rs: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = { ...rs };
    if (Array.isArray(result.rows)) {
      result.rows = result.rows.map((r: Record<string, any>) =>
        this.serialiseRow(r),
      );
    }
    return result;
  }

  /* ------------------------------------------------------------------ */
  /*  CRUD                                                               */
  /* ------------------------------------------------------------------ */

  /** Create a RateSet together with its rows in a single transaction. */
  async create(companyId: string, data: CreateRateSetDto) {
    const rateSet = await this.prisma.rateSet.create({
      data: {
        companyId,
        name: data.name,
        sourceFilename: data.sourceFilename,
        extractor: data.extractor,
        validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
        validTo: data.validTo ? new Date(data.validTo) : undefined,
        rows: {
          create: data.rows.map((r) => ({
            chargeType: r.chargeType ?? null,
            laneOrigin: r.laneOrigin ?? null,
            laneDestination: r.laneDestination ?? null,
            unit: r.unit ?? null,
            rate: r.rate != null ? new Prisma.Decimal(r.rate) : null,
            currency: r.currency ?? null,
            validFrom: r.validFrom ? new Date(r.validFrom) : null,
            validTo: r.validTo ? new Date(r.validTo) : null,
            remark: r.remark ?? null,
            chargeCode: r.chargeCode ?? null,
            chargeLabel: r.chargeLabel ?? null,
            basis: r.basis ?? null,
            confidence: r.confidence ?? 1,
            needsReview: r.needsReview ?? false,
            issues: r.issues ?? [],
            source: r.source ?? null,
          })),
        },
      },
      include: { rows: true },
    });

    return this.serialiseRateSet(rateSet);
  }

  /** List rate sets for a company (summary only – no rows, but include row count). */
  async findAll(companyId: string) {
    const rateSets = await this.prisma.rateSet.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { rows: true } } },
    });

    return rateSets.map((rs) => ({
      id: rs.id,
      companyId: rs.companyId,
      name: rs.name,
      sourceFilename: rs.sourceFilename,
      extractor: rs.extractor,
      validFrom: rs.validFrom,
      validTo: rs.validTo,
      createdAt: rs.createdAt,
      rowCount: rs._count.rows,
    }));
  }

  /** Get a single rate set with all its rows. */
  async findOne(companyId: string, id: string) {
    const rateSet = await this.prisma.rateSet.findFirst({
      where: { id, companyId },
      include: { rows: { orderBy: { createdAt: 'asc' } } },
    });

    if (!rateSet) {
      throw new NotFoundException(`RateSet ${id} not found`);
    }

    return this.serialiseRateSet(rateSet);
  }

  /** Update a single rate row (used by the review-table inline editor). */
  async updateRow(
    companyId: string,
    rateSetId: string,
    rowId: string,
    data: UpdateRateRowDto,
  ) {
    // Verify the rate set belongs to this company
    const rateSet = await this.prisma.rateSet.findFirst({
      where: { id: rateSetId, companyId },
    });
    if (!rateSet) {
      throw new NotFoundException(`RateSet ${rateSetId} not found`);
    }

    // Verify the row belongs to this rate set
    const existingRow = await this.prisma.rateRow.findFirst({
      where: { id: rowId, rateSetId },
    });
    if (!existingRow) {
      throw new NotFoundException(
        `RateRow ${rowId} not found in RateSet ${rateSetId}`,
      );
    }

    const updateData: Record<string, any> = {};
    if (data.chargeType !== undefined) updateData.chargeType = data.chargeType;
    if (data.laneOrigin !== undefined) updateData.laneOrigin = data.laneOrigin;
    if (data.laneDestination !== undefined) updateData.laneDestination = data.laneDestination;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.rate !== undefined)
      updateData.rate =
        data.rate != null ? new Prisma.Decimal(data.rate) : null;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.validFrom !== undefined)
      updateData.validFrom = data.validFrom ? new Date(data.validFrom) : null;
    if (data.validTo !== undefined)
      updateData.validTo = data.validTo ? new Date(data.validTo) : null;
    if (data.remark !== undefined) updateData.remark = data.remark;
    if (data.chargeCode !== undefined) updateData.chargeCode = data.chargeCode;
    if (data.chargeLabel !== undefined) updateData.chargeLabel = data.chargeLabel;
    if (data.basis !== undefined) updateData.basis = data.basis;
    if (data.confidence !== undefined) updateData.confidence = data.confidence;
    if (data.needsReview !== undefined) updateData.needsReview = data.needsReview;
    if (data.issues !== undefined) updateData.issues = data.issues;
    if (data.source !== undefined) updateData.source = data.source;

    const updated = await this.prisma.rateRow.update({
      where: { id: rowId },
      data: updateData,
    });

    return this.serialiseRow(updated);
  }

  /** Delete a rate set and all its rows (cascade). */
  async delete(companyId: string, id: string) {
    const rateSet = await this.prisma.rateSet.findFirst({
      where: { id, companyId },
    });

    if (!rateSet) {
      throw new NotFoundException(`RateSet ${id} not found`);
    }

    await this.prisma.rateSet.delete({ where: { id } });

    return { deleted: true };
  }
}
