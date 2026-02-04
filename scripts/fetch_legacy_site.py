#!/usr/bin/env python3
"""
旧站视频抓取脚本
从 tv.mikiacg.org 抓取视频数据并导出为批量导入格式
"""

import re
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime

BASE_URL = "https://tv.mikiacg.org"
MAX_PAGES = 10  # 最大抓取页数
CONCURRENCY = 3  # 并发数
TIMEOUT = 20  # 请求超时时间

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


@dataclass
class Episode:
    num: int
    title: str
    video_url: str


@dataclass
class VideoInfo:
    id: str
    title: str
    author: str
    description: str
    cover_url: str
    video_url: str
    tags: list[str] = field(default_factory=list)
    episodes: list[Episode] = field(default_factory=list)
    page_url: str = ""
    error: Optional[str] = None


def extract_author(title: str) -> str:
    """从标题提取作者名"""
    patterns = [
        # 【类型】作者名「...」 或 【类型】作者名（...）
        r"【[^】]+】\s*([^「（【\n]+?)\s*[「（]",
        # 【类型】作者名 - 第X集
        r"【[^】]+】\s*([^-–\n]+?)\s*[-–]\s*第?\d",
        # 【类型】作者名（不含特殊字符的剩余部分）
        r"【[^】]+】\s*([A-Za-z0-9_\-\s]+?)(?:\s*$|\s*[-–])",
        # 【类型】作者名（日文/中文作者）
        r"【[^】]+】\s*([^\s「【\-（]+)",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, title)
        if match:
            author = match.group(1).strip()
            if 2 <= len(author) <= 50:
                return author
    return "未分类"


def get_video_links(page: int) -> list[str]:
    """获取列表页的所有视频链接"""
    if page == 1:
        url = f"{BASE_URL}/index.php/category/Video/"
    else:
        url = f"{BASE_URL}/index.php/category/Video/{page}/"
    
    for attempt in range(3):
        try:
            response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            response.raise_for_status()
            html = response.text
            
            # 提取所有文章链接
            matches = re.findall(r'href="([^"]*\/archives\/\d+\.html)"', html, re.I)
            links = set()
            for link in matches:
                if link.startswith("http"):
                    links.add(link)
                else:
                    links.add(BASE_URL + link)
            return list(links)
        except Exception as e:
            print(f"获取列表页 {page} 失败 (尝试 {attempt + 1}/3): {e}")
            if attempt < 2:
                time.sleep(1 * (attempt + 1))
    return []


def extract_from_page(page_url: str) -> Optional[VideoInfo]:
    """从视频页面提取信息"""
    match = re.search(r"/archives/(\d+)\.html", page_url)
    video_id = match.group(1) if match else str(hash(page_url))[:8]
    
    for attempt in range(3):
        try:
            if attempt > 0:
                time.sleep(0.5 * attempt)
            
            response = requests.get(page_url, headers=HEADERS, timeout=TIMEOUT)
            response.raise_for_status()
            html = response.text
            
            # 提取标题
            title = ""
            title_patterns = [
                r'<h1[^>]*class="[^"]*article-title[^"]*"[^>]*>([^<]+)</h1>',
                r'<meta[^>]*property="og:title"[^>]*content="([^"]+)"',
                r'<title>([^<]+)</title>',
            ]
            for pattern in title_patterns:
                m = re.search(pattern, html, re.I)
                if m:
                    title = m.group(1).strip()
                    # 清理标题
                    title = re.sub(r'\s*[-|]\s*咪咔映阁.*$', '', title)
                    break
            
            if not title:
                return None
            
            # 提取描述
            description = ""
            desc_patterns = [
                r'<meta[^>]*name="description"[^>]*content="([^"]+)"',
                r'<meta[^>]*property="og:description"[^>]*content="([^"]+)"',
                r'<div[^>]*class="[^"]*joe_detail__abstract[^"]*"[^>]*>([\s\S]*?)</div>',
            ]
            for pattern in desc_patterns:
                m = re.search(pattern, html, re.I)
                if m:
                    description = re.sub(r'<[^>]+>', '', m.group(1)).strip()
                    break
            
            # 提取标签 - 只从 article-tags 区域
            tags = []
            article_tags_match = re.search(
                r'<div[^>]*class="[^"]*article-tags[^"]*"[^>]*>([\s\S]*?)</div>',
                html, re.I
            )
            if article_tags_match:
                tag_content = article_tags_match.group(1)
                for m in re.finditer(r'<a[^>]*>#\s*([^<]+)</a>', tag_content, re.I):
                    tag = m.group(1).strip()
                    if tag and tag not in tags:
                        tags.append(tag)
            
            # 提取封面图
            cover_url = ""
            cover_patterns = [
                r'<meta[^>]*property="og:image"[^>]*content="([^"]+)"',
                r'<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"',
                r'<img[^>]*class="[^"]*joe_detail__thumb[^"]*"[^>]*src="([^"]+)"',
            ]
            for pattern in cover_patterns:
                m = re.search(pattern, html, re.I)
                if m:
                    cover_url = m.group(1)
                    break
            
            # 提取所有视频 URL - 支持多种格式
            video_extensions = r'(?:mp4|mkv|webm|avi|mov|m4v|flv|wmv|ts|m3u8)'
            video_patterns = [
                rf'["\'](https?://cdn\.mikiacg\.vip/[^"\']+\.{video_extensions})["\']',
                rf'["\'](https?://[^"\']*mikiacg[^"\']*\/[^"\']+\.{video_extensions})["\']',
                rf'url\s*:\s*["\'](https?://[^"\']+\.{video_extensions})["\']',
            ]
            video_urls = set()
            for pattern in video_patterns:
                for m in re.finditer(pattern, html, re.I):
                    video_urls.add(m.group(1))
            
            unique_video_urls = list(video_urls)
            
            # 提取剧集信息
            episodes = []
            for url in unique_video_urls:
                # 匹配任意视频格式的集数
                num_match = re.search(rf'/(\d+)\.{video_extensions}$', url, re.I)
                if num_match:
                    num = int(num_match.group(1))
                    if num > 0 and not any(e.num == num for e in episodes):
                        episodes.append(Episode(num=num, title=f"第{num}集", video_url=url))
            
            # 如果没有找到带集数的 URL，把第一个作为单集
            if not episodes and unique_video_urls:
                episodes.append(Episode(num=1, title="正片", video_url=unique_video_urls[0]))
            
            # 排序
            episodes.sort(key=lambda e: e.num)
            
            # 提取作者
            author = extract_author(title)
            
            return VideoInfo(
                id=video_id,
                title=title,
                author=author,
                description=description,
                cover_url=cover_url,
                video_url=unique_video_urls[0] if unique_video_urls else "",
                tags=tags,
                episodes=episodes,
                page_url=page_url,
            )
            
        except Exception as e:
            if attempt == 2:
                print(f"抓取失败: {page_url} - {e}")
                return VideoInfo(
                    id=video_id,
                    title="",
                    author="",
                    description="",
                    cover_url="",
                    video_url="",
                    page_url=page_url,
                    error=str(e),
                )
            time.sleep(1 * (attempt + 1))
    
    return None


def generate_import_text(videos: list[VideoInfo]) -> tuple[str, int]:
    """生成批量导入格式的文本"""
    # 过滤有效视频并按作者分组
    valid_videos = [v for v in videos if v.title and not v.error and (v.video_url or v.episodes)]
    
    grouped: dict[str, list[VideoInfo]] = {}
    for video in valid_videos:
        author = video.author or "未分类"
        if author not in grouped:
            grouped[author] = []
        grouped[author].append(video)
    
    # 生成导入文本
    lines = []
    video_count = 0
    
    for author, author_videos in sorted(grouped.items()):
        lines.append(f"合集：{author}")
        lines.append("")
        
        for video in author_videos:
            if len(video.episodes) > 1:
                # 多剧集
                valid_episodes = [ep for ep in video.episodes if ep.video_url]
                for ep in valid_episodes:
                    lines.append(f"标题：{video.title} - {ep.title}")
                    if video.description:
                        lines.append(f"描述：{video.description}")
                    if video.cover_url:
                        lines.append(f"封面：{video.cover_url}")
                    lines.append(f"视频：{ep.video_url}")
                    if video.tags:
                        lines.append(f"标签：{','.join(video.tags)}")
                    lines.append("")
                    video_count += 1
            elif video.video_url:
                # 单集
                lines.append(f"标题：{video.title}")
                if video.description:
                    lines.append(f"描述：{video.description}")
                if video.cover_url:
                    lines.append(f"封面：{video.cover_url}")
                lines.append(f"视频：{video.video_url}")
                if video.tags:
                    lines.append(f"标签：{','.join(video.tags)}")
                lines.append("")
                video_count += 1
    
    return "\n".join(lines), video_count


def main():
    print(f"开始抓取 {BASE_URL}/index.php/category/Video/")
    print(f"最大页数: {MAX_PAGES}, 并发数: {CONCURRENCY}")
    print("-" * 50)
    
    # 获取所有视频链接
    all_links = []
    for page in range(1, MAX_PAGES + 1):
        print(f"获取第 {page} 页...")
        links = get_video_links(page)
        if not links:
            print(f"第 {page} 页没有更多内容，停止")
            break
        all_links.extend(links)
        print(f"  找到 {len(links)} 个链接")
        time.sleep(0.3)
    
    unique_links = list(set(all_links))
    print(f"\n共找到 {len(unique_links)} 个唯一视频页面")
    print("-" * 50)
    
    # 并发抓取视频信息
    videos: list[VideoInfo] = []
    
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = {executor.submit(extract_from_page, link): link for link in unique_links}
        
        for i, future in enumerate(as_completed(futures), 1):
            link = futures[future]
            try:
                result = future.result()
                if result:
                    videos.append(result)
                    status = "✓" if result.video_url or result.episodes else "✗ 无视频"
                    if result.error:
                        status = f"✗ {result.error}"
                    print(f"[{i}/{len(unique_links)}] {result.title[:30] if result.title else '未知'}... {status}")
            except Exception as e:
                print(f"[{i}/{len(unique_links)}] 抓取失败: {link} - {e}")
    
    print("-" * 50)
    
    # 统计
    valid_count = len([v for v in videos if v.title and not v.error])
    no_video_count = len([v for v in videos if v.title and not v.error and not v.video_url and not v.episodes])
    error_count = len([v for v in videos if v.error])
    
    total_episodes = sum(
        len([ep for ep in v.episodes if ep.video_url]) if len(v.episodes) > 1 else (1 if v.video_url else 0)
        for v in videos if v.title and not v.error
    )
    
    print(f"抓取完成:")
    print(f"  合集数: {valid_count}")
    print(f"  视频数: {total_episodes}")
    print(f"  无视频: {no_video_count}")
    print(f"  失败数: {error_count}")
    
    # 生成导入文本
    import_text, video_count = generate_import_text(videos)
    
    # 保存到文件
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"legacy_import_{timestamp}.md"
    
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"# 旧站视频导入数据\n\n")
        f.write(f"抓取时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"合集数: {valid_count}, 视频数: {video_count}\n\n")
        f.write("---\n\n")
        f.write(import_text)
    
    print(f"\n已保存到: {output_file}")
    print(f"导出视频数: {video_count}")


if __name__ == "__main__":
    main()
