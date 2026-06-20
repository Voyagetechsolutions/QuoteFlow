import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { PdfModule } from "./pdf/pdf.module";
import { MailModule } from "./mail/mail.module";
import { AuthModule } from "./auth/auth.module";
import { AuthGuard } from "./auth/auth.guard";
import { CompanyModule } from "./company/company.module";
import { HealthController } from "./health/health.controller";
import { RateSetsModule } from "./rate-sets/rate-sets.module";
import { CustomersModule } from "./customers/customers.module";
import { QuotesModule } from "./quotes/quotes.module";
import { InvoicesModule } from "./invoices/invoices.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting: 100 requests / minute per IP by default. Auth routes are
    // throttled harder via @Throttle on the controller (brute-force defence).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    PdfModule,
    MailModule,
    AuthModule,
    CompanyModule,
    RateSetsModule,
    CustomersModule,
    QuotesModule,
    InvoicesModule,
  ],
  controllers: [HealthController],
  providers: [
    // Throttler first so rate limiting applies before auth work.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
