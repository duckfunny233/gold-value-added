import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator'

const TIME_RANGES = ['today', '7d', '30d'] as const
const REPORT_TYPES = ['operate', 'finance', 'risk'] as const
const REPORT_JOB_STATUSES = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED'] as const
const REPORT_EXPORT_FORMATS = ['csv', 'excel'] as const

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

export class ReportGenerateDto {
  @ApiPropertyOptional({ enum: REPORT_TYPES })
  @IsOptional()
  @IsIn(REPORT_TYPES)
  reportType?: (typeof REPORT_TYPES)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateId?: string

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

  @ApiPropertyOptional({ enum: REPORT_EXPORT_FORMATS, default: 'csv' })
  @IsOptional()
  @IsIn(REPORT_EXPORT_FORMATS)
  format?: (typeof REPORT_EXPORT_FORMATS)[number]
}

export class ReportJobsQueryDto {
  @ApiPropertyOptional({ enum: REPORT_TYPES })
  @IsOptional()
  @IsIn(REPORT_TYPES)
  reportType?: (typeof REPORT_TYPES)[number]

  @ApiPropertyOptional({ enum: REPORT_JOB_STATUSES })
  @IsOptional()
  @IsIn(REPORT_JOB_STATUSES)
  status?: (typeof REPORT_JOB_STATUSES)[number]
}

export class ReportJobExportDto {
  @ApiPropertyOptional({ enum: REPORT_EXPORT_FORMATS, default: 'csv' })
  @IsOptional()
  @IsIn(REPORT_EXPORT_FORMATS)
  format?: (typeof REPORT_EXPORT_FORMATS)[number]
}

export class ReportTemplateCreateDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string

  @ApiProperty({ enum: REPORT_TYPES })
  @IsIn(REPORT_TYPES)
  reportType!: (typeof REPORT_TYPES)[number]

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

  @ApiPropertyOptional({ enum: REPORT_EXPORT_FORMATS, default: 'csv' })
  @IsOptional()
  @IsIn(REPORT_EXPORT_FORMATS)
  defaultFormat?: (typeof REPORT_EXPORT_FORMATS)[number]
}

export class ReportTemplatesQueryDto {
  @ApiPropertyOptional({ enum: REPORT_TYPES })
  @IsOptional()
  @IsIn(REPORT_TYPES)
  reportType?: (typeof REPORT_TYPES)[number]
}
