import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'

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
