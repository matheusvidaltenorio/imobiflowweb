import { memoryStorage } from 'multer';

export const multerAudioConfig = {
  storage: memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: { mimetype: string }, cb: (err: Error | null, acceptFile: boolean) => void) => {
    const allowed = [
      'audio/webm',
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/x-m4a',
      'audio/ogg',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
};
