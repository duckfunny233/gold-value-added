import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { IsOptional, IsString } from 'class-validator'
import { randomUUID } from 'crypto'
import { sha256 } from '../../common/utils/hash.util'
import { PrismaService } from '../../prisma/prisma.service'
import { AdminSecurityController } from './admin-security.controller'
import { AdminPermissionGuard } from './admin-permission.guard'
import { AdminSecurityService } from './admin-security.service'
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard'
import { AdminJwtStrategy } from './admin-jwt.strategy'

class AdminLoginDto {
  @ApiProperty()
  @IsString()
  username!: string

  @ApiProperty()
  @IsString()
  password!: string
}

class AdminProfileQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string
}

@Injectable()
class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(payload: AdminLoginDto) {
    const adminUser = await this.prisma.adminUser.findUnique({
      where: {
        username: payload.username,
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!adminUser) {
      throw new NotFoundException('管理员不存在')
    }

    if (adminUser.passwordHash !== sha256(payload.password)) {
      throw new UnauthorizedException('管理员账号或密码错误')
    }

    const roleCodes = adminUser.roles.map((item) => item.role.code)
    const permissionCodes = Array.from(
      new Set(
        adminUser.roles.flatMap((item) =>
          item.role.permissions.map((permissionItem) => permissionItem.permission.code),
        ),
      ),
    )
    const token = await this.jwtService.signAsync({
      sub: adminUser.id,
      username: adminUser.username,
      roleCodes,
      permissionCodes,
    })

    await this.prisma.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: {
          id: adminUser.id,
        },
        data: {
          lastLoginAt: new Date(),
        },
      })

      await tx.adminOperationLog.create({
        data: {
          adminUserId: adminUser.id,
          module: 'admin-auth',
          action: 'login',
          traceId: randomUUID(),
          payload: {
            username: adminUser.username,
            roleCodes,
          },
        },
      })
    })

    return {
      message: '后台登录成功',
      data: {
        token,
        adminUser: {
          username: adminUser.username,
          displayName: adminUser.displayName,
          status: adminUser.status,
          roleCodes,
          permissionCodes,
        },
      },
    }
  }

  async getProfile(query: AdminProfileQueryDto, currentAdminUsername?: string) {
    const username = query.username || currentAdminUsername || 'admin'
    const adminUser = await this.prisma.adminUser.findUnique({
      where: {
        username,
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!adminUser) {
      throw new NotFoundException('管理员不存在')
    }

    return {
      username: adminUser.username,
      displayName: adminUser.displayName,
      status: adminUser.status,
      lastLoginAt: adminUser.lastLoginAt,
      roles: adminUser.roles.map((item) => ({
        code: item.role.code,
        name: item.role.name,
      })),
      permissions: Array.from(
        new Set(
          adminUser.roles.flatMap((item) =>
            item.role.permissions.map((permissionItem) => permissionItem.permission.code),
          ),
        ),
      ),
    }
  }
}

@ApiTags('AdminAuth')
@Controller('admin/auth')
class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: AdminLoginDto) {
    return this.adminAuthService.login(body)
  }

  @Get('profile')
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard)
  getProfile(@Query() query: AdminProfileQueryDto, @Req() req: { user: { username: string } }) {
    return this.adminAuthService.getProfile(query, req.user.username)
  }
}

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
