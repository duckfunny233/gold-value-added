import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsString, MinLength } from 'class-validator'

export class CreateAdminUserDto {
  @ApiProperty()
  @IsString()
  username!: string

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string

  @ApiProperty()
  @IsString()
  displayName!: string

  @ApiProperty()
  @IsString()
  roleId!: string
}

export class AssignAdminRolesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  roleIds!: string[]
}

export class AssignRolePermissionsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissionIds!: string[]
}
