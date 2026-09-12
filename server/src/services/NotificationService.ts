import { prisma } from '../lib/prisma.js';

export interface NotificationPayload {
  type: 'INVITATION_SENT' | 'TEST_STARTED' | 'TEST_PASSED' | 'TEST_FAILED' | 'MANUAL_REVIEW' | 'INTERVIEW_SCHEDULED' | 'SYSTEM';
  title: string;
  message: string;
  candidateName?: string;
  candidateId?: string;
  jobTitle?: string;
  link?: string;
}

export class NotificationService {
  /**
   * Create a new platform notification
   */
  static async createNotification(payload: NotificationPayload) {
    try {
      const notification = await prisma.notification.create({
        data: {
          type: payload.type,
          title: payload.title,
          message: payload.message,
          candidateName: payload.candidateName,
          candidateId: payload.candidateId,
          jobTitle: payload.jobTitle,
          link: payload.link,
          isRead: false,
        },
      });
      console.log(`🔔 [NOTIFICATION] ${payload.title}: ${payload.message}`);
      return notification;
    } catch (err) {
      console.error('Failed to create notification:', err);
      return null;
    }
  }

  /**
   * Fetch recent notifications along with unread count
   */
  static async getNotifications(limit = 30) {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({
        where: { isRead: false },
      }),
    ]);

    return { notifications, unreadCount };
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Mark all unread notifications as read
   */
  static async markAllAsRead() {
    return prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * Clear all notifications
   */
  static async clearAll() {
    return prisma.notification.deleteMany({});
  }
}
