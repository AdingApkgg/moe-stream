import type { Ad } from "@/lib/ads";

export type SortField = "title" | "weight" | "createdAt" | "status" | "platform";
export type SortDir = "asc" | "desc";

export const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "title", label: "标题" },
  { value: "platform", label: "平台" },
  { value: "weight", label: "权重" },
  { value: "createdAt", label: "创建时间" },
  { value: "status", label: "状态" },
];

export type AdFormData = Omit<Ad, "id" | "createdAt"> & { id?: string; createdAt?: string };

export const emptyForm: AdFormData = {
  title: "",
  platform: "",
  url: "",
  description: "",
  imageUrl: "",
  images: { banner: "", card: "", sidebar: "" },
  weight: 1,
  enabled: true,
  positions: ["all"],
  startDate: null,
  endDate: null,
};
