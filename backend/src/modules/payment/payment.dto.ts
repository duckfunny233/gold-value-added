import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator'

const PAYMENT_SCENES = ['user', 'merchant'] as const
const TIME_RANGES = ['today', '7d', '30d'] as const
const PAYMENT_STATUSES = ['completed', 'failed'] as const

export class PaymentQrQueryDto {
  @ApiProperty()
  @IsString()
  uid!: string
}

export class PaymentTransferDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientRequestId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payerUid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payerUsername?: string

  @ApiProperty()
  @IsString()
  payeeUid!: string

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number

  @ApiProperty({ enum: PAYMENT_SCENES })
  @IsIn(PAYMENT_SCENES)
  scene!: (typeof PAYMENT_SCENES)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remark?: string
}

export class PaymentRecordsQueryDto {
  @ApiProperty()
  @IsString()
  uid!: string

  @ApiPropertyOptional({ enum: TIME_RANGES })
  @IsOptional()
  @IsIn(TIME_RANGES)
  timeRange?: (typeof TIME_RANGES)[number]
}

export class AdminPaymentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payerUid?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payeeUid?: string

  @ApiPropertyOptional({ enum: PAYMENT_SCENES })
  @IsOptional()
  @IsIn(PAYMENT_SCENES)
  scene?: (typeof PAYMENT_SCENES)[number]

  @ApiPropertyOptional({ enum: PAYMENT_STATUSES })
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: (typeof PAYMENT_STATUSES)[number]

  @ApiPropertyOptional({ enum: TIME_RANGES })
  @IsOptional()
  @IsIn(TIME_RANGES)
  timeRange?: (typeof TIME_RANGES)[number]
}
