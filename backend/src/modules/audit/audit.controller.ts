import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminProtected } from '../admin-auth/admin-protected.decorator'
import { AdminAuditQueryDto } from './audit.dto'
import { AuditService } from './audit.service'

@ApiTags('Audit')
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @AdminProtected()
  getAdminAudit(@Query() query: AdminAuditQueryDto) {
    return this.auditService.getAdminAudit(query)
  }

  @Get('records')
  @AdminProtected()
  getRecords() {
    return this.auditService.getRecords()
  }
}
