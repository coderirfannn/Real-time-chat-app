import { create } from 'zustand';

export type SocketConnectionState =
  'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface SocketState {
  connectionState: SocketConnectionState;
  activeRooms: string[];
  lastError: string | null;

  setConnectionState: (state: SocketConnectionState) => void;
  addActiveRoom: (room: string) => void;
  removeActiveRoom: (room: string) => void;
  clearActiveRooms: () => void;
  setLastError: (error: string | null) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  connectionState: 'disconnected',
  activeRooms: [],
  lastError: null,

  setConnectionState: (connectionState) => set({ connectionState }),

  addActiveRoom: (room) =>
    set((state) => ({
      activeRooms: state.activeRooms.includes(room)
        ? state.activeRooms
        : [...state.activeRooms, room],
    })),

  removeActiveRoom: (room) =>
    set((state) => ({
      activeRooms: state.activeRooms.filter((r) => r !== room),
    })),

  clearActiveRooms: () => set({ activeRooms: [] }),

  setLastError: (lastError) => set({ lastError }),
}));
