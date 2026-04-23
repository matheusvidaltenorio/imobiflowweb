import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { multerConfig } from '../common/multer.config';
import { multerSpreadsheetConfig } from '../common/multer-spreadsheet.config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { DailyAvailabilityService } from './daily-availability.service';
import { LotImageMapService } from './lot-image-map.service';
import { SpreadsheetAvailabilityImportService } from './spreadsheet/spreadsheet-import.service';
import type { SpreadsheetColumnMapping } from './spreadsheet/spreadsheet-parsing.service';
import {
  BulkSnapshotDto,
  CreateSnapshotDto,
  ParseCsvDto,
  ResetDayDto,
} from './dto/create-snapshot.dto';
import { QueryHistoryDto, QueryTodayDto } from './dto/query-today.dto';
import { GestoraAccessService } from '../gestora/gestora-access.service';

@Controller('daily-availability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DailyAvailabilityController {
  constructor(
    private readonly service: DailyAvailabilityService,
    private readonly cloudinary: CloudinaryService,
    private readonly imageMap: LotImageMapService,
    private readonly spreadsheetImport: SpreadsheetAvailabilityImportService,
    private readonly gestoraAccess: GestoraAccessService,
  ) {}

  /** Snapshot opts quando o ator é gestora (aprovação imediata vs pendente). */
  private async gestoraSnapshotOpts(userId: string, role: UserRole, developmentId: string) {
    if (role !== UserRole.GESTORA) return undefined;
    await this.gestoraAccess.assertCanAccessDevelopment(userId, role, developmentId);
    const access = await this.gestoraAccess.getAccess(userId, developmentId);
    if (!access) throw new ForbiddenException('Sem vínculo com este loteamento');
    const st = this.gestoraAccess.submissionStatusForNewSnapshot(access.publishMode);
    return st != null ? { gestoraSubmissionStatus: st } : undefined;
  }

  /** Corretores, admin e gestora: visão operacional do dia (gestora: só loteamentos autorizados via filtro). */
  @Get('today')
  @Roles(UserRole.CORRETOR, UserRole.ADMIN, UserRole.GESTORA)
  async today(@Query() q: QueryTodayDto, @CurrentUser('id') userId: string, @CurrentUser('role') role: UserRole) {
    if (role === UserRole.GESTORA && q.developmentId) {
      await this.gestoraAccess.assertCanAccessDevelopment(userId, role, q.developmentId);
    }
    if (role === UserRole.GESTORA && !q.developmentId) {
      throw new BadRequestException('Gestora: informe developmentId para consultar disponíveis hoje');
    }
    return this.service.getTodayBrokerView({
      developmentId: q.developmentId,
      blockId: q.blockId,
      dateIso: q.date,
      minPrice: q.minPrice,
      maxPrice: q.maxPrice,
      minArea: q.minArea,
      maxArea: q.maxArea,
    });
  }

  @Get('developments/:developmentId/current')
  @Roles(UserRole.CORRETOR, UserRole.ADMIN, UserRole.GESTORA)
  async current(
    @Param('developmentId') developmentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('date') date?: string,
  ) {
    const visibility =
      role === UserRole.GESTORA ? 'all' : 'published';
    if (role === UserRole.GESTORA) {
      await this.gestoraAccess.assertCanAccessDevelopment(userId, role, developmentId);
    }
    return this.service.getCurrent(developmentId, date, { visibility });
  }

  @Get('developments/:developmentId/latest-before')
  @Roles(UserRole.CORRETOR, UserRole.ADMIN, UserRole.GESTORA)
  async latestBefore(
    @Param('developmentId') developmentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('before') before: string,
  ) {
    if (!before || !/^\d{4}-\d{2}-\d{2}$/.test(before)) {
      throw new BadRequestException('before (YYYY-MM-DD) é obrigatório');
    }
    const visibility = role === UserRole.GESTORA ? 'all' : 'published';
    if (role === UserRole.GESTORA) {
      await this.gestoraAccess.assertCanAccessDevelopment(userId, role, developmentId);
    }
    return this.service.getLatestBeforeDate(developmentId, before, { visibility });
  }

  @Get('developments/:developmentId/history')
  @Roles(UserRole.CORRETOR, UserRole.ADMIN, UserRole.GESTORA)
  async history(
    @Param('developmentId') developmentId: string,
    @Query() q: QueryHistoryDto,
    @CurrentUser('role') role: UserRole,
    @CurrentUser('id') userId: string,
  ) {
    if (role === UserRole.GESTORA) {
      await this.gestoraAccess.assertCanAccessDevelopment(userId, role, developmentId);
    }
    const includePending = role === UserRole.ADMIN || role === UserRole.GESTORA;
    return this.service.getHistory(developmentId, q.limit ?? 40, q.date, {
      includePendingSubmissions: includePending,
    });
  }

  @Get('developments/:developmentId/lots/:lotId/history')
  @Roles(UserRole.CORRETOR, UserRole.ADMIN, UserRole.GESTORA)
  async lotHistory(
    @Param('developmentId') developmentId: string,
    @Param('lotId') lotId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Query('limit') limit?: string,
  ) {
    if (role === UserRole.GESTORA) {
      await this.gestoraAccess.assertCanAccessDevelopment(userId, role, developmentId);
    }
    const n = limit ? parseInt(limit, 10) : 30;
    return this.service.getLotHistory(developmentId, lotId, Number.isFinite(n) ? n : 30, {
      publishedSnapshotsOnly: role === UserRole.CORRETOR,
    });
  }

  @Post('developments/:developmentId/snapshot')
  @Roles(UserRole.ADMIN, UserRole.GESTORA)
  async createSnapshot(
    @Param('developmentId') developmentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: CreateSnapshotDto,
  ) {
    const g = await this.gestoraSnapshotOpts(userId, role, developmentId);
    return this.service.createSnapshot(developmentId, userId, dto, g);
  }

  @Post('developments/:developmentId/image')
  @Roles(UserRole.ADMIN, UserRole.GESTORA)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadImage(
    @Param('developmentId') developmentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { date?: string; notes?: string; rawText?: string },
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    const date = body.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date (YYYY-MM-DD) é obrigatório');
    }
    if (role === UserRole.GESTORA) {
      await this.gestoraAccess.assertCanAccessDevelopment(userId, role, developmentId);
      const a = await this.gestoraAccess.getAccess(userId, developmentId);
      if (!a?.assistedImageEnabled) {
        throw new ForbiddenException('Imagem assistida não habilitada para este vínculo');
      }
    }
    const { url } = await this.cloudinary.uploadImage(file, 'imobflow/daily-availability');
    const g = await this.gestoraSnapshotOpts(userId, role, developmentId);
    return this.service.uploadImageAndCreateShell(
      developmentId,
      userId,
      { date, notes: body.notes, rawText: body.rawText },
      url,
      g,
    );
  }

  @Post('developments/:developmentId/parse-csv')
  @Roles(UserRole.ADMIN)
  parseCsv(@Body() dto: ParseCsvDto) {
    return this.service.parseCsvPreview(dto.csvText);
  }

  @Post('developments/:developmentId/spreadsheet/analyze')
  @Roles(UserRole.ADMIN, UserRole.GESTORA)
  @UseInterceptors(FileInterceptor('file', multerSpreadsheetConfig))
  async spreadsheetAnalyze(
    @Param('developmentId') developmentId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    if (role === UserRole.GESTORA) {
      await this.gestoraAccess.assertCanAccessDevelopment(userId, role, developmentId);
    }
    return this.spreadsheetImport.analyze(developmentId, file);
  }

  @Post('developments/:developmentId/spreadsheet/preview')
  @Roles(UserRole.ADMIN, UserRole.GESTORA)
  @UseInterceptors(FileInterceptor('file', multerSpreadsheetConfig))
  async spreadsheetPreview(
    @Param('developmentId') developmentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { columnMapping: string; date: string },
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      throw new BadRequestException('date (YYYY-MM-DD) é obrigatório');
    }
    if (role === UserRole.GESTORA) {
      await this.gestoraAccess.assertCanAccessDevelopment(userId, role, developmentId);
    }
    let mapping: SpreadsheetColumnMapping = {};
    try {
      mapping = JSON.parse(body.columnMapping || '{}') as SpreadsheetColumnMapping;
    } catch {
      throw new BadRequestException('columnMapping deve ser JSON válido');
    }
    return this.spreadsheetImport.preview(developmentId, file, mapping, body.date);
  }

  @Post('developments/:developmentId/spreadsheet/confirm')
  @Roles(UserRole.ADMIN, UserRole.GESTORA)
  @UseInterceptors(FileInterceptor('file', multerSpreadsheetConfig))
  async spreadsheetConfirm(
    @Param('developmentId') developmentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      columnMapping: string;
      date: string;
      templateId?: string;
      saveTemplateJson?: string;
    },
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      throw new BadRequestException('date (YYYY-MM-DD) é obrigatório');
    }
    if (role === UserRole.GESTORA) {
      await this.gestoraAccess.assertCanAccessDevelopment(userId, role, developmentId);
      const a = await this.gestoraAccess.getAccess(userId, developmentId);
      if (!a?.spreadsheetImportEnabled) {
        throw new ForbiddenException('Importação por planilha não habilitada para este vínculo');
      }
    }
    let mapping: SpreadsheetColumnMapping = {};
    try {
      mapping = JSON.parse(body.columnMapping || '{}') as SpreadsheetColumnMapping;
    } catch {
      throw new BadRequestException('columnMapping deve ser JSON válido');
    }
    let saveTemplate: { name: string; gestoraLabel?: string } | undefined;
    if (body.saveTemplateJson) {
      if (role === UserRole.GESTORA) {
        throw new BadRequestException('Gestora não pode criar templates globais por esta rota');
      }
      try {
        saveTemplate = JSON.parse(body.saveTemplateJson) as { name: string; gestoraLabel?: string };
      } catch {
        throw new BadRequestException('saveTemplateJson inválido');
      }
    }
    const g = await this.gestoraSnapshotOpts(userId, role, developmentId);
    return this.spreadsheetImport.confirm(developmentId, userId, file, mapping, body.date, {
      templateId: body.templateId,
      saveTemplate,
      gestoraSubmissionStatus: g?.gestoraSubmissionStatus,
    });
  }

  @Get('developments/:developmentId/spreadsheet-templates')
  @Roles(UserRole.ADMIN, UserRole.GESTORA)
  async spreadsheetTemplatesList(
    @Param('developmentId') developmentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    if (role === UserRole.GESTORA) {
      await this.gestoraAccess.assertCanAccessDevelopment(userId, role, developmentId);
    }
    return this.spreadsheetImport.listTemplates(developmentId);
  }

  @Post('developments/:developmentId/spreadsheet-templates')
  @Roles(UserRole.ADMIN)
  spreadsheetTemplateCreate(
    @Param('developmentId') developmentId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { name: string; gestoraLabel?: string; columnMapping: SpreadsheetColumnMapping },
  ) {
    return this.spreadsheetImport.createTemplate(developmentId, userId, body);
  }

  @Put('developments/:developmentId/spreadsheet-templates/:templateId')
  @Roles(UserRole.ADMIN)
  spreadsheetTemplateUpdate(
    @Param('developmentId') developmentId: string,
    @Param('templateId') templateId: string,
    @Body() body: { name?: string; gestoraLabel?: string; columnMapping?: SpreadsheetColumnMapping },
  ) {
    return this.spreadsheetImport.updateTemplate(developmentId, templateId, body);
  }

  @Delete('developments/:developmentId/spreadsheet-templates/:templateId')
  @Roles(UserRole.ADMIN)
  spreadsheetTemplateDelete(
    @Param('developmentId') developmentId: string,
    @Param('templateId') templateId: string,
  ) {
    return this.spreadsheetImport.deleteTemplate(developmentId, templateId);
  }

  @Post('developments/:developmentId/bulk')
  @Roles(UserRole.ADMIN, UserRole.GESTORA)
  async bulk(
    @Param('developmentId') developmentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: BulkSnapshotDto,
  ) {
    const g = await this.gestoraSnapshotOpts(userId, role, developmentId);
    return this.service.bulkApply(developmentId, userId, dto, g);
  }

  @Post('developments/:developmentId/reset-day')
  @Roles(UserRole.ADMIN, UserRole.GESTORA)
  async reset(
    @Param('developmentId') developmentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: ResetDayDto,
  ) {
    const g = await this.gestoraSnapshotOpts(userId, role, developmentId);
    return this.service.resetDay(developmentId, userId, dto, g);
  }

  @Get('developments/:developmentId/image-map')
  @Roles(UserRole.ADMIN, UserRole.GESTORA)
  async imageMapList(
    @Param('developmentId') developmentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    if (role === UserRole.GESTORA) {
      await this.gestoraAccess.assertCanAccessDevelopment(userId, role, developmentId);
    }
    return this.imageMap.listByDevelopment(developmentId);
  }

  @Put('developments/:developmentId/image-map')
  @Roles(UserRole.ADMIN, UserRole.GESTORA)
  imageMapPut(
    @Param('developmentId') developmentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body()
    body: {
      items: Array<{
        lotId: string;
        xNorm: number;
        yNorm: number;
        wNorm?: number;
        hNorm?: number;
        refImageWidth?: number;
        refImageHeight?: number;
      }>;
    },
  ) {
    return (async () => {
      if (role === UserRole.GESTORA) {
        await this.gestoraAccess.assertCanAccessDevelopment(userId, role, developmentId);
        const a = await this.gestoraAccess.getAccess(userId, developmentId);
        if (!a?.assistedImageEnabled) {
          throw new ForbiddenException('Mapa visual não habilitado para este vínculo');
        }
      }
      return this.imageMap.upsertBatch(developmentId, userId, body.items ?? []);
    })();
  }

  @Delete('developments/:developmentId/image-map/:lotId')
  @Roles(UserRole.ADMIN, UserRole.GESTORA)
  imageMapDelete(
    @Param('developmentId') developmentId: string,
    @Param('lotId') lotId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return (async () => {
      if (role === UserRole.GESTORA) {
        await this.gestoraAccess.assertCanAccessDevelopment(userId, role, developmentId);
        const a = await this.gestoraAccess.getAccess(userId, developmentId);
        if (!a?.assistedImageEnabled) {
          throw new ForbiddenException('Mapa visual não habilitado para este vínculo');
        }
      }
      return this.imageMap.deleteByLot(developmentId, lotId);
    })();
  }

  @Post(':id/approve-gestora-submission')
  @Roles(UserRole.ADMIN)
  approveGestora(@Param('id') id: string, @CurrentUser('id') adminId: string) {
    return this.service.approveGestoraSubmission(id, adminId);
  }

  @Post(':id/reject-gestora-submission')
  @Roles(UserRole.ADMIN)
  rejectGestora(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body() body: { notes?: string },
  ) {
    return this.service.rejectGestoraSubmission(id, adminId, body?.notes);
  }

  @Get(':id')
  @Roles(UserRole.CORRETOR, UserRole.ADMIN, UserRole.GESTORA)
  one(
    @Param('id') id: string,
    @CurrentUser('role') role: UserRole,
    @CurrentUser('id') userId: string,
  ) {
    return (async () => {
      const row = await this.service.getOne(id, { role });
      if (role === UserRole.GESTORA) {
        await this.gestoraAccess.assertCanAccessDevelopment(userId, role, row.developmentId);
      }
      return row;
    })();
  }
}
