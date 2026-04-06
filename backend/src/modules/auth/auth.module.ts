import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common'
import { ApiProperty, ApiTags } from '@nestjs/swagger'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { IsOptional, IsString, MinLength } from 'class-validator'
import { sha256 } from '../../common/utils/hash.util'
import { generateUid } from '../../common/utils/uid.util'
import { PrismaService } from '../../prisma/prisma.service'

class LoginDto {
  @ApiProperty()
  @IsString()
  username!: string

  @ApiProperty()
  @IsString()
  password!: string
}

class RegisterDto {
  @ApiProperty()
  @IsString()
  username!: string

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string
}

@Injectable()
class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(payload: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: payload.username },
          ...(payload.phone ? [{ phone: payload.phone }] : []),
        ],
      },
    })

    if (existingUser) {
      throw new BadRequestException('用户名或手机号已存在')
    }

    const sequence = await this.prisma.user.count()
    const uid = generateUid(sequence + 1)
    const passwordHash = sha256(payload.password)

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          uid,
          username: payload.username,
          phone: payload.phone,
          passwordHash,
          asset: {
            create: {
              tentativeAsset: new Prisma.Decimal(0),
              cashAsset: new Prisma.Decimal(0),
              appreciationIncome: new Prisma.Decimal(0),
              goldHoldingGrams: new Prisma.Decimal(0),
              withdrawFrozenAmount: new Prisma.Decimal(0),
              totalAsset: new Prisma.Decimal(0),
            },
          },
        },
      })

      await tx.auditLog.create({
        data: {
          userId: createdUser.id,
          actorType: 'USER',
          actorId: createdUser.id,
          module: 'auth',
          action: 'register',
          traceId: randomUUID(),
          payload: {
            uid: createdUser.uid,
            username: createdUser.username,
          },
        },
      })

      return createdUser
    })

    return {
      message: '注册成功',
      data: {
        uid: user.uid,
        username: user.username,
      },
    }
  }

  async login(payload: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        username: payload.username,
      },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    const inputPasswordHash = sha256(payload.password)
    if (user.passwordHash !== inputPasswordHash) {
      throw new UnauthorizedException('用户名或密码错误')
    }

    const token = sha256(`${payload.username}:${Date.now()}:${randomUUID()}`)

    return {
      message: '登录成功',
      data: {
        token,
        user: {
          uid: user.uid,
          username: payload.username,
          roles: ['app:user'],
          status: user.status,
        },
        sessionId: randomUUID(),
      },
    }
  }
}

@ApiTags('Auth')
@Controller('auth')
class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(200)
  register(@Body() body: RegisterDto) {
    return this.authService.register(body)
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto) {
    return this.authService.login(body)
  }
}

@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
