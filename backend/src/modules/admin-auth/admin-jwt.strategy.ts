import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ConfigService } from '@nestjs/config'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'change-me',
    })
  }

  async validate(payload: { sub: string; username: string; roleCodes: string[] }) {
    const adminUser = await this.prisma.adminUser.findUnique({
      where: {
        id: payload.sub,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    })

    if (!adminUser || adminUser.status !== 'ACTIVE') {
      throw new UnauthorizedException('管理员登录状态无效')
    }

    return {
      adminUserId: adminUser.id,
      username: adminUser.username,
      roleCodes: adminUser.roles.map((item) => item.role.code),
    }
  }
}
