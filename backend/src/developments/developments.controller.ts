import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../common/multer.config';
import { DevelopmentsService } from './developments.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@Controller('developments')
export class DevelopmentsController {
  constructor(
    private developments: DevelopmentsService,
    private cloudinary: CloudinaryService,
  ) {}

  @Public()
  @Get()
  findAll() {
    return this.developments.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.developments.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  create(
    @Body()
    dto: {
      name: string;
      slug?: string;
      description?: string;
      address?: string;
      city: string;
      state?: string;
      neighborhood?: string;
      zipCode?: string;
      latitude?: number;
      longitude?: number;
      placeId?: string;
      polygonCoordinates?: unknown;
      coverImage?: string | null;
      coverImageAlt?: string | null;
    },
  ) {
    return this.developments.create(dto);
  }

  @Post(':id/cover')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadCover(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    const { url, publicId } = await this.cloudinary.uploadImage(file, 'imobflow/developments');
    return this.developments.setCover(id, url, publicId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body()
    dto: {
      name?: string;
      description?: string;
      address?: string;
      city?: string;
      state?: string;
      neighborhood?: string;
      zipCode?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      placeId?: string | null;
      polygonCoordinates?: unknown | null;
      coverImage?: string | null;
      coverImageAlt?: string | null;
      slug?: string | null;
    },
  ) {
    return this.developments.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORRETOR, UserRole.ADMIN)
  delete(@Param('id') id: string) {
    return this.developments.delete(id);
  }
}
