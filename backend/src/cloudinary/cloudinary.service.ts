import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@Injectable()
export class CloudinaryService {
  constructor(private config: ConfigService) {
    cloudinary.config({
      cloud_name: config.get('CLOUDINARY_CLOUD_NAME'),
      api_key: config.get('CLOUDINARY_API_KEY'),
      api_secret: config.get('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(file: Express.Multer.File, folder = 'imobflow'): Promise<{ url: string; publicId: string }> {
    if (!file) throw new BadRequestException('Arquivo não enviado');

    if (file.size > MAX_SIZE) {
      throw new BadRequestException('Imagem deve ter no máximo 5MB');
    }

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Formato inválido. Use JPEG, PNG, WebP ou GIF');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
        },
        (error, result) => {
          if (error) reject(new BadRequestException('Erro no upload: ' + error.message));
          else if (result)
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          else reject(new BadRequestException('Upload falhou'));
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}
