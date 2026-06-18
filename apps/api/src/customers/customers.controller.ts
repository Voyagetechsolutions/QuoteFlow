import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { CustomersService, CreateCustomerDto, UpdateCustomerDto } from './customers.service';

// TODO: companyId will come from auth JWT once auth is implemented
const DEMO_COMPANY_ID = 'demo-company-001';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(@Body() body: CreateCustomerDto) {
    return this.customersService.create(DEMO_COMPANY_ID, body);
  }

  @Get()
  findAll() {
    return this.customersService.findAll(DEMO_COMPANY_ID);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(DEMO_COMPANY_ID, id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.customersService.update(DEMO_COMPANY_ID, id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.customersService.delete(DEMO_COMPANY_ID, id);
  }
}
