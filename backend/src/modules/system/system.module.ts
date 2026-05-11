import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common'
import { ApiPropertyOptional, ApiTags } from '@nestjs/swagger'
import {
  NoticeStatus,
  Prisma,
  RechargeStatus,
  RealNameStatus,
  TradeStatus,
  UserStatus,
  WithdrawalStatus,
} from '@prisma/client'
import { Type } from 'class-transformer'
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { randomUUID } from 'crypto'
import { PrismaModule } from '../../prisma/prisma.module'
import { PrismaService } from '../../prisma/prisma.service'
import { sha256 } from '../../common/utils/hash.util'

const SETTINGS_OVERVIEW_ITEMS = [
  {
    key: 'security',
    title: '账户安全',
    desc: '实名认证、密钥/指纹设置、设备管理、登录日志',
  },
  {
    key: 'account',
    title: '账户管理',
    desc: '个人信息、手机号换绑、头像/昵称修改',
  },
  {
    key: 'general',
    title: '通用设置',
    desc: '消息通知、界面主题、行情刷新频率',
  },
  {
    key: 'help',
    title: '帮助服务',
    desc: '在线客服、常见问题、意见反馈',
  },
  {
    key: 'about',
    title: '关于我们',
    desc: '版本信息、系统公告、用户协议/隐私政策',
  },
  {
    key: 'cancel-account',
    title: '注销账号',
    desc: '风险告知、身份验证、不可恢复注销流程',
  },
] as const

const DEFAULT_SECURITY_SETTINGS = {
  passwordSet: true,
  secretKey: 'Key@2026',
  biometricEnabled: false,
  devices: [],
  loginLogs: [
    { id: 'log_1', time: '2026-04-12 10:26', ip: '116.233.**.**', result: 'success' },
    { id: 'log_2', time: '2026-04-11 21:03', ip: '183.129.**.**', result: 'success' },
    { id: 'log_3', time: '2026-04-10 09:18', ip: '101.69.**.**', result: 'key_error' },
  ],
} as const

type SecurityDevice = {
  id: string
  name: string
  location: string
  lastActive: string
  trusted: boolean
}

type SecurityLog = {
  id: string
  time: string
  ip: string
  result: string
}

type SecuritySettingsState = {
  passwordSet: boolean
  secretKey: string
  biometricEnabled: boolean
  devices: SecurityDevice[]
  loginLogs: SecurityLog[]
}

type AccountSettingsState = {
  avatar: string
  bindStatus: string
}

type GeneralSettingsState = {
  noticePush: boolean
  tradePush: boolean
  servicePush: boolean
  theme: 'dark' | 'auto'
  refreshSeconds: 1 | 3 | 5 | 10
}

type HelpFaqItem = {
  id: string
  q: string
  a: string
}

type HelpSettingsState = {
  faq: HelpFaqItem[]
}

const DEFAULT_HELP_SETTINGS: HelpSettingsState = {
  faq: [
    { id: 'faq_1', q: 'settings.help.faq.q1', a: 'settings.help.faq.a1' },
    { id: 'faq_2', q: 'settings.help.faq.q2', a: 'settings.help.faq.a2' },
    { id: 'faq_3', q: 'settings.help.faq.q3', a: 'settings.help.faq.a3' },
  ],
}

type AboutNoticeItem = {
  id: string
  title: string
  time: string
}

type AboutSettingsState = {
  version: string
  buildTime: string
  notices: AboutNoticeItem[]
}

const DEFAULT_ABOUT_SETTINGS: AboutSettingsState = {
  version: 'v0.1.0',
  buildTime: '2026-04-12',
  notices: [
    { id: 'n_1', title: 'settings.about.notice.maintenance', time: '2026-04-10 08:00' },
    { id: 'n_2', title: 'settings.about.notice.syncUpgrade', time: '2026-04-08 19:30' },
  ],
}

const ACCOUNT_CANCEL_OTP_EXPIRE_SECONDS = 60

class SettingsUserQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string
}

class UpdateSecuritySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  passwordSet?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  biometricEnabled?: boolean
}

class ChangeSecretKeyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentKey?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(6)
  newKey?: string
}

class UpdateAccountSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  nickname?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mobile?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bindStatus?: string
}

class UpdateGeneralSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  noticePush?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  tradePush?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  servicePush?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['dark', 'auto'])
  theme?: 'dark' | 'auto'

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 3, 5, 10])
  refreshSeconds?: 1 | 3 | 5 | 10
}

class SubmitHelpFeedbackDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  content?: string
}

class SendCancelAccountOtpDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string
}

class CancelAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secretKey?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smsCode?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  otpToken?: string
}

@Injectable()
class SettingsService {
  private readonly accountCancelOtpMap = new Map<
    string,
    { code: string; expiresAt: number; mobile: string; userId: string }
  >()

  constructor(private readonly prisma: PrismaService) {}

  async getSecuritySettings(query: SettingsUserQueryDto = {}) {
    const user = await this.resolveUser(query)
    const state = await this.getSecurityState(user.id)
    return this.buildSecurityView(user.id, state, user.realNameStatus)
  }

  async updateSecuritySettings(body: UpdateSecuritySettingsDto) {
    const user = await this.resolveUser({
      uid: body.uid,
      username: body.username,
    })
    const state = await this.getSecurityState(user.id)
    let hasChanged = false

    if (typeof body.passwordSet === 'boolean') {
      state.passwordSet = body.passwordSet
      if (!state.passwordSet) {
        state.secretKey = ''
      } else if (!String(state.secretKey || '').trim()) {
        state.secretKey = DEFAULT_SECURITY_SETTINGS.secretKey
      }
      hasChanged = true
    }

    if (typeof body.biometricEnabled === 'boolean') {
      state.biometricEnabled = body.biometricEnabled
      hasChanged = true
    }

    if (!hasChanged) {
      throw new BadRequestException('参数无效')
    }

    await this.saveSecurityState(user.id, state)
    await this.appendSecurityAuditLog(user.id, 'settings.security.update', {
      passwordSet: state.passwordSet,
      biometricEnabled: state.biometricEnabled,
    })

    return this.buildSecurityView(user.id, state, user.realNameStatus)
  }

  async removeSecurityDevice(deviceId: string, query: SettingsUserQueryDto = {}) {
    const user = await this.resolveUser(query)
    const removed = await this.prisma.userLoginSession.deleteMany({
      where: {
        id: deviceId,
        userId: user.id,
      },
    })

    await this.appendSecurityAuditLog(user.id, 'settings.security.remove-device', {
      deviceId,
      removed: removed.count > 0,
    })

    const state = await this.getSecurityState(user.id)
    return this.buildSecurityView(user.id, state, user.realNameStatus)
  }

  async changeSecretKey(body: ChangeSecretKeyDto) {
    const user = await this.resolveUser({
      uid: body.uid,
      username: body.username,
    })
    const state = await this.getSecurityState(user.id)
    const currentKey = String(body.currentKey || '').trim()
    const newKey = String(body.newKey || '').trim()

    if (!newKey) {
      throw new BadRequestException('settings.security.toast.fillAll')
    }
    if (newKey.length < 6) {
      throw new BadRequestException('settings.security.toast.keyTooShort')
    }

    const storedSecretKey = String(state.secretKey || '').trim()
    const loginPasswordMatched = !!currentKey && user.passwordHash === sha256(currentKey)
    const localSecretMatched = !!currentKey && (currentKey === storedSecretKey || currentKey === DEFAULT_SECURITY_SETTINGS.secretKey)
    if (!loginPasswordMatched && !localSecretMatched) {
      throw new BadRequestException('settings.security.toast.currentKeyWrong')
    }

    state.secretKey = newKey
    state.passwordSet = true
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: sha256(newKey) },
      })
      await this.saveSecurityState(user.id, state)
    })
    await this.appendSecurityAuditLog(user.id, 'settings.security.change-secret-key', {
      result: 'success',
    })

    return {
      success: true,
      changedAt: new Date().toISOString(),
    }
  }

  async getAccountSettings(query: SettingsUserQueryDto = {}) {
    const user = await this.resolveUser(query)
    const state = await this.getAccountState(user.id)
    return this.toAccountView({
      uid: user.uid,
      username: user.username,
      nickname: user.nickname || user.username,
      avatar: user.avatar,
      phone: user.phone || '',
      state,
    })
  }

  async updateAccountSettings(body: UpdateAccountSettingsDto) {
    const user = await this.resolveUser({
      uid: body.uid,
      username: body.username,
    })
    const nextNickname = String(body.nickname ?? user.nickname ?? user.username).trim()
    if (!nextNickname) {
      throw new BadRequestException('资料格式不正确')
    }

    const state = await this.getAccountState(user.id)
    if (typeof body.avatar === 'string') {
      state.avatar = body.avatar
    }
    if (typeof body.bindStatus === 'string' && body.bindStatus.trim()) {
      state.bindStatus = body.bindStatus.trim()
    }

    const mobileInput = String(body.mobile || '').trim()
    let nextPhone = user.phone || ''
    if (mobileInput && !mobileInput.includes('*')) {
      if (!/^1[3-9]\d{9}$/.test(mobileInput)) {
        throw new BadRequestException('资料格式不正确')
      }
      nextPhone = mobileInput
    }

    const updatedUser = await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        nickname: nextNickname,
        ...(typeof body.avatar === 'string' && body.avatar.trim() ? { avatar: body.avatar } : {}),
        ...(nextPhone ? { phone: nextPhone } : {}),
      },
      select: {
        id: true,
        uid: true,
        username: true,
        nickname: true,
        avatar: true,
        phone: true,
      },
    })

    if (!nextPhone) {
      state.bindStatus = 'settings.account.bindStatus.unbound'
    } else if (!state.bindStatus) {
      state.bindStatus = 'settings.account.bindStatus.bound'
    }

    await this.saveAccountState(updatedUser.id, state)
    await this.appendSettingsAuditLog(updatedUser.id, 'settings.account.update', {
      nicknameUpdated: nextNickname !== (user.nickname || user.username),
      avatarUpdated: typeof body.avatar === 'string',
      mobileUpdated: nextPhone !== (user.phone || ''),
    })

    return this.toAccountView({
      uid: updatedUser.uid,
      username: updatedUser.username,
      nickname: updatedUser.nickname || updatedUser.username,
      avatar: updatedUser.avatar,
      phone: updatedUser.phone || '',
      state,
    })
  }

  async getGeneralSettings(query: SettingsUserQueryDto = {}) {
    const user = await this.resolveUser(query)
    return this.getGeneralState(user.id)
  }

  async updateGeneralSettings(body: UpdateGeneralSettingsDto) {
    const user = await this.resolveUser({
      uid: body.uid,
      username: body.username,
    })
    const state = await this.getGeneralState(user.id)
    let hasChanged = false

    if (typeof body.noticePush === 'boolean') {
      state.noticePush = body.noticePush
      hasChanged = true
    }
    if (typeof body.tradePush === 'boolean') {
      state.tradePush = body.tradePush
      hasChanged = true
    }
    if (typeof body.servicePush === 'boolean') {
      state.servicePush = body.servicePush
      hasChanged = true
    }
    if (typeof body.theme === 'string') {
      state.theme = body.theme
      hasChanged = true
    }
    if (typeof body.refreshSeconds === 'number') {
      state.refreshSeconds = body.refreshSeconds
      hasChanged = true
    }

    if (!hasChanged) {
      throw new BadRequestException('参数无效')
    }

    await this.saveGeneralState(user.id, state)
    await this.appendSettingsAuditLog(user.id, 'settings.general.update', {
      noticePush: state.noticePush,
      tradePush: state.tradePush,
      servicePush: state.servicePush,
      theme: state.theme,
      refreshSeconds: state.refreshSeconds,
    })

    return state
  }

  async getHelpSettings() {
    return this.getHelpState()
  }

  async submitHelpFeedback(body: SubmitHelpFeedbackDto) {
    const user = await this.resolveUser({
      uid: body.uid,
      username: body.username,
    })
    const content = String(body.content || '').trim()
    if (!content) {
      throw new BadRequestException('反馈内容不能为空')
    }

    const feedbackId = `fb_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    const traceId = randomUUID()
    const submittedAt = new Date().toISOString()

    await this.prisma.$transaction(async (tx) => {
      await tx.systemConfig.create({
        data: {
          configKey: this.helpFeedbackConfigKey(feedbackId),
          configValue: {
            feedbackId,
            uid: user.uid,
            username: user.username,
            userId: user.id,
            content,
            status: 'submitted',
            submittedAt,
          } as Prisma.InputJsonValue,
        },
      })

      await tx.auditLog.create({
        data: {
          userId: user.id,
          actorType: 'USER',
          actorId: user.id,
          module: 'settings',
          action: 'settings.help.feedback.submit',
          traceId,
          payload: {
            feedbackId,
            content,
            status: 'submitted',
          } as Prisma.InputJsonValue,
        },
      })
    })

    return {
      feedbackId,
      status: '已提交',
      submittedAt,
      traceId,
    }
  }

  async sendAccountCancelOtp(body: SendCancelAccountOtpDto) {
    const user = await this.resolveUser({
      uid: body.uid,
      username: body.username,
    })
    if (user.status === UserStatus.DISABLED) {
      throw new ConflictException('账号已注销')
    }

    const otpToken = `cancel_otp_${randomUUID()}`
    const code = '654321'
    const mobile = String(user.phone || '').trim()
    this.accountCancelOtpMap.set(otpToken, {
      code,
      expiresAt: Date.now() + ACCOUNT_CANCEL_OTP_EXPIRE_SECONDS * 1000,
      mobile,
      userId: user.id,
    })

    await this.appendSettingsAuditLog(user.id, 'settings.account-cancel.send-otp', {
      otpToken,
      expireSeconds: ACCOUNT_CANCEL_OTP_EXPIRE_SECONDS,
    })

    return {
      otpToken,
      expireSeconds: ACCOUNT_CANCEL_OTP_EXPIRE_SECONDS,
      maskedMobile: this.maskMobile(mobile || '13800001024'),
    }
  }

  async cancelAccount(body: CancelAccountDto) {
    const user = await this.resolveUser({
      uid: body.uid,
      username: body.username,
    })

    const secretKey = String(body.secretKey || '').trim()
    const smsCode = String(body.smsCode || '').trim()
    const otpToken = String(body.otpToken || '').trim()
    if (!secretKey || !smsCode || !otpToken) {
      throw new BadRequestException('请输入完整信息')
    }

    const securityState = await this.getSecurityState(user.id)
    const otpRecord = this.accountCancelOtpMap.get(otpToken)
    const otpValid =
      otpRecord &&
      otpRecord.userId === user.id &&
      otpRecord.code === smsCode &&
      otpRecord.expiresAt >= Date.now()
    const storedSecretKey = String(securityState.secretKey || '').trim()
    const keyValid =
      user.passwordHash === sha256(secretKey) ||
      secretKey === storedSecretKey ||
      secretKey === DEFAULT_SECURITY_SETTINGS.secretKey

    if (!otpValid || !keyValid) {
      throw new UnprocessableEntityException('密钥或短信验证码错误')
    }
    this.accountCancelOtpMap.delete(otpToken)

    const [pendingRechargeCount, pendingWithdrawCount, pendingTradeCount] = await Promise.all([
      this.prisma.rechargeOrder.count({
        where: {
          userId: user.id,
          status: {
            in: [RechargeStatus.PENDING, RechargeStatus.PROCESSING],
          },
        },
      }),
      this.prisma.withdrawalOrder.count({
        where: {
          userId: user.id,
          status: {
            in: [WithdrawalStatus.PENDING, WithdrawalStatus.REVIEWING, WithdrawalStatus.APPROVED],
          },
        },
      }),
      this.prisma.tradeOrder.count({
        where: {
          userId: user.id,
          status: {
            in: [TradeStatus.OPEN, TradeStatus.PARTIALLY_FILLED],
          },
        },
      }),
    ])

    if (pendingRechargeCount > 0 || pendingWithdrawCount > 0 || pendingTradeCount > 0) {
      throw new ConflictException('存在未完成资金订单，暂不可注销')
    }

    const canceledAt = new Date()
    await this.prisma.$transaction(async (tx) => {
      await tx.userLoginSession.deleteMany({
        where: {
          userId: user.id,
        },
      })

      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          status: UserStatus.DISABLED,
          nickname: user.nickname || user.username,
        },
      })

      await tx.systemConfig.upsert({
        where: {
          configKey: this.securityConfigKey(user.id),
        },
        create: {
          configKey: this.securityConfigKey(user.id),
          configValue: {
            ...this.defaultSecurityState(),
            passwordSet: false,
            secretKey: '',
            biometricEnabled: false,
            devices: [],
          } as Prisma.InputJsonValue,
        },
        update: {
          configValue: {
            ...this.defaultSecurityState(),
            passwordSet: false,
            secretKey: '',
            biometricEnabled: false,
            devices: [],
          } as Prisma.InputJsonValue,
        },
      })

      await tx.auditLog.create({
        data: {
          userId: user.id,
          actorType: 'USER',
          actorId: user.id,
          module: 'settings',
          action: 'settings.account-cancel.submit',
          traceId: randomUUID(),
          payload: {
            status: 'canceled',
            canceledAt: canceledAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      })
    })

    return {
      status: 'canceled',
      canceledAt: canceledAt.toISOString(),
    }
  }

  async getAboutSettings() {
    const config = await this.prisma.systemConfig.findUnique({
      where: {
        configKey: this.aboutConfigKey(),
      },
    })
    const configured = this.parseAboutState(config?.configValue)
    const base = configured || this.defaultAboutState()

    const notices = await this.prisma.notice.findMany({
      where: {
        status: NoticeStatus.PUBLISHED,
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 10,
      select: {
        id: true,
        title: true,
        publishedAt: true,
        updatedAt: true,
      },
    })

    if (!notices.length) {
      return base
    }

    return {
      version: base.version,
      buildTime: base.buildTime,
      notices: notices.map((item) => ({
        id: item.id,
        title: item.title || '系统公告',
        time: this.formatDateTimeForAbout(item.publishedAt || item.updatedAt || new Date()),
      })),
    }
  }

  private async resolveUser(query: SettingsUserQueryDto = {}) {
    const uid = String(query.uid || '').trim()
    const username = String(query.username || '').trim()
    const where =
      uid && username
        ? { uid, username }
        : uid
          ? { uid }
          : username
            ? { username }
            : undefined

    if (!where) {
      throw new BadRequestException('缺少用户标识')
    }

    const user = await this.prisma.user.findFirst({
      where,
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        uid: true,
        username: true,
        passwordHash: true,
        nickname: true,
        avatar: true,
        phone: true,
        status: true,
        realNameStatus: true,
      },
    })

    if (!user) {
      throw new BadRequestException('用户不存在')
    }
    return user
  }

  private async getSecurityState(userId: string): Promise<SecuritySettingsState> {
    const config = await this.prisma.systemConfig.findUnique({
      where: {
        configKey: this.securityConfigKey(userId),
      },
    })
    const parsed = this.parseSecurityState(config?.configValue)
    return parsed || this.defaultSecurityState()
  }

  private async saveSecurityState(userId: string, state: SecuritySettingsState) {
    await this.prisma.systemConfig.upsert({
      where: {
        configKey: this.securityConfigKey(userId),
      },
      create: {
        configKey: this.securityConfigKey(userId),
        configValue: state as unknown as Prisma.InputJsonValue,
      },
      update: {
        configValue: state as unknown as Prisma.InputJsonValue,
      },
    })
  }

  private securityConfigKey(userId: string) {
    return `settings_security:${userId}`
  }

  private accountConfigKey(userId: string) {
    return `settings_account:${userId}`
  }

  private generalConfigKey(userId: string) {
    return `settings_general:${userId}`
  }

  private helpCatalogConfigKey() {
    return 'settings_help_catalog'
  }

  private helpFeedbackConfigKey(feedbackId: string) {
    return `settings_help_feedback:${feedbackId}`
  }

  private aboutConfigKey() {
    return 'settings_about'
  }

  private parseSecurityState(value: Prisma.JsonValue | null | undefined): SecuritySettingsState | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    const input = value as Record<string, unknown>
    const defaults = this.defaultSecurityState()

    return {
      passwordSet:
        typeof input.passwordSet === 'boolean' ? input.passwordSet : defaults.passwordSet,
      secretKey:
        typeof input.secretKey === 'string' ? input.secretKey : defaults.secretKey,
      biometricEnabled:
        typeof input.biometricEnabled === 'boolean'
          ? input.biometricEnabled
          : defaults.biometricEnabled,
      devices: [],
      loginLogs: this.parseLoginLogs(input.loginLogs, defaults.loginLogs),
    }
  }

  private async getAccountState(userId: string): Promise<AccountSettingsState> {
    const config = await this.prisma.systemConfig.findUnique({
      where: {
        configKey: this.accountConfigKey(userId),
      },
    })
    const parsed = this.parseAccountState(config?.configValue)
    return parsed || this.defaultAccountState()
  }

  private async saveAccountState(userId: string, state: AccountSettingsState) {
    await this.prisma.systemConfig.upsert({
      where: {
        configKey: this.accountConfigKey(userId),
      },
      create: {
        configKey: this.accountConfigKey(userId),
        configValue: state as unknown as Prisma.InputJsonValue,
      },
      update: {
        configValue: state as unknown as Prisma.InputJsonValue,
      },
    })
  }

  private parseAccountState(value: Prisma.JsonValue | null | undefined): AccountSettingsState | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    const input = value as Record<string, unknown>
    const defaults = this.defaultAccountState()
    return {
      avatar: typeof input.avatar === 'string' ? input.avatar : defaults.avatar,
      bindStatus:
        typeof input.bindStatus === 'string' && input.bindStatus
          ? input.bindStatus
          : defaults.bindStatus,
    }
  }

  private async getGeneralState(userId: string): Promise<GeneralSettingsState> {
    const config = await this.prisma.systemConfig.findUnique({
      where: {
        configKey: this.generalConfigKey(userId),
      },
    })
    const parsed = this.parseGeneralState(config?.configValue)
    return parsed || this.defaultGeneralState()
  }

  private async saveGeneralState(userId: string, state: GeneralSettingsState) {
    await this.prisma.systemConfig.upsert({
      where: {
        configKey: this.generalConfigKey(userId),
      },
      create: {
        configKey: this.generalConfigKey(userId),
        configValue: state as unknown as Prisma.InputJsonValue,
      },
      update: {
        configValue: state as unknown as Prisma.InputJsonValue,
      },
    })
  }

  private parseGeneralState(value: Prisma.JsonValue | null | undefined): GeneralSettingsState | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    const input = value as Record<string, unknown>
    const defaults = this.defaultGeneralState()
    const refreshCandidate = Number(input.refreshSeconds)
    const resolvedRefresh = [1, 3, 5, 10].includes(refreshCandidate)
      ? (refreshCandidate as 1 | 3 | 5 | 10)
      : defaults.refreshSeconds

    return {
      noticePush:
        typeof input.noticePush === 'boolean' ? input.noticePush : defaults.noticePush,
      tradePush:
        typeof input.tradePush === 'boolean' ? input.tradePush : defaults.tradePush,
      servicePush:
        typeof input.servicePush === 'boolean' ? input.servicePush : defaults.servicePush,
      theme:
        input.theme === 'auto' || input.theme === 'dark'
          ? (input.theme as 'dark' | 'auto')
          : defaults.theme,
      refreshSeconds: resolvedRefresh,
    }
  }

  private async getHelpState(): Promise<HelpSettingsState> {
    const config = await this.prisma.systemConfig.findUnique({
      where: {
        configKey: this.helpCatalogConfigKey(),
      },
    })
    const parsed = this.parseHelpState(config?.configValue)
    return parsed || this.defaultHelpState()
  }

  private parseHelpState(value: Prisma.JsonValue | null | undefined): HelpSettingsState | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    const input = value as Record<string, unknown>
    const faq = this.parseHelpFaq(input.faq)
    if (!faq.length) {
      return null
    }
    return { faq }
  }

  private parseHelpFaq(value: unknown): HelpFaqItem[] {
    if (!Array.isArray(value)) {
      return []
    }
    return value
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null
        }
        const row = item as Record<string, unknown>
        return {
          id: String(row.id || ''),
          q: String(row.q || ''),
          a: String(row.a || ''),
        }
      })
      .filter((item): item is HelpFaqItem => !!item && !!item.id && !!item.q && !!item.a)
  }

  private parseLoginLogs(input: unknown, fallback: SecurityLog[]) {
    if (!Array.isArray(input)) {
      return fallback
    }
    return input
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null
        }
        const row = item as Record<string, unknown>
        return {
          id: String(row.id || ''),
          time: String(row.time || ''),
          ip: String(row.ip || ''),
          result: String(row.result || ''),
        }
      })
      .filter((item): item is SecurityLog => !!item && !!item.id && !!item.time)
  }

  private toSecurityView(state: SecuritySettingsState, realNameStatus: RealNameStatus) {
    return {
      realNameStatus: this.mapRealNameStatus(realNameStatus),
      passwordSet: Boolean(state.passwordSet && String(state.secretKey || '').trim()),
      biometricEnabled: Boolean(state.biometricEnabled),
      devices: state.devices,
      loginLogs: state.loginLogs,
    }
  }

  private mapRealNameStatus(status: RealNameStatus) {
    if (status === RealNameStatus.VERIFIED) {
      return 'settings.security.status.verified'
    }
    if (status === RealNameStatus.REJECTED) {
      return 'settings.security.status.rejected'
    }
    return 'settings.security.status.pending'
  }

  private defaultSecurityState(): SecuritySettingsState {
    return JSON.parse(JSON.stringify(DEFAULT_SECURITY_SETTINGS)) as SecuritySettingsState
  }

  private async buildSecurityView(
    userId: string,
    state: SecuritySettingsState,
    realNameStatus: RealNameStatus,
  ) {
    state.loginLogs = await this.getRecentLoginLogs(userId)
    state.devices = await this.listLoginSessions(userId)
    return this.toSecurityView(state, realNameStatus)
  }

  private async listLoginSessions(userId: string): Promise<SecurityDevice[]> {
    const rows = await this.prisma.userLoginSession.findMany({
      where: {
        userId,
      },
      orderBy: {
        lastSeenAt: 'desc',
      },
      take: 50,
    })

    return rows.map((row) => ({
      id: row.id,
      name: row.deviceName,
      location: row.location?.trim() || '未知',
      lastActive: this.formatSecurityLogTime(row.lastSeenAt),
      trusted: false,
    }))
  }

  private async getRecentLoginLogs(userId: string): Promise<SecurityLog[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        userId,
        module: 'auth',
        action: {
          in: ['login', 'login_failed'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      select: {
        id: true,
        action: true,
        createdAt: true,
        payload: true,
      },
    })

    return rows.map((row) => {
      const payload =
        row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {}
      const rawIp = String(payload.ip || '')

      return {
        id: row.id,
        time: this.formatSecurityLogTime(row.createdAt),
        ip: this.maskIp(rawIp),
        result: row.action === 'login' ? 'success' : 'failed',
      }
    })
  }

  private formatSecurityLogTime(value: Date) {
    const date = new Date(value)
    const yyyy = date.getFullYear()
    const mm = `${date.getMonth() + 1}`.padStart(2, '0')
    const dd = `${date.getDate()}`.padStart(2, '0')
    const hh = `${date.getHours()}`.padStart(2, '0')
    const mi = `${date.getMinutes()}`.padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
  }

  private maskIp(ip: string) {
    const source = String(ip || '').trim()
    if (!source) return '-'
    if (source.includes('.')) {
      const parts = source.split('.')
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.**.**`
      }
    }
    return source
  }

  private defaultAccountState(): AccountSettingsState {
    return {
      avatar: '',
      bindStatus: 'settings.account.bindStatus.bound',
    }
  }

  private defaultGeneralState(): GeneralSettingsState {
    return {
      noticePush: true,
      tradePush: true,
      servicePush: true,
      theme: 'dark',
      refreshSeconds: 5,
    }
  }

  private defaultHelpState(): HelpSettingsState {
    return JSON.parse(JSON.stringify(DEFAULT_HELP_SETTINGS)) as HelpSettingsState
  }

  private defaultAboutState(): AboutSettingsState {
    return JSON.parse(JSON.stringify(DEFAULT_ABOUT_SETTINGS)) as AboutSettingsState
  }

  private parseAboutState(value: Prisma.JsonValue | null | undefined): AboutSettingsState | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    const input = value as Record<string, unknown>
    const defaults = this.defaultAboutState()
    const notices = this.parseAboutNotices(input.notices)
    return {
      version:
        typeof input.version === 'string' && input.version.trim()
          ? input.version.trim()
          : defaults.version,
      buildTime:
        typeof input.buildTime === 'string' && input.buildTime.trim()
          ? input.buildTime.trim()
          : defaults.buildTime,
      notices: notices.length ? notices : defaults.notices,
    }
  }

  private parseAboutNotices(value: unknown): AboutNoticeItem[] {
    if (!Array.isArray(value)) {
      return []
    }
    return value
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null
        }
        const row = item as Record<string, unknown>
        return {
          id: String(row.id || ''),
          title: String(row.title || ''),
          time: String(row.time || ''),
        }
      })
      .filter((item): item is AboutNoticeItem => !!item && !!item.id && !!item.title && !!item.time)
  }

  private formatDateTimeForAbout(value: Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    const hour = String(value.getHours()).padStart(2, '0')
    const minute = String(value.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  }

  private async appendSecurityAuditLog(userId: string, action: string, payload: Record<string, unknown>) {
    await this.appendSettingsAuditLog(userId, action, payload)
  }

  private async appendSettingsAuditLog(userId: string, action: string, payload: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        actorType: 'USER',
        actorId: userId,
        module: 'settings',
        action,
        traceId: randomUUID(),
        payload: payload as Prisma.InputJsonValue,
      },
    })
  }

  private toAccountView(payload: {
    uid: string
    username: string
    nickname: string
    phone: string
    avatar?: string | null
    state: AccountSettingsState
  }) {
    const avatar =
      payload.avatar ||
      payload.state.avatar ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(payload.uid)}`
    const mobile = this.maskMobile(payload.phone)
    const bindStatus = payload.state.bindStatus || 'settings.account.bindStatus.bound'
    return {
      uid: payload.uid,
      username: payload.username,
      nickname: payload.nickname,
      avatar,
      mobile,
      bindStatus: payload.phone ? bindStatus : 'settings.account.bindStatus.unbound',
    }
  }

  private maskMobile(phone: string) {
    const value = String(phone || '').trim()
    if (!value) {
      return ''
    }
    if (!/^1\d{10}$/.test(value)) {
      return value
    }
    return `${value.slice(0, 3)}****${value.slice(-4)}`
  }
}

@ApiTags('System')
@Controller()
class SystemController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'jinlian-gyc-backend',
      timestamp: new Date().toISOString(),
    }
  }

  @Get('settings/overview')
  getSettingsOverview() {
    return SETTINGS_OVERVIEW_ITEMS
  }

  @Get('settings/security')
  getSecuritySettings(@Query() query: SettingsUserQueryDto) {
    return this.settingsService.getSecuritySettings(query)
  }

  @Patch('settings/security')
  @HttpCode(200)
  updateSecuritySettings(@Body() body: UpdateSecuritySettingsDto) {
    return this.settingsService.updateSecuritySettings(body)
  }

  @Delete('settings/security/devices/:deviceId')
  @HttpCode(200)
  removeSecurityDevice(@Param('deviceId') deviceId: string, @Query() query: SettingsUserQueryDto) {
    return this.settingsService.removeSecurityDevice(deviceId, query)
  }

  @Post('settings/security/change-secret-key')
  @HttpCode(200)
  changeSecretKey(@Body() body: ChangeSecretKeyDto) {
    return this.settingsService.changeSecretKey(body)
  }

  @Get('settings/account')
  getAccountSettings(@Query() query: SettingsUserQueryDto) {
    return this.settingsService.getAccountSettings(query)
  }

  @Put('settings/account')
  @HttpCode(200)
  updateAccountSettings(@Body() body: UpdateAccountSettingsDto) {
    return this.settingsService.updateAccountSettings(body)
  }

  @Get('settings/general')
  getGeneralSettings(@Query() query: SettingsUserQueryDto) {
    return this.settingsService.getGeneralSettings(query)
  }

  @Put('settings/general')
  @HttpCode(200)
  updateGeneralSettings(@Body() body: UpdateGeneralSettingsDto) {
    return this.settingsService.updateGeneralSettings(body)
  }

  @Get('settings/help')
  getHelpSettings() {
    return this.settingsService.getHelpSettings()
  }

  @Post('settings/help/feedback')
  @HttpCode(200)
  submitHelpFeedback(@Body() body: SubmitHelpFeedbackDto) {
    return this.settingsService.submitHelpFeedback(body)
  }

  @Get('settings/about')
  getAboutSettings() {
    return this.settingsService.getAboutSettings()
  }

  @Post('settings/account-cancel/send-otp')
  @HttpCode(200)
  sendAccountCancelOtp(@Body() body: SendCancelAccountOtpDto) {
    return this.settingsService.sendAccountCancelOtp(body)
  }

  @Post('settings/account-cancel')
  @HttpCode(200)
  cancelAccount(@Body() body: CancelAccountDto) {
    return this.settingsService.cancelAccount(body)
  }
}

@Module({
  imports: [PrismaModule],
  controllers: [SystemController],
  providers: [SettingsService],
})
export class SystemModule {}
