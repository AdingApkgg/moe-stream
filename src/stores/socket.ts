import { create } from "zustand";

interface SocketState {
  connected: boolean;
  onlineUsers: Set<string>;
  unreadNotifications: number;
  unreadMessages: number;
  activeConversationId: string | null;
  setConnected: (connected: boolean) => void;
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;
  setUnreadNotifications: (count: number) => void;
  setUnreadMessages: (count: number) => void;
  incrementUnreadNotifications: () => void;
  incrementUnreadMessages: () => void;
  setActiveConversation: (id: string | null) => void;
  isOnline: (userId: string) => boolean;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  connected: false,
  onlineUsers: new Set<string>(),
  unreadNotifications: 0,
  unreadMessages: 0,
  activeConversationId: null,
  setConnected: (connected) => set({ connected }),
  addOnlineUser: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.add(userId);
      return { onlineUsers: next };
    }),
  removeOnlineUser: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.delete(userId);
      return { onlineUsers: next };
    }),
  setUnreadNotifications: (count) => set({ unreadNotifications: count }),
  setUnreadMessages: (count) => set({ unreadMessages: count }),
  incrementUnreadNotifications: () =>
    set((state) => ({ unreadNotifications: state.unreadNotifications + 1 })),
  incrementUnreadMessages: () =>
    set((state) => ({ unreadMessages: state.unreadMessages + 1 })),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  isOnline: (userId) => get().onlineUsers.has(userId),
}));
