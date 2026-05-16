import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpException,
  HttpCode,
  HttpStatus,
  Injectable,
  Module,
  Post,
  Req,
  UnprocessableEntityException,
  UnauthorizedException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { FileFieldsInterceptor } from '@nestjs/platform-express'
import { ApiProperty, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from './jwt-auth.guard'
import { JwtStrategy } from './jwt.strategy'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator'
import { resolveClientIp } from '../../common/utils/client-ip.util'
import { sha256 } from '../../common/utils/hash.util'
import { clientFingerprintFromUserAgent, summarizeClient } from '../../common/utils/user-agent.util'
import { generateUid } from '../../common/utils/uid.util'
import { PrismaService } from '../../prisma/prisma.service'

type OtpRecord = {
  code: string
  expiresAt: number
}

type UploadedFile = {
  originalname: string
  mimetype: string
  size: number
}

const OTP_EXPIRE_MS = 5 * 60 * 1000

class LoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  username!: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string
}

class RegisterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(6, 18)
  username!: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(6, 16)
  password!: string

  @ApiProperty()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/)
  phone!: string

  @ApiProperty({ required: false, description: '兼容旧字段，优先使用 otp' })
  @IsOptional()
  @IsString()
  otpCode?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  otp?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(2, 20)
  realName?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{17}[\dXx]$/)
  idNumber?: string
}

class SendOtpDto {
  @ApiProperty()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/)
  phone!: string
}

class RegisterWithFilesDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(6, 18)
  username!: string

  @ApiProperty()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/)
  phone!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  otp?: string

  @ApiProperty({ required: false, description: '兼容客户端文档字段，优先使用 otp' })
  @IsOptional()
  @IsString()
  otpCode?: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(6, 16)
  password!: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(2, 20)
  realName!: string

  @ApiProperty()
  @IsString()
  @Matches(/^\d{17}[\dXx]$/)
  idNumber!: string

  @ApiProperty()
  @IsString()
  @IsIn(['workCert', 'bizLicense', 'workProof', 'incomeProof', 'other'])
  proofType!: string
}

class ResetPasswordDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  otp?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  newPassword?: string
}

@Injectable()
class AuthService {
  private readonly otpMap = new Map<string, OtpRecord>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async sendOtp(payload: SendOtpDto) {
    const phone = payload.phone.trim()
    // 开发阶段固定验证码，方便联调；生产环境建议改接短信网关
    const code = '123456'
    this.otpMap.set(phone, {
      code,
      expiresAt: Date.now() + OTP_EXPIRE_MS,
    })

    return {
      message: '验证码发送成功',
      data: {
        phone,
        expireSeconds: Math.floor(OTP_EXPIRE_MS / 1000),
      },
    }
  }

  async register(payload: RegisterDto, registerIp?: string) {
    const username = payload.username.trim()
    const phone = payload.phone.trim()
    const otp = (payload.otp || payload.otpCode || '').trim()
    this.assertOtp(phone, otp)

    return this.createUser({
      username,
      password: payload.password,
      phone,
      realName: payload.realName?.trim(),
      idNumber: payload.idNumber?.trim(),
      registerChannel: 'json',
      registerIp,
    })
  }

  async registerWithFiles(
    payload: RegisterWithFilesDto,
    files: {
    idCardFront?: UploadedFile[]
    idCardBack?: UploadedFile[]
    proofFile?: UploadedFile[]
  },
    registerIp?: string,
  ) {
    const idCardFront = files.idCardFront?.[0]
    const idCardBack = files.idCardBack?.[0]
    const proofFile = files.proofFile?.[0]

    if (!idCardFront || !idCardBack || !proofFile) {
      throw new BadRequestException('请上传完整实名资料')
    }

    const phone = payload.phone.trim()
    const otp = (payload.otp || payload.otpCode || '').trim()
    this.assertOtp(phone, otp)

    return this.createUser({
      username: payload.username.trim(),
      password: payload.password,
      phone,
      realName: payload.realName.trim(),
      idNumber: payload.idNumber.trim(),
      proofType: payload.proofType,
      registerChannel: 'multipart',
      registerIp,
      files: {
        idCardFrontName: idCardFront.originalname,
        idCardBackName: idCardBack.originalname,
        proofFileName: proofFile.originalname,
      },
    })
  }

  private assertOtp(phone: string, otp: string) {
    if (!otp) {
      throw new UnprocessableEntityException('验证码错误或已过期')
    }
    const record = this.otpMap.get(phone)
    if (!record || record.expiresAt < Date.now() || record.code !== otp) {
      throw new UnprocessableEntityException('验证码错误或已过期')
    }
    this.otpMap.delete(phone)
  }

  private async createUser(payload: {
    username: string
    password: string
    phone: string
    realName?: string
    idNumber?: string
    proofType?: string
    registerChannel: 'json' | 'multipart'
    registerIp?: string
    files?: {
      idCardFrontName?: string
      idCardBackName?: string
      proofFileName?: string
    }
  }) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: payload.username }, { phone: payload.phone }],
      },
    })

    if (existingUser) {
      throw new ConflictException('账号或手机号已存在')
    }

    const sequence = await this.prisma.user.count()
    const uid = generateUid(sequence + 1)
    const passwordHash = sha256(payload.password.trim())

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          uid,
          username: payload.username,
          phone: payload.phone,
          nickname: payload.realName || payload.username,
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
            phone: createdUser.phone,
            realName: payload.realName || null,
            idNumber: payload.idNumber?.trim() || null,
            idNumberHash: payload.idNumber ? sha256(payload.idNumber) : null,
            proofType: payload.proofType || null,
            registerChannel: payload.registerChannel,
            registerIp: payload.registerIp?.trim() || null,
            files: payload.files || null,
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

  async login(payload: LoginDto, ip?: string, userAgent?: string) {
    const username = payload.username.trim()
    const user = await this.prisma.user.findUnique({
      where: {
        username,
      },
    })

    if (!user) {
      await this.recordLoginAudit(null, username, 'failed', ip)
      throw new UnauthorizedException('账号或密码错误')
    }

    const inputPasswordHash = sha256(payload.password)
    if (user.passwordHash !== inputPasswordHash) {
      await this.recordLoginAudit(user, username, 'failed', ip)
      throw new UnauthorizedException('账号或密码错误')
    }

    if (user.status === 'FROZEN' || user.status === 'DISABLED') {
      await this.recordLoginAudit(user, username, 'failed', ip)
      throw new HttpException('账号已冻结，请联系管理员', HttpStatus.LOCKED)
    }

    const roleCodes = ['app:user']
    const token = await this.jwtService.signAsync({
      sub: user.id,
      uid: user.uid,
      username: user.username,
      roleCodes,
      userType: 'app',
    })

    await this.recordLoginAudit(user, username, 'success', ip, roleCodes)

    const { deviceName } = summarizeClient(userAgent)
    const clientFingerprint = clientFingerprintFromUserAgent(userAgent)
    const session = await this.prisma.userLoginSession.upsert({
      where: {
        userId_clientFingerprint: {
          userId: user.id,
          clientFingerprint,
        },
      },
      create: {
        userId: user.id,
        clientFingerprint,
        deviceName,
        location: '未知',
        ipLast: String(ip || '').trim(),
        lastSeenAt: new Date(),
      },
      update: {
        deviceName,
        ipLast: String(ip || '').trim(),
        lastSeenAt: new Date(),
      },
    })

    return {
      message: 'OK',
      data: {
        token,
        user: {
          uid: user.uid,
          username: user.username,
          nickname: user.nickname || user.username,
          roleCodes,
          status: user.status,
          realNameVerified: user.realNameStatus === 'VERIFIED',
        },
        sessionId: session.id,
      },
    }
  }

  resetPassword(_: ResetPasswordDto) {
    throw new HttpException('请联系客服后台处理密钥找回', HttpStatus.FORBIDDEN)
  }

  logout() {
    return {
      message: '已退出登录',
      data: {
        loggedOut: true,
      },
    }
  }

  private async recordLoginAudit(
    user:
      | {
          id: string
          uid: string
          username: string
        }
      | null,
    username: string,
    result: 'success' | 'failed',
    ip?: string,
    roleCodes?: string[],
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId: user?.id || null,
        actorType: 'USER',
        actorId: user?.id || null,
        module: 'auth',
        action: result === 'success' ? 'login' : 'login_failed',
        traceId: randomUUID(),
        payload: {
          uid: user?.uid || null,
          username: user?.username || username,
          roleCodes: roleCodes || [],
          ip: ip || '',
          result,
        },
      },
    })
  }
}

@ApiTags('Auth')
@Controller('auth')
class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @HttpCode(200)
  sendOtp(@Body() body: SendOtpDto) {
    return this.authService.sendOtp(body)
  }

  @Post('register')
  @HttpCode(200)
  register(@Body() body: RegisterDto, @Req() req: { headers?: Record<string, string | string[]>; ip?: string; socket?: { remoteAddress?: string } }) {
    return this.authService.register(body, resolveClientIp(req))
  }

  @Post('register-with-files')
  @HttpCode(200)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'idCardFront', maxCount: 1 },
        { name: 'idCardBack', maxCount: 1 },
        { name: 'proofFile', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 5 * 1024 * 1024,
        },
      },
    ),
  )
  registerWithFiles(
    @Body() body: RegisterWithFilesDto,
    @UploadedFiles()
    files: {
      idCardFront?: UploadedFile[]
      idCardBack?: UploadedFile[]
      proofFile?: UploadedFile[]
    },
    @Req() req: { headers?: Record<string, string | string[]>; ip?: string; socket?: { remoteAddress?: string } },
  ) {
    return this.authService.registerWithFiles(body, files, resolveClientIp(req))
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto, @Req() req: { headers?: Record<string, string | string[]>; ip?: string; socket?: { remoteAddress?: string } }) {
    const rawAgent = req?.headers?.['user-agent']
    const userAgent = Array.isArray(rawAgent) ? rawAgent[0] : rawAgent
    return this.authService.login(body, resolveClientIp(req), userAgent)
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body)
  }

  @Post('logout')
  @HttpCode(200)
  logout() {
    return this.authService.logout()
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
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
