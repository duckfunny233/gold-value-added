import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator'

const TIME_RANGES = ['today', '7d', '30d'] as const

export class TradeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientRequestId?: string

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  price!: number

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantityGrams!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assetCode?: string
}

export class TradeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string
}

export class AdminTradesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tradeNo?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tradeType?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  syncStatus?: string

  @ApiPropertyOptional({ enum: TIME_RANGES })
  @IsOptional()
  @IsIn(TIME_RANGES)
  timeRange?: (typeof TIME_RANGES)[number]
}

export class TradeRetrySyncDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tradeNo?: string
}
