import { BullModule } from '@nestjs/bull'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'

import { envConfig } from './config/env.config'
import { resolveRedisConnectionOptions } from './config/redis.config'
import { DatabaseModule } from './database/database.module'
import { RlsTransactionInterceptor } from './database/rls-transaction.interceptor'
import { AdminModule } from './modules/admin/admin.module'
import { AiExtractionModule } from './modules/ai-extraction/ai-extraction.module'
import { AnalyticsModule } from './modules/analytics/analytics.module'
import { AuditModule } from './modules/audit/audit.module'
import { AuthModule } from './modules/auth/auth.module'
import { BillingModule } from './modules/billing/billing.module'
import { ClientsModule } from './modules/clients/clients.module'
import { ComplianceModule } from './modules/compliance/compliance.module'
import { DocumentProcessorModule } from './modules/document-processor/document-processor.module'
import { DocumentsModule } from './modules/documents/documents.module'
import { ExportGeneratorModule } from './modules/export-generator/export-generator.module'
import { HealthModule } from './modules/health/health.module'
import { PortalModule } from './modules/portal/portal.module'
import { ReminderSchedulerModule } from './modules/reminder-scheduler/reminder-scheduler.module'
import { TaxPlanningModule } from './modules/tax-planning/tax-planning.module'
import { TaxYearsModule } from './modules/tax-years/tax-years.module'

@Module({
  imports: [
    // ── Config ──────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [envConfig],
      // Validate env vars via Zod in validateEnv() on startup — not here
    }),

    // ── Scheduling ───────────────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Queue (BullMQ / Redis) ────────────────────────────────────────────────
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: resolveRedisConnectionOptions(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      }),
    }),

    DatabaseModule,
    AuditModule,

    // ── Feature Modules ───────────────────────────────────────────────────────
    AuthModule,
    ClientsModule,
    DocumentsModule,
    TaxYearsModule,
    TaxPlanningModule,
    ComplianceModule,
    BillingModule,
    PortalModule,
    AnalyticsModule,
    AdminModule,
    DocumentProcessorModule,
    ReminderSchedulerModule,
    AiExtractionModule,
    ExportGeneratorModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RlsTransactionInterceptor,
    },
  ],
})
export class AppModule {}
