import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CORRETOR, UserRole.CLIENTE)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  list(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.chat.listMine(userId, role);
  }

  @Get('unread-count')
  unread(@CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    return this.chat.unreadTotal(userId, role).then((count) => ({ count }));
  }

  @Post('conversations/by-lead/:leadId')
  ensureByLead(
    @Param('leadId') leadId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.chat.ensureLeadConversation(leadId, userId, role);
  }

  @Post('conversations/by-lot')
  ensureByLot(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: { lotId: string; clientUserId: string },
  ) {
    return this.chat.ensureLotConversation(body.lotId, body.clientUserId, userId, role);
  }

  @Get('conversations/:id')
  one(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.chat.getConversation(id, userId, role);
  }

  @Get('conversations/:id/messages')
  messages(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('cursor') cursor?: string,
  ) {
    return this.chat.getMessages(id, userId, role, cursor);
  }

  @Post('conversations/:id/messages')
  postMessage(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: { content: string },
  ) {
    return this.chat.postMessage(id, userId, role, body.content);
  }

  @Post('conversations/:id/read')
  read(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.chat.markRead(id, userId, role);
  }

  @Post('conversations/:id/whatsapp-handoff')
  waHandoff(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: { phone?: string },
  ) {
    return this.chat.whatsappHandoff(id, userId, role, body.phone);
  }

  @Post('conversations/:id/actions/schedule-visit')
  actVisit(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: { scheduledAt: string; notes?: string },
  ) {
    return this.chat.actionScheduleVisit(id, userId, role, body);
  }

  @Post('conversations/:id/actions/proposal')
  actProposal(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.chat.actionProposal(id, userId, role);
  }

  @Post('conversations/:id/actions/reserve-lot')
  actReserve(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.chat.actionReserveLot(id, userId, role);
  }

  @Post('conversations/:id/actions/catalog')
  actCatalog(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.chat.actionCatalog(id, userId, role);
  }

  @Post('conversations/:id/actions/simulation')
  actSim(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.chat.actionSimulation(id, userId, role);
  }
}
