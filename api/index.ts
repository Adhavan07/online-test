import type { Request, Response } from 'express';
import app from '../server/src/index.js';

export default function handler(req: Request, res: Response) {
  const route = typeof req.query?.__path === 'string' ? req.query.__path : '';
  if (route) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query ?? {})) {
      if (key === '__path') continue;
      if (Array.isArray(value)) {
        for (const item of value) query.append(key, String(item));
      } else if (value !== undefined) {
        query.set(key, String(value));
      }
    }
    req.url = '/api/' + route + (query.toString() ? '?' + query.toString() : '');
  } else {
    req.url = '/api';
  }
  return app(req, res);
}