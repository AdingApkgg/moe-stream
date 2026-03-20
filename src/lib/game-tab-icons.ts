import {
  FileText,
  BookOpen,
  Puzzle,
  Map,
  Sword,
  Shield,
  Star,
  Heart,
  Trophy,
  Scroll,
  Lightbulb,
  Wrench,
  Package,
  MessageCircle,
  Globe,
  Sparkles,
  Flame,
  Zap,
  Crown,
  type LucideIcon,
} from "lucide-react";

export interface TabIconOption {
  value: string;
  label: string;
  icon: LucideIcon;
}

export const TAB_ICON_OPTIONS: TabIconOption[] = [
  { value: "file-text", label: "文档", icon: FileText },
  { value: "book-open", label: "书本", icon: BookOpen },
  { value: "puzzle", label: "拼图", icon: Puzzle },
  { value: "map", label: "地图", icon: Map },
  { value: "sword", label: "剑", icon: Sword },
  { value: "shield", label: "盾牌", icon: Shield },
  { value: "star", label: "星星", icon: Star },
  { value: "heart", label: "爱心", icon: Heart },
  { value: "trophy", label: "奖杯", icon: Trophy },
  { value: "scroll", label: "卷轴", icon: Scroll },
  { value: "lightbulb", label: "灯泡", icon: Lightbulb },
  { value: "wrench", label: "工具", icon: Wrench },
  { value: "package", label: "包裹", icon: Package },
  { value: "message-circle", label: "对话", icon: MessageCircle },
  { value: "globe", label: "地球", icon: Globe },
  { value: "sparkles", label: "闪耀", icon: Sparkles },
  { value: "flame", label: "火焰", icon: Flame },
  { value: "zap", label: "闪电", icon: Zap },
  { value: "crown", label: "皇冠", icon: Crown },
];

const iconRecord: Record<string, LucideIcon> = {};
for (const o of TAB_ICON_OPTIONS) {
  iconRecord[o.value] = o.icon;
}

export function getTabIcon(iconName?: string | null): LucideIcon {
  if (!iconName) return FileText;
  return iconRecord[iconName] ?? FileText;
}
