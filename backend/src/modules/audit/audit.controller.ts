import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { AdminProtected } from '../admin-auth/admin-protected.decorator'
import { AdminAuditQueryDto, AuditTraceExportQueryDto } from './audit.dto'
import { AuditService } from './audit.service'

type AdminRequest = Request & {
  user?: {
    adminUserId: string
    username: string
  }
}

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

  @Get('trace/:traceId')
  @AdminProtected()
  getTraceDetail(@Param('traceId') traceId: string) {
    return this.auditService.getTraceDetail(traceId)
  }

  @Post('trace/:traceId/verify-hash')
  @AdminProtected()
  verifyTraceHash(@Param('traceId') traceId: string, @Req() req: AdminRequest) {
    return this.auditService.verifyTraceHash(traceId, this.requireAdmin(req))
  }

  @Get('trace/:traceId/export')
  @AdminProtected()
  exportTrace(
    @Param('traceId') traceId: string,
    @Query() query: AuditTraceExportQueryDto,
    @Req() req: AdminRequest,
  ) {
    return this.auditService.exportTrace(traceId, query, this.requireAdmin(req))
  }

  private requireAdmin(req: AdminRequest) {
    return {
      adminUserId: req.user?.adminUserId || 'admin-local',
      username: req.user?.username || 'admin',
    }
  }
}
