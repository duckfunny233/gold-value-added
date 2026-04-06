import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'

const TIME_RANGES = ['today', '7d', '30d'] as const

export class AdminReportsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reportType?: string

  @ApiPropertyOptional({ enum: TIME_RANGES })
  @IsOptional()
  @IsIn(TIME_RANGES)
  timeRange?: (typeof TIME_RANGES)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channel?: string
}
