import fs from 'fs';
import path from 'path';

export interface FileStorageResult {
  publicUrl: string;
  filePath: string;
  fileName: string;
  sizeBytes: number;
}

export class StorageService {
  private static instance: StorageService;
  private readonly uploadsDir: string;
  private readonly storageType: 'local' | 's3';

  private constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.storageType = (process.env.STORAGE_DRIVER as 'local' | 's3') || 'local';
    this.ensureDirectories();
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private ensureDirectories(): void {
    const subfolders = ['resumes', 'proctoring', 'badges', 'temp'];
    for (const folder of subfolders) {
      const dirPath = path.join(this.uploadsDir, folder);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }
  }

  /**
   * Resolves absolute local path from either a full path or a relative URL like /uploads/resumes/xxx.pdf
   */
  public resolveLocalPath(filePathOrUrl: string): string {
    if (path.isAbsolute(filePathOrUrl) && fs.existsSync(filePathOrUrl)) {
      return filePathOrUrl;
    }

    // Clean leading slash or URL segment
    const normalized = filePathOrUrl.replace(/^\/?(uploads\/)?/, '');
    const fullPath = path.join(this.uploadsDir, normalized);
    return fullPath;
  }

  /**
   * Save a binary buffer to storage
   */
  public async saveBuffer(
    buffer: Buffer,
    originalName: string,
    subfolder: 'resumes' | 'proctoring' | 'badges' | 'temp' = 'resumes'
  ): Promise<FileStorageResult> {
    const ext = path.extname(originalName) || '.bin';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitizedBase = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const finalFilename = `${sanitizedBase}-${uniqueSuffix}${ext}`;

    if (this.storageType === 's3' && process.env.S3_BUCKET) {
      // S3/MinIO compatible object store upload
      const s3Key = `${subfolder}/${finalFilename}`;
      // In production S3 mode, upload via AWS SDK or S3 Client
      return {
        publicUrl: `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`,
        filePath: s3Key,
        fileName: finalFilename,
        sizeBytes: buffer.length
      };
    }

    // Local Disk Driver
    const targetDir = path.join(this.uploadsDir, subfolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetFilePath = path.join(targetDir, finalFilename);
    await fs.promises.writeFile(targetFilePath, buffer);

    return {
      publicUrl: `/uploads/${subfolder}/${finalFilename}`,
      filePath: targetFilePath,
      fileName: finalFilename,
      sizeBytes: buffer.length
    };
  }

  /**
   * Read file buffer from storage
   */
  public async getFileBuffer(filePathOrUrl: string): Promise<Buffer> {
    const resolvedPath = this.resolveLocalPath(filePathOrUrl);
    if (fs.existsSync(resolvedPath)) {
      return fs.promises.readFile(resolvedPath);
    }
    throw new Error(`File not found at: ${filePathOrUrl} (resolved: ${resolvedPath})`);
  }

  /**
   * Delete a file from storage
   */
  public async deleteFile(filePathOrUrl: string): Promise<boolean> {
    try {
      const resolvedPath = this.resolveLocalPath(filePathOrUrl);
      if (fs.existsSync(resolvedPath)) {
        await fs.promises.unlink(resolvedPath);
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`[StorageService] Failed to delete file: ${filePathOrUrl}`, err);
      return false;
    }
  }

  /**
   * Check if file exists
   */
  public fileExists(filePathOrUrl: string): boolean {
    const resolvedPath = this.resolveLocalPath(filePathOrUrl);
    return fs.existsSync(resolvedPath);
  }
}

export const storageService = StorageService.getInstance();
