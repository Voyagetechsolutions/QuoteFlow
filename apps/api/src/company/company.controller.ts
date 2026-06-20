import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CompanyService, UpdateCompanyDto } from './company.service';
import { CompanyId } from '../auth/current-user.decorator';

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size?: number;
}

@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  get(@CompanyId() companyId: string) {
    return this.companyService.get(companyId);
  }

  @Patch()
  updateName(@CompanyId() companyId: string, @Body() body: UpdateCompanyDto) {
    return this.companyService.updateName(companyId, body.name);
  }

  /** Upload a company logo (image, <=1 MB) — stored as a data URL, shown on PDFs. */
  @Post('logo')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 1024 * 1024, files: 1 },
      fileFilter: (_req, file, cb) => {
        const ok = /image\/(png|jpe?g|webp|svg\+xml|gif)/.test(file.mimetype);
        cb(ok ? null : new BadRequestException('Logo must be an image.'), ok);
      },
    }),
  )
  uploadLogo(@CompanyId() companyId: string, @UploadedFile() file?: UploadedImage) {
    if (!file) throw new BadRequestException('No file uploaded (field "file").');
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    return this.companyService.setLogo(companyId, dataUrl);
  }

  @Delete('logo')
  clearLogo(@CompanyId() companyId: string) {
    return this.companyService.setLogo(companyId, null);
  }
}
