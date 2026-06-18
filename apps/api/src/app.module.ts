import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { PdfModule } from "./pdf/pdf.module";
import { HealthController } from "./health/health.controller";
import { RateSetsModule } from "./rate-sets/rate-sets.module";
import { CustomersModule } from "./customers/customers.module";
import { QuotesModule } from "./quotes/quotes.module";
import { InvoicesModule } from "./invoices/invoices.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PdfModule,
    RateSetsModule,
    CustomersModule,
    QuotesModule,
    InvoicesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
