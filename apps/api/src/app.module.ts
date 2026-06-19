import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { PdfModule } from "./pdf/pdf.module";
import { MailModule } from "./mail/mail.module";
import { AuthModule } from "./auth/auth.module";
import { AuthGuard } from "./auth/auth.guard";
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
    MailModule,
    AuthModule,
    RateSetsModule,
    CustomersModule,
    QuotesModule,
    InvoicesModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
