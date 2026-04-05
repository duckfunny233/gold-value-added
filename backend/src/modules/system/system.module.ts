import { Controller, Get, Module } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('System')
@Controller()
class SystemController {
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'jinlian-gyc-backend',
      timestamp: new Date().toISOString(),
    }
  }
}

@Module({
  controllers: [SystemController],
})
export class SystemModule {}
