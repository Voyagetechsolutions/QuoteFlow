import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);

/** Minimal shape of a memory-storage Multer file (avoids a @types/multer dep). */
export interface UploadedRateSheet {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
  size?: number;
}

/**
 * Bridges the API to the Python extraction spike. Writes the uploaded file to
 * a temp path, runs spike/extract_any.py against it, and returns the parsed
 * ExtractionResult (already camelCased to match @quoteflow/shared).
 *
 * This is the PRD's "pdfplumber Python microservice", run in-process via
 * child_process for the demo rather than as a separate service.
 */
@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  // dist/rate-sets -> repo root (apps/api/dist/rate-sets => up 4)
  private readonly repoRoot = path.resolve(__dirname, '../../../..');

  private get pythonBin(): string {
    return (
      process.env.EXTRACTION_PYTHON ??
      path.join(this.repoRoot, 'spike', '.venv', 'Scripts', 'python.exe')
    );
  }

  private get script(): string {
    return (
      process.env.EXTRACTION_SCRIPT ??
      path.join(this.repoRoot, 'spike', 'extract_any.py')
    );
  }

  async extract(file: UploadedRateSheet): Promise<unknown> {
    const ext = path.extname(file.originalname) || '';
    const tmp = path.join(os.tmpdir(), `qf-extract-${randomUUID()}${ext}`);
    await fs.writeFile(tmp, file.buffer);

    try {
      const { stdout } = await execFileAsync(
        this.pythonBin,
        [this.script, tmp, '--name', file.originalname],
        { maxBuffer: 32 * 1024 * 1024, cwd: path.join(this.repoRoot, 'spike') },
      );
      return JSON.parse(stdout);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`extraction failed for ${file.originalname}: ${message}`);
      throw new InternalServerErrorException(
        `Could not extract rates from "${file.originalname}". ${message}`,
      );
    } finally {
      fs.unlink(tmp).catch(() => undefined);
    }
  }
}
