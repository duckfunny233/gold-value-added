import { Controller, Get, Module } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

const SETTINGS_OVERVIEW_ITEMS = [
  {
    key: 'security',
    title: '账户安全',
    desc: '实名认证、密钥/指纹设置、设备管理、登录日志',
  },
  {
    key: 'account',
    title: '账户管理',
    desc: '个人信息、手机号换绑、头像/昵称修改',
  },
  {
    key: 'general',
    title: '通用设置',
    desc: '消息通知、界面主题、行情刷新频率',
  },
  {
    key: 'help',
    title: '帮助服务',
    desc: '在线客服、常见问题、意见反馈',
  },
  {
    key: 'about',
    title: '关于我们',
    desc: '版本信息、系统公告、用户协议/隐私政策',
  },
  {
    key: 'cancel-account',
    title: '注销账号',
    desc: '风险告知、身份验证、不可恢复注销流程',
  },
] as const

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

  @Get('settings/overview')
  getSettingsOverview() {
    return SETTINGS_OVERVIEW_ITEMS
  }
}

@Module({
  controllers: [SystemController],
})
export class SystemModule {}
