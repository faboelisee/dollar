import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
}

interface UiState {
  sidebarCollapsed: boolean;
  notifications: Notification[];
  unreadCount: number;
  activeCashRegisterId: string | null;
  theme: 'light' | 'dark';

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  addNotification: (n: Omit<Notification, 'id' | 'isRead' | 'createdAt'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  setActiveCashRegister: (id: string | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      notifications: [],
      unreadCount: 0,
      activeCashRegisterId: null,
      theme: 'light',

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      addNotification: (n) => {
        const notification: Notification = {
          ...n,
          id: crypto.randomUUID(),
          isRead: false,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          notifications: [notification, ...s.notifications].slice(0, 50),
          unreadCount: s.unreadCount + 1,
        }));
      },

      markNotificationRead: (id) => {
        set((s) => {
          const notifications = s.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          );
          const unreadCount = notifications.filter((n) => !n.isRead).length;
          return { notifications, unreadCount };
        });
      },

      markAllNotificationsRead: () => {
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        }));
      },

      setActiveCashRegister: (id) => set({ activeCashRegisterId: id }),

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'cashflow-ui',
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        theme: s.theme,
        activeCashRegisterId: s.activeCashRegisterId,
      }),
    }
  )
);
