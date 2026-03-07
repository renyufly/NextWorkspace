'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AppStoreState = {
  accessToken: string | null;
  selectedWorkspaceId: string | null;
  selectedChannelId: string | null;
  setAccessToken: (accessToken: string | null) => void;
  setSelectedWorkspaceId: (workspaceId: string | null) => void;
  setSelectedChannelId: (channelId: string | null) => void;
  clearSession: () => void;
};

export const useAppStore = create<AppStoreState>()(
  persist(
    (set) => ({
      accessToken: null,
      selectedWorkspaceId: null,
      selectedChannelId: null,
      setAccessToken: (accessToken) => set({ accessToken }),
      setSelectedWorkspaceId: (selectedWorkspaceId) => set({ selectedWorkspaceId }),
      setSelectedChannelId: (selectedChannelId) => set({ selectedChannelId }),
      clearSession: () =>
        set({
          accessToken: null,
          selectedWorkspaceId: null,
          selectedChannelId: null,
        }),
    }),
    {
      name: 'worknext-app-store',
      partialize: (state) => ({
        accessToken: state.accessToken,
        selectedWorkspaceId: state.selectedWorkspaceId,
        selectedChannelId: state.selectedChannelId,
      }),
    },
  ),
);