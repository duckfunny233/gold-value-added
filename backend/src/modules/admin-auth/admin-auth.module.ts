import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { AdminAuthController } from './admin-auth.controller'
import { AdminAuthService } from './admin-auth.service'
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard'
import { AdminJwtStrategy } from './admin-jwt.strategy'
import { AdminPermissionGuard } from './admin-permission.guard'
import { AdminSecurityController } from './admin-security.controller'
import { AdminSecurityService } from './admin-security.service'

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'change-me',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '7d') as any,
        },
      }),
    }),
  ],
  controllers: [AdminAuthController, AdminSecurityController],
  providers: [
    AdminAuthService,
    AdminSecurityService,
    AdminJwtStrategy,
    AdminJwtAuthGuard,
    AdminPermissionGuard,
  ],
  exports: [AdminJwtAuthGuard, AdminPermissionGuard],
})
export class AdminAuthModule {}
