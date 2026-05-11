import { Module } from '@nestjs/common'
import { MarketModule } from '../market/market.module'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [MarketModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
