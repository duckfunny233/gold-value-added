import { Body, Controller, Injectable, Module, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { createHash, randomUUID } from 'crypto'

type LoginDto = {
  username: string
  password: string
}

type RegisterDto = {
  username: string
  password: string
  phone?: string
}

@Injectable()
class AuthService {
  register(payload: RegisterDto) {
    const uid = `UID${Date.now().toString().slice(-8)}`
    return {
      message: '注册成功',
      data: {
        uid,
        username: payload.username,
      },
    }
  }

  login(payload: LoginDto) {
    const token = createHash('sha256')
      .update(`${payload.username}:${Date.now()}`)
      .digest('hex')

    return {
      message: '登录成功',
      data: {
        token,
        user: {
          uid: 'UID20260001',
          username: payload.username,
          roles: ['app:user'],
        },
        sessionId: randomUUID(),
      },
    }
  }
}

@ApiTags('Auth')
@Controller('auth')
class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body)
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body)
  }
}

@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
