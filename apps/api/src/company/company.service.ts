import { Injectable, NotFoundException } from '@nestjs/common';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  vatNumber?: string; // empty string => not VAT-registered

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  vatRate?: number;
}

const PUBLIC_FIELDS = {
  id: true,
  name: true,
  logo: true,
  vatNumber: true,
  vatRate: true,
  createdAt: true,
} as const;

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: PUBLIC_FIELDS,
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  update(companyId: string, data: UpdateCompanyDto) {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.vatNumber !== undefined) patch.vatNumber = data.vatNumber || null;
    if (data.vatRate !== undefined) patch.vatRate = data.vatRate;
    return this.prisma.company.update({
      where: { id: companyId },
      data: patch,
      select: PUBLIC_FIELDS,
    });
  }

  /** Set or clear the logo (a data URL, or null to remove). */
  setLogo(companyId: string, logo: string | null) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: { logo },
      select: PUBLIC_FIELDS,
    });
  }
}
