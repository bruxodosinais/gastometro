'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppNotification } from '@/lib/useNotifications';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  readIds: Set<string>;
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

export default function NotificationsDrawer({
  isOpen,
  onClose,
  notifications,
  readIds,
  unreadCount,
  markAsRead,
  markAllAsRead,
}: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleClick(notif: AppNotification) {
    markAsRead(notif.id);
    onClose();
    router.push(notif.href);
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        style={{ animation: 'fade-in 200ms ease-out both' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 z-50 bg-white flex flex-col shadow-2xl"
        style={{
          width: 'min(85vw, 380px)',
          height: '100dvh',
          animation: 'notif-slide-in 300ms ease both',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-gray-900 font-semibold text-base">Notificações</h2>
            {unreadCount > 0 && (
              <span
                className="text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none"
                style={{ background: '#f04e5e' }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-medium transition-colors"
                style={{ color: '#00b87a' }}
              >
                Marcar todas como lidas
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-16">
              <span className="text-5xl">🔔</span>
              <p className="text-gray-500 text-sm font-medium text-center">Tudo em dia por aqui!</p>
            </div>
          ) : (
            <div>
              {notifications.map((notif, i) => {
                const isRead = readIds.has(notif.id);
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`w-full text-left px-5 py-4 flex items-start gap-3.5 transition-colors hover:bg-gray-50 active:bg-gray-100 ${
                      i > 0 ? 'border-t border-gray-100' : ''
                    }`}
                    style={{ background: isRead ? '#ffffff' : '#f8fffe' }}
                  >
                    <span className="text-2xl leading-none flex-shrink-0 mt-0.5">{notif.iconEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-snug ${
                          isRead ? 'text-gray-600 font-normal' : 'text-gray-900 font-semibold'
                        }`}
                      >
                        {notif.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{notif.subtitle}</p>
                      <p className="text-[11px] text-gray-400 mt-1.5">hoje</p>
                    </div>
                    {!isRead && (
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                        style={{ background: '#f04e5e' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
