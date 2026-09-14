import { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Clean sliding-window Rate Limiter Middleware Factory
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const hits = new Map<string, number[]>();

  const limiter = (req: Request, res: Response, next: NextFunction) => {
    // Disable rate limiting during automated integration tests unless explicitly opted in
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const now = Date.now();
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const key = options.keyGenerator ? options.keyGenerator(req) : `${ip}:${req.baseUrl || ''}${req.path}`;

    const timestamps = hits.get(key) || [];
    const validTimestamps = timestamps.filter(t => now - t < options.windowMs);

    if (validTimestamps.length >= options.max) {
      return res.status(429).json({
        success: false,
        error: options.message || 'Too many requests. Please try again later.'
      });
    }

    validTimestamps.push(now);
    hits.set(key, validTimestamps);
    next();
  };

  limiter.reset = () => {
    hits.clear();
  };

  return limiter;
}
