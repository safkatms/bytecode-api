import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
    private readonly logger = new Logger(CloudinaryService.name);

    constructor(config: ConfigService) {
        cloudinary.config({
            cloud_name: config.get<string>('CLOUDINARY_CLOUD_NAME'),
            api_key: config.get<string>('CLOUDINARY_API_KEY'),
            api_secret: config.get<string>('CLOUDINARY_API_SECRET'),
            secure: true,
        });
    }

    /** Uploads an image buffer; `publicId` makes re-uploads overwrite the previous image. */
    uploadImage(buffer: Buffer, folder: string, publicId: string): Promise<UploadApiResponse> {
        return new Promise((resolve, reject) => {
            cloudinary.uploader
                .upload_stream(
                    {
                        folder,
                        public_id: publicId,
                        overwrite: true,
                        invalidate: true,
                        resource_type: 'image',
                        transformation: [{ width: 512, height: 512, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
                    },
                    (err, result) => {
                        if (err || !result) {
                            this.logger.error(`Cloudinary upload failed: ${err?.message ?? 'no result'}`);
                            return reject(new BadRequestException(`Image upload failed: ${err?.message ?? 'unknown error'}`));
                        }
                        resolve(result);
                    },
                )
                .end(buffer);
        });
    }
}
