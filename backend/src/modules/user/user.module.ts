import { Controller, Get, Injectable, Module } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Injectable()
class UserService {
  getAssetOverview() {
    return {
      uid: 'UID20260001',
      tentativeAsset: 120000,
      cashAsset: 80000,
      appreciationIncome: 2400,
      goldHoldingGrams: 120.55,
      withdrawFrozenAmount: 3000,
      totalAsset: 199400,
    }
  }

  getProfile() {
    return {
      uid: 'UID20260001',
      username: 'gold_user',
      realNameStatus: 'VERIFIED',
      status: 'ACTIVE',
    }
  }
}

@ApiTags('User')
@Controller()
class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('app/assets/overview')
  getAssetOverview() {
    return this.userService.getAssetOverview()
  }

  @Get('admin/users/profile')
  getProfile() {
    return this.userService.getProfile()
  }
}

@Module({
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
