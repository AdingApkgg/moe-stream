import type { Metadata } from "next";
import { SettingsShell } from "./_components/settings-shell";

export const metadata: Metadata = {
  title: "设置",
  description: "账号设置",
  robots: {
    index: false, // 用户设置页不索引
    follow: false,
    nocache: true,
  },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsShell>{children}</SettingsShell>;
}
