import { Injectable, NotFoundException } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

export class UpdateCompanyDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

const PUBLIC_FIELDS = {
  id: true,
  name: true,
  logo: true,
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

  updateName(companyId: string, name: string) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: { name },
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
