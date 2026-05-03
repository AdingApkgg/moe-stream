import { getCoverFullUrl } from "@/lib/cover";

// 所有 JSON-LD 组件均为 Server Component，直接 SSR 输出 <script type="application/ld+json">
// 避免使用 next/script，因为它在客户端水合后才注入，搜索引擎首次抓取拿不到结构化数据

function jsonLdScript(id: string, data: unknown) {
  return (
    <script
      id={id}
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SSR 输出 JSON-LD 必需
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface VideoJsonLdProps {
  video: {
    id: string;
    title: string;
    description: string | null;
    videoUrl: string;
    coverUrl: string | null;
    duration: number | null;
    views: number;
    createdAt: Date | string;
    updatedAt: Date | string;
    uploader: {
      id: string;
      username: string;
      nickname: string | null;
    };
    tags: Array<{
      tag: {
        name: string;
      };
    }>;
  };
  baseUrl: string;
}

export function VideoJsonLd({ video, baseUrl }: VideoJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: video.description || video.title,
    thumbnailUrl: getCoverFullUrl(video.id, video.coverUrl),
    uploadDate: new Date(video.createdAt).toISOString(),
    contentUrl: video.videoUrl,
    embedUrl: `${baseUrl}/video/${video.id}`,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/WatchAction",
      userInteractionCount: video.views,
    },
    author: {
      "@type": "Person",
      name: video.uploader.nickname || video.uploader.username,
      url: `${baseUrl}/user/${video.uploader.id}`,
    },
    ...(video.duration && {
      duration: `PT${Math.floor(video.duration / 60)}M${video.duration % 60}S`,
    }),
    keywords: video.tags.map((t) => t.tag.name).join(", "),
  };
  return jsonLdScript("video-jsonld", data);
}

interface WebsiteJsonLdProps {
  siteName: string;
  siteUrl: string;
  description: string;
}

export function WebsiteJsonLd({ siteName, siteUrl, description }: WebsiteJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: siteUrl,
    description,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
  return jsonLdScript("website-jsonld", data);
}

interface BreadcrumbJsonLdProps {
  items: Array<{
    name: string;
    url: string;
  }>;
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return jsonLdScript("breadcrumb-jsonld", data);
}

interface OrganizationJsonLdProps {
  name: string;
  url: string;
  logo: string;
  contactEmail?: string | null;
}

export function OrganizationJsonLd({ name, url, logo, contactEmail }: OrganizationJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    logo,
    sameAs: [],
    ...(contactEmail && {
      contactPoint: {
        "@type": "ContactPoint",
        email: contactEmail,
        contactType: "customer service",
        availableLanguage: ["Chinese", "English"],
      },
    }),
  };
  return jsonLdScript("organization-jsonld", data);
}

interface VideoListJsonLdProps {
  videos: Array<{
    id: string;
    title: string;
    description?: string | null;
    coverUrl?: string | null;
    views: number;
    createdAt: Date | string;
    uploader: {
      nickname?: string | null;
      username: string;
    };
  }>;
  baseUrl: string;
}

/**
 * 视频列表结构化数据 - 用于首页和列表页
 */
export function VideoListJsonLd({ videos, baseUrl }: VideoListJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: videos.slice(0, 10).map((video, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "VideoObject",
        "@id": `${baseUrl}/video/${video.id}`,
        name: video.title,
        description: video.description || video.title,
        thumbnailUrl: getCoverFullUrl(video.id, video.coverUrl),
        uploadDate: new Date(video.createdAt).toISOString(),
        author: {
          "@type": "Person",
          name: video.uploader.nickname || video.uploader.username,
        },
        interactionStatistic: {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/WatchAction",
          userInteractionCount: video.views,
        },
      },
    })),
  };
  return jsonLdScript("videolist-jsonld", data);
}

interface GameListJsonLdProps {
  games: Array<{
    id: string;
    title: string;
    description?: string | null;
    coverUrl?: string | null;
    createdAt: Date | string;
  }>;
  baseUrl: string;
}

/**
 * 游戏列表结构化数据
 */
export function GameListJsonLd({ games, baseUrl }: GameListJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: games.slice(0, 10).map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "VideoGame",
        "@id": `${baseUrl}/game/${game.id}`,
        name: game.title,
        description: game.description || game.title,
        ...(game.coverUrl && {
          image: game.coverUrl.startsWith("http") ? game.coverUrl : `${baseUrl}${game.coverUrl}`,
        }),
        datePublished: new Date(game.createdAt).toISOString(),
      },
    })),
  };
  return jsonLdScript("gamelist-jsonld", data);
}

interface ImageListJsonLdProps {
  posts: Array<{
    id: string;
    title: string;
    description?: string | null;
    images?: unknown;
    createdAt: Date | string;
  }>;
  baseUrl: string;
}

/**
 * 图片合集列表结构化数据
 */
export function ImageListJsonLd({ posts, baseUrl }: ImageListJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: posts.slice(0, 10).map((post, index) => {
      const images = (post.images as string[] | null) ?? [];
      const firstImage = images[0];
      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "ImageGallery",
          "@id": `${baseUrl}/image/${post.id}`,
          name: post.title,
          description: post.description || post.title,
          ...(firstImage && {
            image: firstImage.startsWith("http") ? firstImage : `${baseUrl}${firstImage}`,
          }),
          datePublished: new Date(post.createdAt).toISOString(),
        },
      };
    }),
  };
  return jsonLdScript("imagelist-jsonld", data);
}

interface FAQJsonLdProps {
  items: Array<{
    question: string;
    answer: string;
  }>;
}

/**
 * FAQ 结构化数据
 */
export function FAQJsonLd({ items }: FAQJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
  return jsonLdScript("faq-jsonld", data);
}

interface CollectionPageJsonLdProps {
  name: string;
  description: string;
  url: string;
  numberOfItems?: number;
}

/**
 * 集合页面结构化数据 - 用于标签页等列表页面
 */
export function CollectionPageJsonLd({ name, description, url, numberOfItems }: CollectionPageJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url,
    ...(numberOfItems !== undefined && { numberOfItems }),
  };
  return jsonLdScript("collection-jsonld", data);
}

interface ProfilePageJsonLdProps {
  name: string;
  url: string;
  image?: string | null;
  description?: string | null;
}

/**
 * 用户主页结构化数据
 */
export function ProfilePageJsonLd({ name, url, image, description }: ProfilePageJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name,
      url,
      ...(image && { image }),
      ...(description && { description }),
    },
  };
  return jsonLdScript("profile-jsonld", data);
}

interface VideoGameJsonLdProps {
  game: {
    id: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    gameType: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    uploader: {
      id: string;
      username: string;
      nickname: string | null;
    };
    tags: Array<{ tag: { name: string } }>;
  };
  baseUrl: string;
}

/**
 * 单个游戏结构化数据
 */
export function VideoGameJsonLd({ game, baseUrl }: VideoGameJsonLdProps) {
  const cover = game.coverUrl
    ? game.coverUrl.startsWith("http")
      ? game.coverUrl
      : `${baseUrl}${game.coverUrl}`
    : undefined;
  const data = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: game.description || game.title,
    url: `${baseUrl}/game/${game.id}`,
    ...(cover && { image: cover }),
    ...(game.gameType && { genre: game.gameType }),
    datePublished: new Date(game.createdAt).toISOString(),
    dateModified: new Date(game.updatedAt).toISOString(),
    author: {
      "@type": "Person",
      name: game.uploader.nickname || game.uploader.username,
      url: `${baseUrl}/user/${game.uploader.id}`,
    },
    keywords: game.tags.map((t) => t.tag.name).join(", "),
  };
  return jsonLdScript("game-jsonld", data);
}

interface ImagePostJsonLdProps {
  post: {
    id: string;
    title: string;
    description: string | null;
    images: unknown;
    createdAt: Date | string;
    updatedAt: Date | string;
    uploader: {
      id: string;
      username: string;
      nickname: string | null;
    };
    tags: Array<{ tag: { name: string } }>;
  };
  baseUrl: string;
}

/**
 * 单个图片合集结构化数据
 */
export function ImagePostJsonLd({ post, baseUrl }: ImagePostJsonLdProps) {
  const images = (post.images as string[] | null) ?? [];
  const fullImageUrls = images.map((img) => (img.startsWith("http") ? img : `${baseUrl}${img}`));
  const data = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: post.title,
    description: post.description || post.title,
    url: `${baseUrl}/image/${post.id}`,
    ...(fullImageUrls.length > 0 && { image: fullImageUrls }),
    datePublished: new Date(post.createdAt).toISOString(),
    dateModified: new Date(post.updatedAt).toISOString(),
    author: {
      "@type": "Person",
      name: post.uploader.nickname || post.uploader.username,
      url: `${baseUrl}/user/${post.uploader.id}`,
    },
    keywords: post.tags.map((t) => t.tag.name).join(", "),
  };
  return jsonLdScript("imagepost-jsonld", data);
}
