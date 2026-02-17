import { toast as sonnerToast, type ExternalToast } from "sonner";
import { playSound } from "./audio";
import { useUserStore } from "@/stores/user";

function getSoundPrefs() {
  const { soundEnabled, soundVolume } = useUserStore.getState().preferences;
  return { soundEnabled, soundVolume };
}

type ToastMessage = string | React.ReactNode;

export const toast = {
  success(message: ToastMessage, data?: ExternalToast) {
    const { soundEnabled, soundVolume } = getSoundPrefs();
    if (soundEnabled) playSound("notify", soundVolume);
    return sonnerToast.success(message, data);
  },
  error(message: ToastMessage, data?: ExternalToast) {
    const { soundEnabled, soundVolume } = getSoundPrefs();
    if (soundEnabled) playSound("error", soundVolume);
    return sonnerToast.error(message, data);
  },
  warning(message: ToastMessage, data?: ExternalToast) {
    const { soundEnabled, soundVolume } = getSoundPrefs();
    if (soundEnabled) playSound("notify", soundVolume);
    return sonnerToast.warning(message, data);
  },
  info(message: ToastMessage, data?: ExternalToast) {
    const { soundEnabled, soundVolume } = getSoundPrefs();
    if (soundEnabled) playSound("notify", soundVolume);
    return sonnerToast.info(message, data);
  },
  loading(message: ToastMessage, data?: ExternalToast) {
    return sonnerToast.loading(message, data);
  },
  dismiss(id?: string | number) {
    return sonnerToast.dismiss(id);
  },
  message(message: ToastMessage, data?: ExternalToast) {
    return sonnerToast.message(message, data);
  },
};
