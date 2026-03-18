import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll(@Query('role') role?: UserRole) {
    return this.users.findAll(role);
  }

  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.users.findById(userId);
  }

  @Patch('me')
  updateProfile(@CurrentUser('id') userId: string, @Body() body: { name?: string; phone?: string }) {
    return this.users.updateProfile(userId, body);
  }

  @Patch('me/password')
  updatePassword(
    @CurrentUser('id') userId: string,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.users.updatePassword(userId, body.currentPassword, body.newPassword);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.users.findById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  adminUpdate(
    @Param('id') id: string,
    @Body() body: { name?: string; role?: UserRole; isActive?: boolean },
    @CurrentUser('id') adminId: string,
  ) {
    return this.users.adminUpdate(id, body, adminId);
  }
}
