import { prisma } from '../lib/prisma.js';
import { storageService } from './StorageService.js';

export interface ProctorEventResult {
  log: any;
  integrityScore: number;
  proctoringRiskScore: number;
  proctoringRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  debounced?: boolean;
}

export interface ProctorSnapshotResult {
  log: any;
  snapshotUrl: string;
}

export class ProctoringService {
  public static readonly ALLOWED_EVENT_TYPES = new Set([
    'FOCUS_LOST',
    'WINDOW_BLUR',
    'FULLSCREEN_EXIT',
    'SCREEN_SHARE_STOPPED',
    'CAMERA_DISABLED',
    'MIC_DISABLED',
    'COPY_PASTE',
    'RIGHT_CLICK',
    'SUSPICIOUS_BEHAVIOR',
    'WEBCAM_SNAPSHOT',
  ]);

  // Track recent events for deduplication: `${attemptId}:${eventType}` -> timestamp
  private static recentEvents = new Map<string, number>();

  // Sliding window rate limiter for events: attemptId -> timestamps[]
  private static eventTimestamps = new Map<string, number[]>();

  // Sliding window rate limiter for snapshots: attemptId -> timestamps[]
  private static snapshotTimestamps = new Map<string, number[]>();

  // Max events per 60 seconds
  public static readonly MAX_EVENTS_PER_MINUTE = 20;

  // Debounce window in ms (ignore exact same event if sent within this window)
  public static readonly DEBOUNCE_WINDOW_MS = 3000;

  // Max snapshots per 60 seconds
  public static readonly MAX_SNAPSHOTS_PER_MINUTE = 6;

  // Minimum interval between snapshots in ms
  public static readonly MIN_SNAPSHOT_INTERVAL_MS = 5000;

  // Max snapshot payload size: 2MB in binary
  public static readonly MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;

  /**
   * Reset rate limiters and caches (useful for testing)
   */
  public static resetLimits(): void {
    this.recentEvents.clear();
    this.eventTimestamps.clear();
    this.snapshotTimestamps.clear();
  }

  /**
   * Calculate Proctoring Risk Score and Level from events and counters
   */
  public static calculateRisk(logs: { eventType: string }[]): {
    proctoringRiskScore: number;
    integrityScore: number;
    proctoringRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  } {
    let rawRiskScore = 0;

    for (const log of logs) {
      switch (log.eventType) {
        case 'FOCUS_LOST':
          rawRiskScore += 10;
          break;
        case 'WINDOW_BLUR':
          rawRiskScore += 5;
          break;
        case 'FULLSCREEN_EXIT':
          rawRiskScore += 10;
          break;
        case 'SCREEN_SHARE_STOPPED':
          rawRiskScore += 30;
          break;
        case 'CAMERA_DISABLED':
          rawRiskScore += 20;
          break;
        case 'MIC_DISABLED':
          rawRiskScore += 10;
          break;
        case 'COPY_PASTE':
          rawRiskScore += 15;
          break;
        case 'RIGHT_CLICK':
          rawRiskScore += 5;
          break;
        case 'SUSPICIOUS_BEHAVIOR':
          rawRiskScore += 15;
          break;
        case 'WEBCAM_SNAPSHOT':
          // Benign periodic snapshot, do not penalize
          break;
        default:
          rawRiskScore += 5;
          break;
      }
    }

    const proctoringRiskScore = Math.min(100, Math.max(0, rawRiskScore));
    const integrityScore = Math.max(0, 100 - proctoringRiskScore);

    let proctoringRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (proctoringRiskScore >= 61) {
      proctoringRiskLevel = 'HIGH';
    } else if (proctoringRiskScore >= 31) {
      proctoringRiskLevel = 'MEDIUM';
    }

    return { proctoringRiskScore, integrityScore, proctoringRiskLevel };
  }

  /**
   * Record a real-time proctoring event with rate-limiting, deduplication, and risk scoring
   */
  public static async recordProctorEvent(
    attemptId: string,
    eventType: string,
    details?: string
  ): Promise<ProctorEventResult> {
    if (!attemptId) {
      throw new Error('attemptId is required.');
    }

    if (!eventType || !this.ALLOWED_EVENT_TYPES.has(eventType)) {
      throw new Error(`Invalid event type: ${eventType || 'undefined'}. Allowed events: ${Array.from(this.ALLOWED_EVENT_TYPES).join(', ')}`);
    }

    if (details && typeof details !== 'string') {
      throw new Error('details must be a string.');
    }

    const sanitizedDetails = details ? details.substring(0, 1000) : undefined;
    const now = Date.now();

    // 1. Sliding window rate limit per attemptId
    const timestamps = this.eventTimestamps.get(attemptId) || [];
    const recentTimestamps = timestamps.filter(t => now - t < 60000);
    if (recentTimestamps.length >= this.MAX_EVENTS_PER_MINUTE) {
      throw new Error('RATE_LIMIT_EXCEEDED: Proctoring event rate limit exceeded. Max 20 events per minute.');
    }
    recentTimestamps.push(now);
    this.eventTimestamps.set(attemptId, recentTimestamps);

    // 2. Debounce rapid duplicate events (e.g. bounce tab switch within 3s)
    const debounceKey = `${attemptId}:${eventType}`;
    const lastEventTime = this.recentEvents.get(debounceKey);
    const isDebounced = lastEventTime !== undefined && (now - lastEventTime) < this.DEBOUNCE_WINDOW_MS;
    this.recentEvents.set(debounceKey, now);

    if (isDebounced) {
      // Rapid bounce duplicate: return current state without penalizing repeatedly
      const currentAttempt = await prisma.assessmentAttempt.findUnique({
        where: { id: attemptId },
        select: {
          integrityScore: true,
          proctoringRiskScore: true,
          proctoringRiskLevel: true,
        }
      });
      return {
        log: {
          attemptId,
          eventType,
          details: sanitizedDetails ? `[Debounced] ${sanitizedDetails}` : '[Debounced duplicate event]',
          timestamp: new Date(now),
        },
        integrityScore: currentAttempt?.integrityScore ?? 100,
        proctoringRiskScore: currentAttempt?.proctoringRiskScore ?? 0,
        proctoringRiskLevel: (currentAttempt?.proctoringRiskLevel as any) ?? 'LOW',
        debounced: true,
      };
    }

    // 3. Create ProctoringLog entry
    const log = await prisma.proctoringLog.create({
      data: {
        attemptId,
        eventType,
        details: sanitizedDetails,
      }
    });

    // 4. Update specific violation counter
    const counterUpdates: Record<string, { increment: number }> = {};
    if (eventType === 'FOCUS_LOST') {
      counterUpdates.tabSwitchCount = { increment: 1 };
    } else if (eventType === 'FULLSCREEN_EXIT') {
      counterUpdates.fullscreenViolationCount = { increment: 1 };
    } else if (eventType === 'SCREEN_SHARE_STOPPED') {
      counterUpdates.screenShareStopCount = { increment: 1 };
    } else if (eventType === 'CAMERA_DISABLED') {
      counterUpdates.cameraDisconnectCount = { increment: 1 };
    }

    if (Object.keys(counterUpdates).length > 0) {
      await prisma.assessmentAttempt.update({
        where: { id: attemptId },
        data: counterUpdates,
      });
    }

    // 5. Fetch all logs for this attempt to calculate updated real-time risk score
    const allLogs = await prisma.proctoringLog.findMany({
      where: { attemptId },
      select: { eventType: true }
    });

    const { proctoringRiskScore, integrityScore, proctoringRiskLevel } = this.calculateRisk(allLogs);

    // 6. Persist real-time scores on attempt
    await prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        proctoringRiskScore,
        integrityScore,
        proctoringRiskLevel,
      }
    });

    return {
      log,
      integrityScore,
      proctoringRiskScore,
      proctoringRiskLevel,
      debounced: false,
    };
  }

  /**
   * Validate and record a proctoring webcam snapshot with rate-limiting and buffer verification
   */
  public static async recordSnapshot(
    attemptId: string,
    imageBase64: string,
    eventType: string = 'WEBCAM_SNAPSHOT',
    details?: string
  ): Promise<ProctorSnapshotResult> {
    if (!attemptId) {
      throw new Error('attemptId is required.');
    }

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new Error('imageBase64 must be a non-empty string.');
    }

    const now = Date.now();

    // 1. Sliding window & frequency rate limit for snapshots
    const snapshots = this.snapshotTimestamps.get(attemptId) || [];
    const recentSnapshots = snapshots.filter(t => now - t < 60000);

    if (recentSnapshots.length > 0) {
      const lastSnapshot = recentSnapshots[recentSnapshots.length - 1];
      if (now - lastSnapshot < this.MIN_SNAPSHOT_INTERVAL_MS) {
        throw new Error('RATE_LIMIT_EXCEEDED: Snapshot frequency too high. Minimum 5 seconds between snapshots.');
      }
    }

    if (recentSnapshots.length >= this.MAX_SNAPSHOTS_PER_MINUTE) {
      throw new Error('RATE_LIMIT_EXCEEDED: Snapshot rate limit exceeded. Max 6 snapshots per minute.');
    }

    // 2. Validate payload size before decoding to prevent memory exhaustion (max ~4MB base64 string)
    if (imageBase64.length > 4 * 1024 * 1024) {
      throw new Error('Payload too large: Image payload exceeds 4MB string limit.');
    }

    // 3. Extract mime type and clean base64 data
    let ext = '.jpg';
    let cleanBase64 = imageBase64.trim();

    const dataUriMatch = cleanBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/s);
    if (dataUriMatch) {
      const mime = dataUriMatch[1].toLowerCase();
      ext = mime === 'jpeg' || mime === 'jpg' ? '.jpg' : `.${mime}`;
      cleanBase64 = dataUriMatch[2];
    } else if (cleanBase64.startsWith('data:')) {
      throw new Error('Invalid image format: Unsupported MIME type.');
    }

    const buffer = Buffer.from(cleanBase64, 'base64');

    // 4. Verify decoded buffer size
    if (buffer.length < 100) {
      throw new Error('Invalid image: Payload too small or empty.');
    }
    if (buffer.length > this.MAX_SNAPSHOT_BYTES) {
      throw new Error('Payload too large: Decoded image exceeds 2MB limit.');
    }

    // 5. Magic byte verification
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    const isPng = buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isWebp = buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    if (!isJpeg && !isPng && !isWebp) {
      throw new Error('Invalid image format: Must be a valid JPEG, PNG, or WEBP image.');
    }

    if (isJpeg) ext = '.jpg';
    else if (isPng) ext = '.png';
    else if (isWebp) ext = '.webp';

    recentSnapshots.push(now);
    this.snapshotTimestamps.set(attemptId, recentSnapshots);

    // 6. Resolve tenant before durable storage so snapshots are physically partitioned per company.
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: { application: { select: { job: { select: { companyId: true } } } } },
    });
    const companyId = attempt?.application?.job?.companyId;
    if (!companyId) throw new Error('Assessment tenant could not be resolved for snapshot storage.');

    const filename = `snapshot-${attemptId.substring(0, 8)}-${now}${ext}`;
    const stored = await storageService.saveBuffer(buffer, filename, 'proctoring', companyId);

    // 7. Record ProctoringLog
    const log = await prisma.proctoringLog.create({
      data: {
        attemptId,
        eventType: eventType || 'WEBCAM_SNAPSHOT',
        details: JSON.stringify({
          snapshotUrl: stored.publicUrl,
          reason: details ? details.substring(0, 500) : 'Periodic proctoring verification',
          sizeBytes: stored.sizeBytes,
        }),
      }
    });

    return {
      log,
      snapshotUrl: stored.publicUrl,
    };
  }
}
