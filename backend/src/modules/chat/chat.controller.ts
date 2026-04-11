import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ChatService } from './chat.service'

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('list')
  getChatList() {
    return this.chatService.getChatList()
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
}
