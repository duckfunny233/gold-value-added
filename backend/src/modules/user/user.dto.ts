import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'

const TIME_RANGES = ['today', '7d', '30d'] as const

export class UserQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string
}

export class AdminUsersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sequenceNo?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  realNameStatus?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rechargeStatus?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  withdrawStatus?: string

  @ApiPropertyOptional({ enum: TIME_RANGES })
  @IsOptional()
  @IsIn(TIME_RANGES)
  timeRange?: (typeof TIME_RANGES)[number]

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  pageSize?: number
}

export class AdminUserManualCheckDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string
}

export class PaymentMethodDto {
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
  @IsIn(['wechat', 'alipay', 'bankcard', 'bank'])
  type?: 'wechat' | 'alipay' | 'bankcard' | 'bank'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  account?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qrCode?: string
}
