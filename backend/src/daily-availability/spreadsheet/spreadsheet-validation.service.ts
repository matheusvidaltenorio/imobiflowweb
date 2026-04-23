import { BadRequestException, Injectable } from '@nestjs/common';
import { DailyAvailabilitySourceType } from '@prisma/client';
import { SpreadsheetColumnMapping } from './spreadsheet-parsing.service';

const MAX_DATA_ROWS = 10_000;

/**
 * Validações de importação de disponibilidade (arquivo + mapeamento).
 * Mantém regras centralizadas para preview e confirm.
 */
@Injectable()
export class SpreadsheetValidationService {
  assertMappingComplete(m: SpreadsheetColumnMapping) {
    if (!m.block?.trim() || !m.lotNumber?.trim()) {
      throw new BadRequestException('Mapeamento deve incluir colunas de quadra e lote');
    }
    if (!m.status?.trim()) {
      throw new BadRequestException('Mapeamento deve incluir coluna de status');
    }
  }

  assertDataRowLimit(totalRowsIncludingHeader: number) {
    if (totalRowsIncludingHeader > MAX_DATA_ROWS + 1) {
      throw new BadRequestException(`Limite de ${MAX_DATA_ROWS} linhas de dados excedido`);
    }
  }

  /** CSV puro vs planilha binária (xlsx/xls) para rastreio em DailyAvailability.sourceType. */
  resolveSourceType(file: Express.Multer.File): DailyAvailabilitySourceType {
    const name = file.originalname?.toLowerCase() ?? '';
    const mime = file.mimetype?.toLowerCase() ?? '';
    if (name.endsWith('.csv') || mime.includes('csv') || mime === 'text/plain') {
      return DailyAvailabilitySourceType.CSV;
    }
    return DailyAvailabilitySourceType.SPREADSHEET;
  }
}

export { MAX_DATA_ROWS };
