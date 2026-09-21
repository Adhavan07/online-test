import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { put, get, del } from '@vercel/blob';

export interface FileStorageResult {
  publicUrl: string;
  filePath: string;
  fileName: string;
  sizeBytes: number;
}

export class StorageService {
  private static instance: StorageService;
  private readonly uploadsDir: string;
  private readonly storageType: 'local' | 'blob';

  private constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    const configured = process.env.STORAGE_DRIVER;
    this.storageType = configured === 'local'
      ? 'local'
      : (configured === 'blob' || process.env.VERCEL === '1' ? 'blob' : 'local');

    if (this.storageType === 'blob' && !process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN is required when Blob storage is enabled.');
    }

    if (this.storageType === 'local') {
      this.ensureDirectories();
    }
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public isBlobStorage(): boolean {
    return this.storageType === 'blob';
  }

  private ensureDirectories(): void {
    const subfolders = ['resumes', 'proctoring', 'badges', 'temp'];
    for (const folder of subfolders) {
      const dirPath = path.join(this.uploadsDir, folder);
      if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  public validateFileContent(buffer: Buffer, originalName: string): void {
    const MAX_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) throw new Error('File size exceeds maximum allowed limit of 5MB.');

    if (buffer.length >= 2) {
      if (buffer[0] === 0x4D && buffer[1] === 0x5A) throw new Error('Executable binary files are strictly prohibited.');
      if (buffer[0] === 0x23 && buffer[1] === 0x21) throw new Error('Script execution files are strictly prohibited.');
    }
    if (buffer.length >= 4 && buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
      throw new Error('Executable ELF binary files are strictly prohibited.');
    }

    const ext = path.extname(originalName).toLowerCase();
    const ALLOWED_EXTS = ['.pdf', '.docx', '.doc', '.txt', '.jpg', '.jpeg', '.png', '.webp'];
    if (!ALLOWED_EXTS.includes(ext)) throw new Error(`File extension ${ext} is not allowed.`);

    if (ext === '.pdf') {
      const ok = buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
      if (!ok) throw new Error('Invalid or corrupt PDF file (disguised content detected).');
    } else if (ext === '.docx') {
      const ok = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
      if (!ok) throw new Error('Invalid or corrupt DOCX file (disguised content detected).');
    }
  }

  public resolveLocalPath(filePathOrUrl: string, tenantId?: string | null): string {
    if (this.storageType === 'blob') {
      throw new Error('Local filesystem paths are unavailable with Vercel Blob storage.');
    }

    const rootUploads = path.resolve(this.uploadsDir);
    let resolved: string;
    if (path.isAbsolute(filePathOrUrl)) {
      resolved = filePathOrUrl.startsWith('/uploads') || filePathOrUrl.startsWith('\\uploads')
        ? path.resolve(rootUploads, filePathOrUrl.replace(/^(\/|\\)?(uploads(\/|\\))?/, ''))
        : path.resolve(filePathOrUrl);
    } else {
      if (filePathOrUrl.includes('..')) throw new Error('Access denied: Path traversal detected.');
      resolved = path.resolve(rootUploads, filePathOrUrl.replace(/^(\/|\\)?(uploads(\/|\\))?/, ''));
    }

    if (!resolved.startsWith(rootUploads + path.sep) && resolved !== rootUploads) {
      throw new Error('Access denied: Path traversal detected.');
    }

    if (tenantId) {
      const tenantDir = path.join(rootUploads, 'tenants');
      if (resolved.startsWith(tenantDir + path.sep)) {
        const expectedTenantDir = path.resolve(tenantDir, tenantId);
        if (!resolved.startsWith(expectedTenantDir + path.sep) && resolved !== expectedTenantDir) {
          throw new Error('Access denied: Cross-tenant file access prohibited.');
        }
      }
    }
    return resolved;
  }

  public async saveBuffer(
    buffer: Buffer,
    originalName: string,
    subfolder: 'resumes' | 'proctoring' | 'badges' | 'temp' = 'resumes',
    tenantId?: string | null
  ): Promise<FileStorageResult> {
    this.validateFileContent(buffer, originalName);

    const ext = path.extname(originalName).toLowerCase() || '.bin';
    const sanitizedBase = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const finalFilename = `${sanitizedBase}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const partitionSubfolder = tenantId ? path.join('tenants', tenantId, subfolder) : subfolder;
    const storagePath = partitionSubfolder.replace(/\\/g, '/');

    if (this.storageType === 'blob') {
      const blob = await put(`${storagePath}/${finalFilename}`, buffer, {
        access: 'private',
        addRandomSuffix: false,
        contentType: this.contentTypeForExtension(ext),
      });
      return {
        publicUrl: blob.url,
        filePath: blob.url,
        fileName: finalFilename,
        sizeBytes: buffer.length,
      };
    }

    const targetDir = path.join(this.uploadsDir, partitionSubfolder);
    if (!fs.existsSync(targetDir)) await fs.promises.mkdir(targetDir, { recursive: true });
    const targetFilePath = path.join(targetDir, finalFilename);
    await fs.promises.writeFile(targetFilePath, buffer);

    return {
      publicUrl: `/uploads/${storagePath}/${finalFilename}`,
      filePath: targetFilePath,
      fileName: finalFilename,
      sizeBytes: buffer.length,
    };
  }

  private contentTypeForExtension(ext: string): string {
    const map: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.txt': 'text/plain',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    return map[ext] || 'application/octet-stream';
  }

  public async getFileBuffer(filePathOrUrl: string): Promise<Buffer> {
    if (this.storageType === 'blob') {
      const result = await get(filePathOrUrl, { access: 'private' });
      if (!result) throw new Error('File not found in Vercel Blob storage.');
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    }

    const resolvedPath = this.resolveLocalPath(filePathOrUrl);
    if (!fs.existsSync(resolvedPath)) throw new Error(`File not found at: ${filePathOrUrl}`);
    return fs.promises.readFile(resolvedPath);
  }

  public async deleteFile(filePathOrUrl: string): Promise<boolean> {
    try {
      if (this.storageType === 'blob') {
        await del(filePathOrUrl);
        return true;
      }
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

  public async fileExists(filePathOrUrl: string): Promise<boolean> {
    try {
      if (this.storageType === 'blob') {
        const result = await get(filePathOrUrl, { access: 'private' });
        return Boolean(result);
      }
      return fs.existsSync(this.resolveLocalPath(filePathOrUrl));
    } catch {
      return false;
    }
  }
}

export const storageService = StorageService.getInstance();
