import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import path from "node:path";

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";
config({ path: path.join(__dirname, "..", envFile) });

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function randomId6(): string {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59));
  return d;
}

async function hashPassword(password: string): Promise<string> {
  const { hash } = await import("../src/lib/bcrypt-wasm");
  return hash(password, 10);
}

// ---------------------------------------------------------------------------
// 数据定义
// ---------------------------------------------------------------------------

const TAGS = [
  // 题材类型
  { name: "热血", slug: "action" },
  { name: "恋爱", slug: "romance" },
  { name: "后宫", slug: "harem" },
  { name: "冒险", slug: "adventure" },
  { name: "奇幻", slug: "fantasy" },
  { name: "异世界", slug: "isekai" },
  { name: "校园", slug: "school" },
  { name: "搞笑", slug: "comedy" },
  { name: "日常", slug: "slice-of-life" },
  { name: "科幻", slug: "sci-fi" },
  { name: "机战", slug: "mecha" },
  { name: "悬疑", slug: "mystery" },
  { name: "恐怖", slug: "horror" },
  { name: "治愈", slug: "healing" },
  { name: "运动", slug: "sports" },
  { name: "音乐", slug: "music-genre" },
  { name: "偶像", slug: "idol" },
  { name: "百合", slug: "yuri" },
  { name: "耽美", slug: "bl" },
  { name: "战斗", slug: "battle" },
  // 来源
  { name: "日本", slug: "japan" },
  { name: "国创", slug: "chinese" },
  { name: "欧美", slug: "western" },
  { name: "韩国", slug: "korean" },
  // 受众
  { name: "少年向", slug: "shounen" },
  { name: "少女向", slug: "shoujo" },
  { name: "青年向", slug: "seinen" },
  { name: "女性向", slug: "josei" },
  { name: "子供向", slug: "kids" },
  // 其他
  { name: "经典", slug: "classic" },
  { name: "新番", slug: "new-release" },
  { name: "原创", slug: "original" },
  { name: "漫改", slug: "manga-adapted" },
  { name: "轻改", slug: "novel-adapted" },
  { name: "游戏改", slug: "game-adapted" },
];

const USERS_DATA = [
  {
    email: "owner@moestream.dev",
    username: "owner",
    nickname: "站长大人",
    role: "OWNER" as const,
    canUpload: true,
    bio: "MoeStream 创始人，热爱二次元",
  },
  {
    email: "admin@moestream.dev",
    username: "admin",
    nickname: "管理酱",
    role: "ADMIN" as const,
    canUpload: true,
    bio: "勤劳的管理员，审核视频中……",
    adminScopes: [
      "video:moderate",
      "video:manage",
      "user:view",
      "user:manage",
      "tag:manage",
      "comment:manage",
      "site:settings",
    ],
  },
  {
    email: "uploader@moestream.dev",
    username: "uploader",
    nickname: "投稿达人",
    role: "USER" as const,
    canUpload: true,
    bio: "日更选手！",
  },
  {
    email: "viewer@moestream.dev",
    username: "viewer",
    nickname: "追番少女",
    role: "USER" as const,
    canUpload: false,
    bio: "只看不说话 (´・ω・`)",
  },
  {
    email: "alice@moestream.dev",
    username: "alice",
    nickname: "爱丽丝",
    role: "USER" as const,
    canUpload: true,
    bio: "欢迎来到仙境",
  },
  {
    email: "bob@moestream.dev",
    username: "bob_gamer",
    nickname: "游戏宅Bob",
    role: "USER" as const,
    canUpload: true,
    bio: "RPG / Galgame 爱好者",
  },
  {
    email: "charlie@moestream.dev",
    username: "charlie",
    nickname: "查理",
    role: "USER" as const,
    canUpload: false,
    bio: "路人甲",
  },
  {
    email: "diana@moestream.dev",
    username: "diana_art",
    nickname: "画师Diana",
    role: "USER" as const,
    canUpload: true,
    bio: "插画 / 同人创作",
  },
];

const VIDEO_TITLES = [
  "Re:从零开始的异世界生活 第三季",
  "咒术回战 渋谷事変",
  "间谍过家家 第二季",
  "葬送的芙莉莲",
  "迷宫饭",
  "我独自升级",
  "药屋少女的呢喃",
  "蓝色监狱 第二季",
  "无职转生 第三季",
  "鬼灭之刃 柱训练篇",
  "排球少年!! 垃圾场的决战",
  "进击的巨人 最终季 完结篇",
  "转生贵族的异世界冒险录",
  "夜樱家的大作战",
  "怪兽8号",
  "因为太怕痛就全点防御力了 第三季",
  "物语系列 Off & Monster Season",
  "败犬女主太多了",
  "小市民系列",
  "我的幸福婚约 第二季",
  "魔法少女毁灭者",
  "天国大魔境",
  "奇幻冒险日志",
  "日常系的异世界探索",
  "星际旋律 Stardust Melody",
];

const VIDEO_DESCRIPTIONS = [
  "菜月昴再次踏入充满未知危险的异世界冒险，新篇章带来更加扣人心弦的故事发展。",
  "涩谷事变全面爆发，咒术师们将迎来前所未有的战斗与考验。",
  "黄昏一家继续他们的间谍任务，阿尼亚的学校生活也越来越精彩。",
  "勇者一行已经击败了魔王，但旅途还在继续。精灵芙莉莲踏上理解人类的旅程。",
  "冒险者团队在地下城中一边探索一边烹饪魔物料理的美食冒险故事。",
  "在充满危险的猎人世界中，程肖宇独自觉醒了特殊能力。",
  "药屋后宫中的少女猫猫，用她的药学知识解决一个又一个谜团。",
  "为了成为世界最强前锋，青年球员们在蓝色监狱中展开激烈竞争。",
  "转生到异世界的鲁迪，在新的人生中继续成长与冒险。",
  "鬼杀队柱们开始了严酷的训练，为最终决战做准备。",
  "高中排球赛场上的热血对决，青春的汗水与泪水交织。",
  "人类与巨人之间的最终战争终于画上句号。",
  "拥有多种魔法适性的贵族少年在异世界展开冒险。",
  "夜樱家的特工一家展开欢乐而刺激的日常冒险。",
  "日本突然出现被称为'怪兽'的巨大生物，年轻人挺身而出。",
];

const GAME_DATA = [
  { title: "星穹铁道同人RPG", gameType: "RPG", isFree: true },
  { title: "恋爱物语 ～校园篇～", gameType: "ADV", isFree: true },
  { title: "幻想迷宫探索者", gameType: "RPG", isFree: false },
  { title: "机甲战线 Online", gameType: "ACT", isFree: true },
  { title: "魔法少女养成计划", gameType: "SLG", isFree: true },
  { title: "末日生存：东京废墟", gameType: "RPG", isFree: false },
  { title: "猫咪咖啡馆经营", gameType: "SLG", isFree: true },
  { title: "异世界转生模拟器", gameType: "SLG", isFree: true },
  { title: "像素冒险 Legend", gameType: "ACT", isFree: true },
  { title: "恋爱推理 ～密室之恋～", gameType: "ADV", isFree: false },
];

const IMAGE_POST_TITLES = [
  "原创插画 —— 樱花树下的少女",
  "同人图：芙莉莲与精灵魔法",
  "风景摄影：秋叶原夜景",
  "手绘教程：如何画好眼睛",
  "Cosplay 摄影集 —— 间谍过家家",
  "像素画合集 Vol.3",
  "场景概念设计：蒸汽朋克都市",
  "Q版角色设计练习",
  "水彩风插画：海边的猫咪",
  "同人漫画：某科学的超电磁炮 番外",
  "板绘过程分享：赛博朋克女孩",
  "每日一画 #Day365 年度合集",
];

const COMMENT_TEXTS = [
  "太好看了！期待下一集！",
  "动画质量好高，制作组辛苦了",
  "这一集信息量好大啊",
  "OP 和 ED 都很好听",
  "感动到哭了 (T_T)",
  "笑死我了哈哈哈哈",
  "这个打斗场面太帅了",
  "原作党表示改编得不错",
  "画风好精致",
  "故事节奏把控得很好",
  "看完忍不住去补了原作",
  "这番竟然没什么人看？安利一波！",
  "声优演技太绝了",
  "世界观设定很有意思",
  "治愈系的日常太舒服了",
  "建议大家都来看！",
  "催更催更催更！",
  "为什么只有12集啊……",
  "OST 质量也太高了吧",
  "这是什么神仙作品",
];

const GUESTBOOK_MESSAGES = [
  "发现了一个宝藏网站！已收藏 ⭐",
  "这个网站界面好好看，是什么框架做的？",
  "希望能加入更多新番资源",
  "站长加油！支持！",
  "终于找到一个纯净的 ACG 社区了",
  "请问怎么成为投稿者？",
  "建议增加弹幕功能",
  "太好了，终于有人做这样的网站了",
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(
    pool as unknown as ConstructorParameters<typeof PrismaPg>[0],
  );
  const prisma = new PrismaClient({ adapter });

  console.log("🌱 Seeding database...\n");

  try {
    // ============================== 标签 ==============================
    console.log("📌 创建标签...");
    await prisma.tagOnVideo.deleteMany({});
    await prisma.tagOnGame.deleteMany({});
    await prisma.tagOnImagePost.deleteMany({});
    await prisma.tag.deleteMany({});

    const tagRecords: Record<string, { id: string }> = {};
    for (const tag of TAGS) {
      const record = await prisma.tag.upsert({
        where: { slug: tag.slug },
        update: {},
        create: tag,
      });
      tagRecords[tag.slug] = record;
    }
    console.log(`   ✓ 创建 ${TAGS.length} 个标签`);

    // ============================== 用户 ==============================
    console.log("👤 创建用户...");
    const defaultPassword = await hashPassword("password123");
    const userRecords: Array<{ id: string; username: string; role: string }> =
      [];

    for (const u of USERS_DATA) {
      const existing = await prisma.user.findUnique({
        where: { email: u.email },
      });
      if (existing) {
        userRecords.push({
          id: existing.id,
          username: u.username,
          role: u.role,
        });
        continue;
      }

      const user = await prisma.user.create({
        data: {
          email: u.email,
          username: u.username,
          displayUsername: u.nickname,
          nickname: u.nickname,
          role: u.role,
          canUpload: u.canUpload,
          bio: u.bio,
          adminScopes: (u as { adminScopes?: string[] }).adminScopes ?? undefined,
          createdAt: daysAgo(randomInt(30, 180)),
        },
      });

      await prisma.account.create({
        data: {
          userId: user.id,
          type: "credential",
          provider: "credential",
          providerAccountId: user.id,
          password: defaultPassword,
        },
      });

      userRecords.push({ id: user.id, username: u.username, role: u.role });
    }
    console.log(
      `   ✓ 创建 ${userRecords.length} 个用户（密码统一为 password123）`,
    );

    const uploaders = userRecords.filter(
      (u) =>
        u.role === "OWNER" ||
        u.role === "ADMIN" ||
        ["uploader", "alice", "bob_gamer", "diana_art"].includes(u.username),
    );
    const allUserIds = userRecords.map((u) => u.id);

    // ============================== 站点配置 ==============================
    console.log("⚙️  初始化站点配置...");
    await prisma.siteConfig.upsert({
      where: { id: "default" },
      update: {},
      create: {
        id: "default",
        siteName: "MoeStream Dev",
        siteDescription:
          "MoeStream 开发环境 —— ACGN 流媒体平台",
        allowRegistration: true,
        allowUpload: true,
        allowComment: true,
        sectionVideoEnabled: true,
        sectionImageEnabled: true,
        sectionGameEnabled: true,
        announcementEnabled: true,
        announcement:
          "🎉 欢迎来到 MoeStream 开发环境！这是自动生成的测试数据。",
      },
    });
    console.log("   ✓ 站点配置已初始化");

    // ============================== 视频 ==============================
    console.log("🎬 创建视频...");
    const usedVideoIds = new Set<string>();
    const videoRecords: Array<{ id: string; uploaderId: string }> = [];

    for (let i = 0; i < VIDEO_TITLES.length; i++) {
      let vid: string;
      do {
        vid = randomId6();
      } while (usedVideoIds.has(vid));
      usedVideoIds.add(vid);

      const uploader = pick(uploaders);
      const desc =
        VIDEO_DESCRIPTIONS[i % VIDEO_DESCRIPTIONS.length];
      const createdAt = daysAgo(randomInt(1, 90));

      const video = await prisma.video.upsert({
        where: { id: vid },
        update: {},
        create: {
          id: vid,
          title: VIDEO_TITLES[i],
          description: desc,
          videoUrl: `https://example.com/videos/${vid}/master.m3u8`,
          duration: randomInt(720, 1500),
          views: randomInt(100, 50000),
          status: i < 22 ? "PUBLISHED" : pick(["PENDING", "PUBLISHED"]),
          uploaderId: uploader.id,
          createdAt,
          updatedAt: createdAt,
        },
      });

      const tagSlugs = pickN(TAGS.map((t) => t.slug), randomInt(2, 5));
      for (const slug of tagSlugs) {
        const tag = tagRecords[slug];
        if (!tag) continue;
        await prisma.tagOnVideo
          .create({ data: { videoId: video.id, tagId: tag.id } })
          .catch(() => {});
      }

      videoRecords.push({ id: video.id, uploaderId: uploader.id });
    }
    console.log(`   ✓ 创建 ${videoRecords.length} 个视频`);

    // ============================== 合集 ==============================
    console.log("📚 创建合集...");
    const seriesUploader = uploaders[0];
    const series = await prisma.series.create({
      data: {
        title: "异世界冒险系列",
        description: "收录所有异世界题材的精选动画",
        creatorId: seriesUploader.id,
      },
    });
    const seriesVideos = videoRecords.slice(0, 5);
    for (let i = 0; i < seriesVideos.length; i++) {
      await prisma.seriesEpisode
        .create({
          data: {
            seriesId: series.id,
            videoId: seriesVideos[i].id,
            episodeNum: i + 1,
          },
        })
        .catch(() => {});
    }
    console.log("   ✓ 创建 1 个合集（含 5 集）");

    // ============================== 游戏 ==============================
    console.log("🎮 创建游戏...");
    const usedGameIds = new Set<string>();
    const gameRecords: Array<{ id: string }> = [];

    for (const g of GAME_DATA) {
      let gid: string;
      do {
        gid = randomId6();
      } while (usedGameIds.has(gid) || usedVideoIds.has(gid));
      usedGameIds.add(gid);

      const uploader = pick(uploaders);
      const createdAt = daysAgo(randomInt(5, 120));

      const game = await prisma.game.upsert({
        where: { id: gid },
        update: {},
        create: {
          id: gid,
          title: g.title,
          description: `${g.title}是一款${g.gameType}类型的游戏，${g.isFree ? "完全免费游玩" : "需要付费购买"}。`,
          gameType: g.gameType,
          isFree: g.isFree,
          version: `Ver${randomInt(1, 3)}.${randomInt(0, 9)}`,
          views: randomInt(50, 20000),
          status: "PUBLISHED",
          uploaderId: uploader.id,
          createdAt,
          updatedAt: createdAt,
          extraInfo: {
            platforms: pickN(["PC", "Android", "iOS", "Web"], randomInt(1, 3)),
            fileSize: `${randomInt(100, 4000)} MB`,
          },
        },
      });

      const tagSlugs = pickN(TAGS.map((t) => t.slug), randomInt(1, 4));
      for (const slug of tagSlugs) {
        const tag = tagRecords[slug];
        if (!tag) continue;
        await prisma.tagOnGame
          .create({ data: { gameId: game.id, tagId: tag.id } })
          .catch(() => {});
      }

      gameRecords.push({ id: game.id });
    }
    console.log(`   ✓ 创建 ${gameRecords.length} 个游戏`);

    // ============================== 图片帖子 ==============================
    console.log("🖼️  创建图片帖子...");
    const usedImageIds = new Set<string>();
    const imageRecords: Array<{ id: string }> = [];

    for (const title of IMAGE_POST_TITLES) {
      let iid: string;
      do {
        iid = randomId6();
      } while (
        usedImageIds.has(iid) ||
        usedVideoIds.has(iid) ||
        usedGameIds.has(iid)
      );
      usedImageIds.add(iid);

      const uploader = pick(uploaders);
      const imageCount = randomInt(1, 8);
      const images = Array.from(
        { length: imageCount },
        (_, idx) =>
          `https://picsum.photos/seed/${iid}-${idx}/800/600`,
      );
      const createdAt = daysAgo(randomInt(1, 60));

      const post = await prisma.imagePost.upsert({
        where: { id: iid },
        update: {},
        create: {
          id: iid,
          title,
          description: `${title} —— 创作分享`,
          images,
          views: randomInt(20, 8000),
          status: "PUBLISHED",
          uploaderId: uploader.id,
          createdAt,
          updatedAt: createdAt,
        },
      });

      const tagSlugs = pickN(TAGS.map((t) => t.slug), randomInt(1, 3));
      for (const slug of tagSlugs) {
        const tag = tagRecords[slug];
        if (!tag) continue;
        await prisma.tagOnImagePost
          .create({ data: { imagePostId: post.id, tagId: tag.id } })
          .catch(() => {});
      }

      imageRecords.push({ id: post.id });
    }
    console.log(`   ✓ 创建 ${imageRecords.length} 个图片帖子`);

    // ============================== 视频评论 ==============================
    console.log("💬 创建视频评论...");
    let videoCommentCount = 0;
    for (const video of videoRecords.slice(0, 15)) {
      const commentCount = randomInt(3, 10);
      const topCommentIds: string[] = [];

      for (let c = 0; c < commentCount; c++) {
        const userId = pick(allUserIds);
        const isReply = c > 2 && topCommentIds.length > 0 && Math.random() > 0.5;

        const comment = await prisma.comment.create({
          data: {
            content: pick(COMMENT_TEXTS),
            userId,
            videoId: video.id,
            parentId: isReply ? pick(topCommentIds) : null,
            likes: randomInt(0, 30),
            createdAt: daysAgo(randomInt(0, 30)),
          },
        });

        if (!isReply) topCommentIds.push(comment.id);
        videoCommentCount++;
      }
    }
    console.log(`   ✓ 创建 ${videoCommentCount} 条视频评论`);

    // ============================== 游戏评论 ==============================
    console.log("💬 创建游戏评论...");
    let gameCommentCount = 0;
    for (const game of gameRecords.slice(0, 6)) {
      const commentCount = randomInt(2, 6);
      for (let c = 0; c < commentCount; c++) {
        await prisma.gameComment.create({
          data: {
            content: pick([
              "这游戏太上头了！",
              "画风很棒，玩法也不错",
              "有攻略吗？求分享",
              "通关了！花了 30 小时",
              "BGM 太好听了",
              "推荐给喜欢" +
                pick(["RPG", "AVG", "SLG"]) +
                "的朋友",
              "期待续作",
              "剧情展开让人意想不到",
            ]),
            userId: pick(allUserIds),
            gameId: game.id,
            likes: randomInt(0, 15),
            createdAt: daysAgo(randomInt(0, 30)),
          },
        });
        gameCommentCount++;
      }
    }
    console.log(`   ✓ 创建 ${gameCommentCount} 条游戏评论`);

    // ============================== 图帖评论 ==============================
    console.log("💬 创建图帖评论...");
    let imageCommentCount = 0;
    for (const post of imageRecords.slice(0, 8)) {
      const commentCount = randomInt(1, 5);
      for (let c = 0; c < commentCount; c++) {
        await prisma.imagePostComment.create({
          data: {
            content: pick([
              "画得好好看！",
              "色彩搭配太舒服了",
              "大佬求教程",
              "收藏了！",
              "这张构图很有感觉",
              "催更催更！",
              "笔触好细腻",
              "太绝了",
            ]),
            userId: pick(allUserIds),
            imagePostId: post.id,
            likes: randomInt(0, 10),
            createdAt: daysAgo(randomInt(0, 20)),
          },
        });
        imageCommentCount++;
      }
    }
    console.log(`   ✓ 创建 ${imageCommentCount} 条图帖评论`);

    // ============================== 点赞 / 收藏 / 观看记录 ==============================
    console.log("❤️  创建互动数据...");
    let likeCount = 0;
    let favCount = 0;
    let historyCount = 0;

    for (const userId of allUserIds) {
      const likedVideos = pickN(videoRecords, randomInt(3, 10));
      for (const v of likedVideos) {
        await prisma.like
          .create({
            data: { userId, videoId: v.id, createdAt: daysAgo(randomInt(0, 60)) },
          })
          .catch(() => {});
        likeCount++;
      }

      const favVideos = pickN(videoRecords, randomInt(1, 5));
      for (const v of favVideos) {
        await prisma.favorite
          .create({
            data: { userId, videoId: v.id, createdAt: daysAgo(randomInt(0, 60)) },
          })
          .catch(() => {});
        favCount++;
      }

      const watchedVideos = pickN(videoRecords, randomInt(5, 15));
      for (const v of watchedVideos) {
        await prisma.watchHistory
          .create({
            data: {
              userId,
              videoId: v.id,
              progress: randomInt(0, 1500),
              createdAt: daysAgo(randomInt(0, 30)),
            },
          })
          .catch(() => {});
        historyCount++;
      }

      const likedGames = pickN(gameRecords, randomInt(1, 4));
      for (const g of likedGames) {
        await prisma.gameLike
          .create({
            data: { userId, gameId: g.id, createdAt: daysAgo(randomInt(0, 60)) },
          })
          .catch(() => {});
      }
      const favGames = pickN(gameRecords, randomInt(0, 3));
      for (const g of favGames) {
        await prisma.gameFavorite
          .create({
            data: { userId, gameId: g.id, createdAt: daysAgo(randomInt(0, 60)) },
          })
          .catch(() => {});
      }

      const likedImages = pickN(imageRecords, randomInt(1, 5));
      for (const p of likedImages) {
        await prisma.imagePostLike
          .create({
            data: {
              userId,
              imagePostId: p.id,
              createdAt: daysAgo(randomInt(0, 30)),
            },
          })
          .catch(() => {});
      }
      const favImages = pickN(imageRecords, randomInt(0, 3));
      for (const p of favImages) {
        await prisma.imagePostFavorite
          .create({
            data: {
              userId,
              imagePostId: p.id,
              createdAt: daysAgo(randomInt(0, 30)),
            },
          })
          .catch(() => {});
      }
    }
    console.log(
      `   ✓ 创建 ${likeCount} 个视频点赞、${favCount} 个收藏、${historyCount} 条观看记录（+ 游戏 / 图帖互动）`,
    );

    // ============================== 播放列表 ==============================
    console.log("📋 创建播放列表...");
    const playlistUser = userRecords.find((u) => u.username === "viewer")!;
    const playlist = await prisma.playlist.create({
      data: {
        name: "我的追番列表",
        description: "本季度在追的动画",
        isPublic: true,
        userId: playlistUser.id,
      },
    });
    const playlistVideos = pickN(videoRecords, 8);
    for (let i = 0; i < playlistVideos.length; i++) {
      await prisma.playlistItem
        .create({
          data: {
            playlistId: playlist.id,
            videoId: playlistVideos[i].id,
            sortOrder: i,
          },
        })
        .catch(() => {});
    }
    console.log("   ✓ 创建 1 个播放列表（含 8 个视频）");

    // ============================== 关注关系 ==============================
    console.log("🤝 创建关注关系...");
    let followCount = 0;
    for (const user of userRecords) {
      const toFollow = pickN(
        userRecords.filter((u) => u.id !== user.id),
        randomInt(1, 4),
      );
      for (const target of toFollow) {
        await prisma.follow
          .create({
            data: { followerId: user.id, followingId: target.id },
          })
          .catch(() => {});
        followCount++;
      }
    }
    console.log(`   ✓ 创建 ${followCount} 个关注关系`);

    // ============================== 通知 ==============================
    console.log("🔔 创建通知...");
    for (const user of userRecords.slice(0, 5)) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "SYSTEM",
          title: "欢迎加入 MoeStream！",
          content: "感谢注册，快去探索精彩内容吧 🎉",
          createdAt: daysAgo(randomInt(10, 30)),
        },
      });
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "LIKE",
          title: "有人给你的内容点赞了",
          content: "你的投稿获得了新的点赞！",
          data: { videoId: pick(videoRecords).id },
          createdAt: daysAgo(randomInt(0, 10)),
        },
      });
    }
    console.log("   ✓ 创建通知消息");

    // ============================== 留言板 ==============================
    console.log("📝 创建留言板消息...");
    for (const msg of GUESTBOOK_MESSAGES) {
      await prisma.guestbookMessage.create({
        data: {
          content: msg,
          userId: pick(allUserIds),
          likes: randomInt(0, 10),
          createdAt: daysAgo(randomInt(0, 60)),
        },
      });
    }
    console.log(`   ✓ 创建 ${GUESTBOOK_MESSAGES.length} 条留言`);

    // ============================== 友情链接 ==============================
    console.log("🔗 创建友情链接...");
    const friendLinks = [
      { name: "Bangumi", url: "https://bgm.tv", description: "番组计划" },
      {
        name: "MyAnimeList",
        url: "https://myanimelist.net",
        description: "全球最大动画数据库",
      },
      {
        name: "AniList",
        url: "https://anilist.co",
        description: "动画追踪与发现平台",
      },
    ];
    for (let i = 0; i < friendLinks.length; i++) {
      await prisma.friendLink.upsert({
        where: { id: `seed-friend-${i}` },
        update: {},
        create: {
          id: `seed-friend-${i}`,
          ...friendLinks[i],
          sort: friendLinks.length - i,
          visible: true,
        },
      });
    }
    console.log(`   ✓ 创建 ${friendLinks.length} 个友情链接`);

    // ============================== 搜索记录 ==============================
    console.log("🔍 创建搜索记录...");
    const searchKeywords = [
      "异世界",
      "恋爱",
      "热血",
      "芙莉莲",
      "咒术回战",
      "鬼灭之刃",
      "RPG",
      "治愈",
    ];
    for (const keyword of searchKeywords) {
      await prisma.searchRecord.create({
        data: {
          keyword,
          userId: pick(allUserIds),
          resultCount: randomInt(1, 50),
          createdAt: daysAgo(randomInt(0, 14)),
        },
      });
    }
    console.log(`   ✓ 创建 ${searchKeywords.length} 条搜索记录`);

    // ============================== 完成 ==============================
    console.log("\n✅ Seed 完成！\n");
    console.log("📋 数据概览：");
    console.log(`   用户: ${userRecords.length} 个（密码: password123）`);
    console.log(`   视频: ${videoRecords.length} 个`);
    console.log(`   游戏: ${gameRecords.length} 个`);
    console.log(`   图帖: ${imageRecords.length} 个`);
    console.log(`   标签: ${TAGS.length} 个`);
    console.log("");
    console.log("🔑 测试账号：");
    for (const u of USERS_DATA) {
      console.log(`   ${u.email} / password123 (${u.role})`);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
