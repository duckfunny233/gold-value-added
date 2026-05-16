import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class AdminLoginDto {
  @ApiProperty({ description: '管理员账号' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: '请输入管理员账号' })
  username!: string

  @ApiProperty({ description: '管理员密钥' })
  @IsString()
  @IsNotEmpty({ message: '请输入管理员密钥' })
  password!: string
}

export class AdminProfileQueryDto {
  @ApiPropertyOptional({ description: '指定查询的管理员账号，缺省为当前登录账号' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  username?: string
}
