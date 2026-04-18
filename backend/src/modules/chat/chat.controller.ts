import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator'
import { ChatService } from './chat.service'

class TransferTargetsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  chatId?: number

  @IsOptional()
  @IsString()
  @IsIn(['user', 'group', 'system'])
  chatType?: 'user' | 'group' | 'system'

  @IsOptional()
  @IsString()
  @MaxLength(50)
  chatTitle?: string
}

class ChatTransferDto {
  @Type(() => Number)
  @IsNumber()
  chatId!: number

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim(),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  recipientId?: string

  @IsOptional()
  @IsString()
  recipientUid?: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  recipientName?: string

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number

  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string

  @IsOptional()
  @IsString()
  @IsIn(['user', 'group', 'system'])
  chatType?: 'user' | 'group' | 'system'
}

class FriendSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string
}

class FriendRequestDto {
  @Transform(({ value }) => String(value || '').trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  targetUserId!: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  message?: string
}

class CreateGroupDto {
  @Transform(({ value }) => String(value || '').trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name!: string

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(200)
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((item) => String(item || '').trim())
          .filter((item) => item.length > 0)
      : [],
  )
  memberIds!: string[]

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notice?: string
}

class ParseScanDto {
  @Transform(({ value }) => String(value || '').trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  code!: string
}

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('list')
  getChatList() {
    return this.chatService.getChatList()
  }

  @Post('scan/parse')
  parseScan(@Body() body: ParseScanDto) {
    return this.chatService.parseScan(body.code)
  }

  @Get('my-qr')
  getMyQrCode() {
    return this.chatService.getMyQrCode()
  }

  @Get('friend-search')
  searchFriends(@Query() query: FriendSearchQueryDto) {
    return this.chatService.searchFriends(query.keyword || '')
  }

  @Get('friend-profile/:id')
  getFriendProfile(@Param('id') id: string) {
    return this.chatService.getFriendProfile(String(id || ''))
  }

  @Post('friend-request')
  sendFriendRequest(@Body() body: FriendRequestDto) {
    return this.chatService.sendFriendRequest(body)
  }

  @Post('friend-request/:requestId/confirm')
  confirmFriendRequest(@Param('requestId') requestId: string) {
    return this.chatService.confirmFriendRequest(String(requestId || ''))
  }

  @Get('transfer-targets')
  getTransferTargets(@Query() query: TransferTargetsQueryDto) {
    return this.chatService.getTransferTargets(query)
  }

  @Get('group-candidates')
  getGroupCandidates() {
    return this.chatService.getGroupCandidates()
  }

  @Get('messages/:id')
  getMessages(
    @Param('id', ParseIntPipe) chatId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getMessages(chatId, Number(page || '1'), Number(limit || '20'))
  }

  @Post('send')
  sendMessage(@Body() body: { chatId: number; text: string }) {
    return this.chatService.sendMessage(Number(body.chatId), String(body.text || ''))
  }

  @Post('transfer')
  sendTransfer(@Body() body: ChatTransferDto) {
    return this.chatService.sendTransfer(body)
  }

  @Post('groups')
  createGroup(@Body() body: CreateGroupDto) {
    return this.chatService.createGroup(body)
  }
}
