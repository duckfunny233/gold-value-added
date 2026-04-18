import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { AdminPermission } from '../admin-auth/admin-permission.decorator'
import { ADMIN_PERMISSION_CODES } from '../admin-auth/admin-permission-codes'
import { AdminProtected } from '../admin-auth/admin-protected.decorator'
import {
  AdminFundQueryDto,
  FundQueryDto,
  ManualFundActionDto,
  RechargeDto,
  WithdrawDto,
  WalletRechargeConfirmDto,
  WalletRechargeDto,
  WalletWithdrawSmsDto,
  WalletWithdrawSubmitDto,
} from './fund.dto'
import { FundService } from './fund.service'

type AdminRequest = Request & {
  user?: {
    adminUserId: string
    username: string
  }
}

@ApiTags('Fund')
@Controller()
export class FundController {
  constructor(private readonly fundService: FundService) {}

  @Post('wallet/recharge')
  @HttpCode(200)
  createWalletRecharge(@Body() body: WalletRechargeDto) {
    return this.fundService.createWalletRecharge(body)
  }

  @Post('wallet/recharge/:orderId/confirm')
  @HttpCode(200)
  confirmWalletRecharge(@Param('orderId') orderId: string, @Body() body: WalletRechargeConfirmDto) {
    return this.fundService.confirmWalletRecharge(orderId, body)
  }

  @Post('wallet/withdraw/send-sms')
  @HttpCode(200)
  sendWithdrawSms(@Body() body: WalletWithdrawSmsDto) {
    return this.fundService.sendWalletWithdrawSms(body)
  }

  @Post('wallet/withdraw')
  @HttpCode(200)
  createWalletWithdraw(@Body() body: WalletWithdrawSubmitDto) {
    return this.fundService.createWalletWithdraw(body)
  }

  @Post('app/recharges')
  @HttpCode(200)
  createRecharge(@Body() body: RechargeDto) {
    return this.fundService.createRecharge(body)
  }

  @Get('app/recharges')
  getRecharges(@Query() query: FundQueryDto) {
    return this.fundService.getRechargeOrders(query)
  }

  @Post('app/withdrawals')
  @HttpCode(200)
  createWithdrawal(@Body() body: WithdrawDto) {
    return this.fundService.createWithdrawal(body)
  }

  @Get('app/withdrawals')
  getWithdrawals(@Query() query: FundQueryDto) {
    return this.fundService.getWithdrawalOrders(query)
  }

  @Get('admin/funds')
  @AdminProtected()
  getAdminFunds(@Query() query: AdminFundQueryDto) {
    return this.fundService.getAdminFunds(query)
  }

  @Get('admin/funds/recharges')
  @AdminProtected()
  getAdminRecharges(@Query() query: FundQueryDto) {
    return this.fundService.getRechargeOrders(query)
  }

  @Get('admin/funds/withdrawals')
  @AdminProtected()
  getAdminWithdrawals(@Query() query: FundQueryDto) {
    return this.fundService.getWithdrawalOrders(query)
  }

  @Post('admin/funds/manual-transfer')
  @HttpCode(200)
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.FUND_MANUAL_TRANSFER)
  manualTransfer(
    @Body() body: ManualFundActionDto,
    @Req() req: AdminRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.fundService.manualTransfer(body, this.requireAdmin(req), idempotencyKey)
  }

  @Post('admin/funds/manual-adjust')
  @HttpCode(200)
  @AdminProtected()
  @AdminPermission(ADMIN_PERMISSION_CODES.FUND_MANUAL_ADJUST)
  manualAdjust(
    @Body() body: ManualFundActionDto,
    @Req() req: AdminRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.fundService.manualAdjust(body, this.requireAdmin(req), idempotencyKey)
  }

  @Post('admin/funds/withdrawals/:orderId/approve')
  @HttpCode(200)
  @AdminProtected()
  approveWithdrawal(@Param('orderId') orderId: string, @Req() req: AdminRequest) {
    return this.fundService.approveWithdrawal(orderId, this.requireAdmin(req))
  }

  @Post('admin/funds/withdrawals/:orderId/reject')
  @HttpCode(200)
  @AdminProtected()
  rejectWithdrawal(@Param('orderId') orderId: string, @Req() req: AdminRequest) {
    return this.fundService.rejectWithdrawal(orderId, this.requireAdmin(req))
  }

  @Post('admin/funds/withdrawals/:orderId/confirm-completed')
  @HttpCode(200)
  @AdminProtected()
  confirmWithdrawalCompleted(@Param('orderId') orderId: string, @Req() req: AdminRequest) {
    return this.fundService.confirmWithdrawalCompleted(orderId, this.requireAdmin(req))
  }

  @Post('admin/funds/withdrawals/:orderId/mute-alert')
  @HttpCode(200)
  @AdminProtected()
  muteWithdrawalAlert(@Param('orderId') orderId: string, @Req() req: AdminRequest) {
    return this.fundService.muteWithdrawalAlert(orderId, this.requireAdmin(req))
  }

  private requireAdmin(req: AdminRequest) {
    return {
      adminUserId: req.user?.adminUserId || 'admin-local',
      username: req.user?.username || 'admin',
    }
  }
}
