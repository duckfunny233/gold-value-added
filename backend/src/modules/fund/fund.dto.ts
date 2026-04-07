import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator'

const CHANNELS = ['wechat', 'alipay', 'bank'] as const
const ORDER_TYPES = ['recharge', 'withdraw'] as const
const TIME_RANGES = ['today', '7d', '30d'] as const
const MANUAL_DIRECTIONS = ['increase', 'decrease'] as const
const ADMIN_FUND_STATUSES = [
  'reconciling',
  'reconciled',
  'pending_review',
  'transfer_processing',
  'completed',
  'rejected',
] as const

export class RechargeDto {
  @ApiProperty({ enum: CHANNELS })
  @IsIn(CHANNELS)
  channel!: (typeof CHANNELS)[number]

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number

  @ApiProperty()
  @IsString()
  username!: string
}

export class WithdrawDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number

  @ApiProperty()
  @IsString()
  username!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payeeName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wechatReceiptUrl?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alipayReceiptUrl?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountNo?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountHolder?: string
}

export class FundQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string
}

export class AdminFundQueryDto {
  @ApiPropertyOptional({ enum: ORDER_TYPES })
  @IsOptional()
  @IsIn(ORDER_TYPES)
  orderType?: (typeof ORDER_TYPES)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional({ enum: CHANNELS })
  @IsOptional()
  @IsIn(CHANNELS)
  channel?: (typeof CHANNELS)[number]

  @ApiPropertyOptional({ enum: ADMIN_FUND_STATUSES })
  @IsOptional()
  @IsIn(ADMIN_FUND_STATUSES)
  status?: (typeof ADMIN_FUND_STATUSES)[number]

  @ApiPropertyOptional({ enum: TIME_RANGES })
  @IsOptional()
  @IsIn(TIME_RANGES)
  timeRange?: (typeof TIME_RANGES)[number]
}

export class ManualFundActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientRequestId?: string

  @ApiProperty()
  @IsString()
  uid!: string

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number

  @ApiProperty({ enum: MANUAL_DIRECTIONS })
  @IsIn(MANUAL_DIRECTIONS)
  direction!: (typeof MANUAL_DIRECTIONS)[number]

  @ApiProperty()
  @IsString()
  reason!: string
}
