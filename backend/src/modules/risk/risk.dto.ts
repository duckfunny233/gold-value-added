import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsOptional, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsBoolean, IsNumber, Min } from 'class-validator'

const TIME_RANGES = ['today', '7d', '30d'] as const

export class AdminRiskQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  riskType?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warningLevel?: string

  @ApiPropertyOptional({ enum: TIME_RANGES })
  @IsOptional()
  @IsIn(TIME_RANGES)
  timeRange?: (typeof TIME_RANGES)[number]
}

export class RiskRulesDto {
  @ApiProperty()
  @Type(() => Boolean)
  @IsBoolean()
  withdrawInterceptEnabled!: boolean

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  singleWithdrawalLimit!: number

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyWithdrawalLimit!: number

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  abnormalTradeThreshold!: number

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  blacklistUids!: string[]
}
