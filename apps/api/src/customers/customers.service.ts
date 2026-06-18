import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateCustomerDto {
  name: string;
  email?: string;
  contact?: string;
}

export interface UpdateCustomerDto {
  name?: string;
  email?: string | null;
  contact?: string | null;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a new customer for this company. */
  async create(companyId: string, data: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        companyId,
        name: data.name,
        email: data.email ?? null,
        contact: data.contact ?? null,
      },
    });
  }

  /** List all customers for a company. */
  async findAll(companyId: string) {
    return this.prisma.customer.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Get a single customer by id. */
  async findOne(companyId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    return customer;
  }

  /** Update a customer. */
  async update(companyId: string, id: string, data: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    return this.prisma.customer.update({
      where: { id },
      data,
    });
  }

  /** Delete a customer. */
  async delete(companyId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    await this.prisma.customer.delete({ where: { id } });

    return { deleted: true };
  }
}
