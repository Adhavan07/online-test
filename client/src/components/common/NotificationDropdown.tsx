import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Mail, 
  Play, 
  Calendar, 
  Check, 
  Trash2, 
  ExternalLink,
  Sparkles
} from 'lucide-react';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  candidateName?: string;
  candidateId?: string;
  jobTitle?: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationDropdownProps {
  onSelectCandidate?: (candidateId: string) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onSelectCandidate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 8 seconds for real-time alerts
    const interval = setInterval(fetchNotifications, 8000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleClearAll = async () => {
    try {
      await fetch('/api/notifications', { method: 'DELETE' });
      setNotifications([]);
      setUnreadCount(0);
    } catch {}
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'MANUAL_REVIEW':
        return <ShieldAlert className="h-4 w-4 text-amber-600" />;
      case 'TEST_PASSED':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case 'TEST_FAILED':
        return <XCircle className="h-4 w-4 text-rose-600" />;
      case 'INVITATION_SENT':
        return <Mail className="h-4 w-4 text-blue-600" />;
      case 'TEST_STARTED':
        return <Play className="h-4 w-4 text-indigo-600" />;
      case 'INTERVIEW_SCHEDULED':
        return <Calendar className="h-4 w-4 text-purple-600" />;
      default:
        return <Sparkles className="h-4 w-4 text-zinc-600" />;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 transition cursor-pointer"
        title="Notifications & Screening Alerts"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Floating Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-zinc-200 rounded shadow-2xl z-50 overflow-hidden flex flex-col max-h-[480px] animate-in fade-in zoom-in-95 duration-100">
          
          {/* Header */}
          <div className="p-3.5 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xs text-zinc-900 tracking-tight">Activity & Alerts</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-mono font-semibold">
                  {unreadCount} new
                </span>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="flex items-center space-x-2 text-[11px]">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1 cursor-pointer"
                  >
                    <Check className="h-3 w-3" />
                    <span>Mark all read</span>
                  </button>
                )}
                <button
                  onClick={handleClearAll}
                  className="text-zinc-400 hover:text-rose-600 transition cursor-pointer"
                  title="Clear all notifications"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* List Area */}
          <div className="overflow-y-auto divide-y divide-zinc-100 flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2 text-zinc-500">
                <Bell className="h-7 w-7 text-zinc-300 mx-auto" />
                <p className="text-xs font-medium text-zinc-600">No recent notifications</p>
                <p className="text-[11px] text-zinc-400">
                  Screening invitations, test completions, and proctoring flags will appear here in real time.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (!item.isRead) handleMarkAsRead(item.id);
                    if (item.candidateId && onSelectCandidate) {
                      onSelectCandidate(item.candidateId);
                      setIsOpen(false);
                    }
                  }}
                  className={`p-3.5 text-xs flex items-start space-x-3 transition cursor-pointer hover:bg-zinc-50 ${item.isRead ? 'bg-white opacity-80' : 'bg-blue-50/20'}`}
                >
                  <div className="p-1.5 rounded bg-zinc-50 border border-zinc-200 shrink-0 mt-0.5">
                    {getNotificationIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`font-semibold text-xs truncate ${item.isRead ? 'text-zinc-800' : 'text-zinc-900'}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                    {item.jobTitle && (
                      <span className="inline-block px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded text-[10px] font-mono mt-1">
                        {item.jobTitle}
                      </span>
                    )}
                  </div>

                  {!item.isRead && (
                    <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2 border-t border-zinc-200 bg-zinc-50 text-center">
              <span className="text-[10px] font-mono text-zinc-400">
                Auto-syncing every 8s &bull; TechScreen Pro Sentinel
              </span>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
