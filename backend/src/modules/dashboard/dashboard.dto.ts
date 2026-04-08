import { Type } from 'class-transformer'
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator'

const DASHBOARD_DATES = ['today', '7d', '30d'] as const
const DASHBOARD_MODULES = ['funds', 'trades', 'risk', 'audit'] as const
const DASHBOARD_SEVERITIES = ['high', 'medium', 'low'] as const

export class DashboardQueryDto {
  @IsOptional()
  @IsIn(DASHBOARD_DATES)
  date?: (typeof DASHBOARD_DATES)[number]

  @IsOptional()
  @IsIn(DASHBOARD_MODULES)
  module?: (typeof DASHBOARD_MODULES)[number]

  @IsOptional()
  @IsIn(DASHBOARD_SEVERITIES)
  severity?: (typeof DASHBOARD_SEVERITIES)[number]
}

export class PublishNoticeDto {
  @IsString()
  @IsNotEmpty()
  title!: string

  @IsString()
  @IsNotEmpty()
  content!: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class UpdateNoticeDto {
  @IsString()
  @IsNotEmpty()
  title!: string

  @IsString()
  @IsNotEmpty()
  content!: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number
}
