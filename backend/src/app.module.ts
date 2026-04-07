import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor'
import { TraceIdMiddleware } from './common/middleware/trace-id.middleware'
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module'
import { AuditModule } from './modules/audit/audit.module'
import { AuthModule } from './modules/auth/auth.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { FundModule } from './modules/fund/fund.module'
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module'
import { MarketModule } from './modules/market/market.module'
import { PaymentModule } from './modules/payment/payment.module'
import { ReportModule } from './modules/report/report.module'
import { RiskModule } from './modules/risk/risk.module'
import { SystemModule } from './modules/system/system.module'
import { TradeModule } from './modules/trade/trade.module'
import { UserModule } from './modules/user/user.module'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AdminAuthModule,
    SystemModule,
    AuthModule,
    UserModule,
    FundModule,
    TradeModule,
    PaymentModule,
    MarketModule,
    DashboardModule,
    RiskModule,
    AuditModule,
    ReportModule,
    LeaderboardModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceIdMiddleware).forRoutes('*')
  }
}
