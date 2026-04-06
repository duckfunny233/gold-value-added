import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'

const SORT_RULES = ['goldHoldingGrams', 'totalAsset'] as const
const SYNC_STATUSES = ['synced', 'exception', 'rebuilding'] as const
const TIME_RANGES = ['today', '7d', '30d'] as const

export class LeaderboardQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional({ enum: SORT_RULES })
  @IsOptional()
  @IsIn(SORT_RULES)
  sortRule?: (typeof SORT_RULES)[number]

  @ApiPropertyOptional({ enum: SYNC_STATUSES })
  @IsOptional()
  @IsIn(SYNC_STATUSES)
  syncStatus?: (typeof SYNC_STATUSES)[number]

  @ApiPropertyOptional({ enum: TIME_RANGES })
  @IsOptional()
  @IsIn(TIME_RANGES)
  timeRange?: (typeof TIME_RANGES)[number]
}

export class LeaderboardRuleDto {
  @ApiPropertyOptional({ enum: SORT_RULES })
  @IsOptional()
  @IsIn(SORT_RULES)
  sortRule?: (typeof SORT_RULES)[number]
}

export class LeaderboardActionDto {
  @ApiPropertyOptional({ enum: SORT_RULES })
  @IsOptional()
  @IsIn(SORT_RULES)
  sortRule?: (typeof SORT_RULES)[number]
}
