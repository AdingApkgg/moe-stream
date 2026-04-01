import { z } from "zod";

export const videoFormSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(100, "标题最多100个字符"),
  description: z.string().max(5000, "简介最多5000个字符").optional().or(z.literal("")),
  coverUrl: z.string().url("请输入有效的封面URL").optional().or(z.literal("")),
  videoUrl: z.string().url("请输入有效的视频URL"),
});

export type VideoFormData = z.infer<typeof videoFormSchema>;

export const imageFormSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200, "标题最多200个字符"),
  description: z.string().max(5000, "简介最多5000个字符").optional().or(z.literal("")),
});

export type ImageFormData = z.infer<typeof imageFormSchema>;

export const gameFormSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200, "标题最多200个字符"),
  description: z.string().max(10000, "简介最多10000个字符").optional().or(z.literal("")),
  coverUrl: z.string().optional().or(z.literal("")),
  gameType: z.string().optional().or(z.literal("")),
  version: z.string().max(50).optional().or(z.literal("")),
  isFree: z.boolean(),
});

export type GameFormData = z.infer<typeof gameFormSchema>;

export interface TagItem {
  id: string;
  name: string;
}
