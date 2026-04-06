import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'

const TIME_RANGES = ['today', '7d', '30d'] as const

export class AdminAuditQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  traceId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  module?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventType?: string

  @ApiPropertyOptional({ enum: TIME_RANGES })
  @IsOptional()
  @IsIn(TIME_RANGES)
  timeRange?: (typeof TIME_RANGES)[number]
}
