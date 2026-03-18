import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../common/multer.config';
import { PropertiesService } from './properties.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PropertyType, PropertyStatus, UserRole } from '@prisma/client';
import { CreatePropertyDto } from './dto/create-property.dto';

@Controller('properties')
export class PropertiesController {
  constructor(
    private properties: PropertiesService,
    private cloudinary: CloudinaryService,
  ) {}

  @Public()
  @Get('public')
  findAllPublic(
    @Query('city') city?: string,
    @Query('neighborhood') neighborhood?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('type') type?: PropertyType,
    @Query('status') status?: PropertyStatus,
    @Query('search') search?: string,
  ) {
    return this.properties.findAllPublic({
      city,
      neighborhood,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      type,
      status,
      search,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  findAllMine(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.properties.findAllByUser(userId, role);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.properties.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: unknown,
    @Req() req: { ip?: string },
  ) {
    return this.properties.create(userId, dto as CreatePropertyDto, req.ip);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: Partial<CreatePropertyDto>,
    @Req() req: { ip?: string },
  ) {
    return this.properties.update(id, userId, role, dto, req.ip);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Req() req: { ip?: string },
  ) {
    return this.properties.delete(id, userId, role, req.ip);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async addImage(
    @Param('id') propertyId: string,
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const { url, publicId } = await this.cloudinary.uploadImage(file);
    return this.properties.addImage(propertyId, url, publicId, userId);
  }

  @Delete(':id/images/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  removeImage(
    @Param('id') propertyId: string,
    @Param('imageId') imageId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.properties.removeImage(propertyId, imageId, userId);
  }

  @Post(':id/generate-description')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  generateDescription(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.properties.generateDescription(id, userId);
  }
}
