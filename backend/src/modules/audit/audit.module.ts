import { Controller, Get, Injectable, Module } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Injectable()
class AuditService {
  getRecords() {
    return [
      {
        traceId: 'trace-demo-1',
        module: 'fund',
        action: 'withdraw.create',
        hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        syncStatus: 'PENDING',
      },
    ]
  }
}

@ApiTags('Audit')
@Controller('admin/audit')
class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('records')
  getRecords() {
    return this.auditService.getRecords()
  }
}

@Module({
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule {}
