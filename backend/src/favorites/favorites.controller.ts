import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('favorites')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENTE, UserRole.CORRETOR, UserRole.ADMIN)
export class FavoritesController {
  constructor(private favorites: FavoritesService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.favorites.findAll(userId);
  }

  @Get('check/:propertyId')
  check(@CurrentUser('id') userId: string, @Param('propertyId') propertyId: string) {
    return this.favorites.isFavorite(userId, propertyId);
  }

  @Post(':propertyId')
  add(@CurrentUser('id') userId: string, @Param('propertyId') propertyId: string) {
    return this.favorites.add(userId, propertyId);
  }

  @Delete(':propertyId')
  remove(@CurrentUser('id') userId: string, @Param('propertyId') propertyId: string) {
    return this.favorites.remove(userId, propertyId);
  }
}
