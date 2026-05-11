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
  @IsString()
  username?: string
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
  @IsOptional()
  @IsString()
  username?: string
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

  @IsOptional()
  @IsString()
  username?: string
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

  @IsOptional()
  @IsString()
  username?: string
}

class FriendRequestRejectDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string
}

class CreateGroupDto {
  @IsOptional()
  @IsString()
  username?: string
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

  @IsOptional()
  @IsString()
  username?: string
}

class GroupRenameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name!: string

  @IsOptional()
  @IsString()
  username?: string
}

class GroupMemberDto {
  @IsString()
  @IsNotEmpty()
  memberUserId!: string

  @IsOptional()
  @IsString()
  username?: string
}

class GroupSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  name?: string

  @IsOptional()
  @IsString()
  avatarUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notice?: string

  @IsOptional()
  mutedAll?: boolean

  @IsOptional()
  @IsString()
  username?: string
}

class GroupNicknameDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  groupNickname?: string

  @IsOptional()
  notificationMuted?: boolean

  @IsOptional()
  @IsString()
  username?: string
}

class GroupInviteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((item) => String(item || '').trim()).filter((item) => item.length > 0)
      : [],
  )
  memberIds!: string[]

  @IsOptional()
  @IsString()
  username?: string
}

class GroupMuteDto {
  @IsString()
  @IsNotEmpty()
  memberUserId!: string

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  durationMinutes!: number

  @IsOptional()
  @IsString()
  username?: string
}

class GroupTransferOwnerDto {
  @IsString()
  @IsNotEmpty()
  toUserId!: string

  @IsOptional()
  @IsString()
  username?: string
}

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('list')
  getChatList(@Query('username') username?: string) {
    return this.chatService.getChatList(username)
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
    return this.chatService.searchFriends(query.keyword || '', query.username)
  }

  @Get('friend-profile/:id')
  getFriendProfile(@Param('id') id: string) {
    return this.chatService.getFriendProfile(String(id || ''))
  }

  @Post('friend-request')
  sendFriendRequest(@Body() body: FriendRequestDto) {
    return this.chatService.sendFriendRequest(body, body.username)
  }

  @Post('friend-request/:requestId/confirm')
  confirmFriendRequest(@Param('requestId') requestId: string, @Body('username') username?: string) {
    return this.chatService.confirmFriendRequest(String(requestId || ''), username)
  }

  @Post('friend-request/:requestId/reject')
  rejectFriendRequest(@Param('requestId') requestId: string, @Body() body: FriendRequestRejectDto & { username?: string }) {
    return this.chatService.rejectFriendRequest(String(requestId || ''), body.note, body.username)
  }

  @Get('friend-requests/pending')
  getPendingFriendRequests(@Query('username') username?: string) {
    return this.chatService.getPendingFriendRequests(username)
  }

  @Get('transfer-targets')
  getTransferTargets(@Query() query: TransferTargetsQueryDto) {
    return this.chatService.getTransferTargets(query)
  }

  @Get('group-candidates')
  getGroupCandidates(@Query('username') username?: string) {
    return this.chatService.getGroupCandidates(username)
  }

  @Get('messages/:id')
  getMessages(
    @Param('id', ParseIntPipe) chatId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('username') username?: string,
  ) {
    return this.chatService.getMessages(chatId, Number(page || '1'), Number(limit || '20'), username)
  }

  @Post('read/:id')
  markChatRead(@Param('id', ParseIntPipe) chatId: number, @Body('username') username?: string) {
    return this.chatService.markChatRead(chatId, username)
  }

  @Post('send')
  sendMessage(@Body() body: { chatId: number; text: string; username?: string }) {
    return this.chatService.sendMessage(Number(body.chatId), String(body.text || ''), body.username)
  }

  @Post('transfer')
  sendTransfer(@Body() body: ChatTransferDto) {
    return this.chatService.sendTransfer(body)
  }

  @Post('groups')
  createGroup(@Body() body: CreateGroupDto) {
    return this.chatService.createGroup(body, body.username)
  }

  @Get('groups/:id/members')
  getGroupMembers(@Param('id', ParseIntPipe) chatId: number, @Query('username') username?: string) {
    return this.chatService.getGroupMembers(chatId, username)
  }

  @Post('groups/:id/rename')
  renameGroup(@Param('id', ParseIntPipe) chatId: number, @Body() body: GroupRenameDto) {
    return this.chatService.renameGroup(chatId, body.name, body.username)
  }

  @Post('groups/:id/leave')
  leaveGroup(@Param('id', ParseIntPipe) chatId: number, @Body('username') username?: string) {
    return this.chatService.leaveGroup(chatId, username)
  }

  @Post('groups/:id/remove-member')
  removeGroupMember(@Param('id', ParseIntPipe) chatId: number, @Body() body: GroupMemberDto) {
    return this.chatService.removeGroupMember(chatId, body.memberUserId, body.username)
  }

  @Get('groups/:id/settings')
  getGroupSettings(@Param('id', ParseIntPipe) chatId: number, @Query('username') username?: string) {
    return this.chatService.getGroupSettings(chatId, username)
  }

  @Post('groups/:id/settings')
  updateGroupSettings(@Param('id', ParseIntPipe) chatId: number, @Body() body: GroupSettingsDto) {
    return this.chatService.updateGroupSettings(chatId, body, body.username)
  }

  @Post('groups/:id/my-profile')
  updateMyGroupProfile(@Param('id', ParseIntPipe) chatId: number, @Body() body: GroupNicknameDto) {
    return this.chatService.updateMyGroupProfile(chatId, body, body.username)
  }

  @Post('groups/:id/invite')
  inviteGroupMembers(@Param('id', ParseIntPipe) chatId: number, @Body() body: GroupInviteDto) {
    return this.chatService.inviteGroupMembers(chatId, body.memberIds, body.username)
  }

  @Post('groups/:id/clear-history')
  clearGroupHistory(@Param('id', ParseIntPipe) chatId: number, @Body('username') username?: string) {
    return this.chatService.clearGroupHistory(chatId, username)
  }

  @Post('groups/:id/mute-member')
  muteGroupMember(@Param('id', ParseIntPipe) chatId: number, @Body() body: GroupMuteDto) {
    return this.chatService.muteGroupMember(chatId, body.memberUserId, body.durationMinutes, body.username)
  }

  @Post('groups/:id/transfer-owner')
  transferGroupOwner(@Param('id', ParseIntPipe) chatId: number, @Body() body: GroupTransferOwnerDto) {
    return this.chatService.transferGroupOwner(chatId, body.toUserId, body.username)
  }

  @Post('groups/:id/dissolve')
  dissolveGroup(@Param('id', ParseIntPipe) chatId: number, @Body('username') username?: string) {
    return this.chatService.dissolveGroup(chatId, username)
  }
}
