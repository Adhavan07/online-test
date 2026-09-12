import { Router } from 'express';
import { NotificationService } from '../services/NotificationService.js';

export const notificationsRouter = Router();

/**
 * Get recent notifications and unread badge count
 */
notificationsRouter.get('/', async (req, res) => {
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
notificationsRouter.patch('/:id/read', async (req, res) => {
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
notificationsRouter.post('/mark-all-read', async (req, res) => {
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
notificationsRouter.delete('/', async (req, res) => {
  try {
    await NotificationService.clearAll();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
