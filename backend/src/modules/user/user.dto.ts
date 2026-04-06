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
}
