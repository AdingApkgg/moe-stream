import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserPreferences {
  autoplay: boolean;
  quality: "auto" | "1080p" | "720p" | "480p";
  volume: number;
  soundEnabled: boolean;
  soundVolume: number;
}

interface UserStore {
  preferences: UserPreferences;
  setPreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => void;
  resetPreferences: () => void;
}

const defaultPreferences: UserPreferences = {
  autoplay: false,
  quality: "auto",
  volume: 1,
  soundEnabled: true,
  soundVolume: 0.3,
};

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      setPreference: (key, value) =>
        set((state) => ({
          preferences: { ...state.preferences, [key]: value },
        })),
      resetPreferences: () => set({ preferences: defaultPreferences }),
    }),
    {
      name: "user-preferences",
      version: 1,
      migrate: (persisted, version) => {
        if (version === 0) {
          const old = persisted as { preferences: UserPreferences };
          return { ...old };
        }
        return persisted as UserStore;
      },
    }
  )
);
