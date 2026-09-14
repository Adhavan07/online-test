import { Router } from 'express';
import { NotificationService } from '../services/NotificationService.js';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const notificationsRouter = Router();

// Protect ALL notification endpoints with authenticated workspace RBAC
notificationsRouter.use(authenticateToken, requireRole(['RECRUITER', 'ADMIN', 'TECH_INTERVIEWER']));

/**
 * Get recent notifications and unread badge count
 */
notificationsRouter.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 30;
    const data = await NotificationService.getNotifications(limit);
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Mark single notification as read
 */
notificationsRouter.patch('/:id/read', async (req: AuthenticatedRequest, res) => {
  try {
    const updated = await NotificationService.markAsRead(req.params.id);
    res.json({ success: true, notification: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Mark all notifications as read
 */
notificationsRouter.post('/mark-all-read', async (req: AuthenticatedRequest, res) => {
  try {
    await NotificationService.markAllAsRead();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Clear all notifications
 */
notificationsRouter.delete('/', async (req: AuthenticatedRequest, res) => {
  try {
    await NotificationService.clearAll();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
