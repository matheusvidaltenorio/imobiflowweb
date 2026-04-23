import { memoryStorage } from 'multer';

const MAX = 15 * 1024 * 1024; // 15MB

export const multerSpreadsheetConfig = {
  storage: memoryStorage(),
  limits: { fileSize: MAX },
  fileFilter: (
    _req: unknown,
    file: { mimetype: string; originalname: string },
    cb: (err: Error | null, acceptFile: boolean) => void,
  ) => {
    const name = file.originalname?.toLowerCase() ?? '';
    const okMime = [
      'text/csv',
      'text/plain',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ].includes(file.mimetype);
    const okExt = /\.(csv|xlsx|xls)$/i.test(name);
    cb(null, okMime || okExt);
  },
};
