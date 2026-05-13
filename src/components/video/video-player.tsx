"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import Hls from "hls.js";

interface VideoPlayerProps {
  url: string;
  poster?: string | null;
  onProgress?: (progress: { played: number; playedSeconds: number }) => void;
  onEnded?: () => void;
  initialProgress?: number;
  autoStart?: boolean;
}

export interface VideoPlayerRef {
  seekTo: (seconds: number) => void;
  seekRelative: (deltaSeconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  togglePlay: () => boolean;
  toggleMute: () => boolean;
  setVolumeDelta: (delta: number) => number;
  toggleFullscreen: () => void;
  setRate: (delta: number) => number;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(function VideoPlayer(
  { url, poster, onProgress, onEnded, initialProgress = 0, autoStart = true },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const getVideoElement = useCallback(() => videoRef.current, []);

  useImperativeHandle(
    ref,
    () => ({
      seekTo: (seconds: number) => {
        const video = getVideoElement();
        if (video) {
          video.currentTime = seconds;
        }
      },
      seekRelative: (deltaSeconds: number) => {
        const video = getVideoElement();
        if (!video) return;
        const next = Math.max(0, Math.min(video.duration || 0, video.currentTime + deltaSeconds));
        video.currentTime = next;
      },
      getCurrentTime: () => playedSeconds,
      getDuration: () => duration,
      togglePlay: () => {
        const video = getVideoElement();
        if (!video) return false;
        if (video.paused) {
          video.play().catch(() => {});
          return true;
        }
        video.pause();
        return false;
      },
      toggleMute: () => {
        const video = getVideoElement();
        if (!video) return false;
        video.muted = !video.muted;
        return video.muted;
      },
      setVolumeDelta: (delta: number) => {
        const video = getVideoElement();
        if (!video) return 0;
        const next = Math.max(0, Math.min(1, video.volume + delta));
        video.volume = next;
        if (next > 0 && video.muted) video.muted = false;
        return next;
      },
      toggleFullscreen: () => {
        const video = getVideoElement();
        if (!video) return;
        const wrapper = video.parentElement;
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else if (wrapper?.requestFullscreen) {
          wrapper.requestFullscreen().catch(() => {});
        }
      },
      setRate: (delta: number) => {
        const video = getVideoElement();
        if (!video) return 1;
        const next = Math.max(0.25, Math.min(3, video.playbackRate + delta));
        video.playbackRate = next;
        return next;
      },
    }),
    [playedSeconds, duration, getVideoElement],
  );

  useEffect(() => {
    const video = getVideoElement();
    if (!video) return;

    let hls: Hls | null = null;
    const canPlayNativeHls = video.canPlayType("application/vnd.apple.mpegurl");
    const isHlsSource = /\.m3u8(\?|#|$)/i.test(url);

    if (isHlsSource && Hls.isSupported() && !canPlayNativeHls) {
      hls = new Hls();
      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls?.loadSource(url);
      });
    } else {
      video.src = url;
    }

    return () => {
      // 重置 ready 状态，在 cleanup 中调用避免 lint 错误
      setIsReady(false);
      if (hls) {
        hls.destroy();
      }
      if (video.src) {
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [url, getVideoElement]);

  useEffect(() => {
    const video = getVideoElement();
    if (!video) return;

    const handleTimeUpdate = () => {
      setPlayedSeconds(video.currentTime);
      if (video.duration && isFinite(video.duration)) {
        onProgress?.({
          played: video.currentTime / video.duration,
          playedSeconds: video.currentTime,
        });
      }
    };
    const handleDurationChange = () => {
      if (video.duration && isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };
    const handleLoadedMetadata = () => {
      if (initialProgress > 0) {
        video.currentTime = initialProgress;
      }
      // 恢复保存的音量和播放速度
      try {
        const savedVolume = localStorage.getItem("video-player-volume");
        const savedPlaybackRate = localStorage.getItem("video-player-playback-rate");
        if (savedVolume !== null) {
          video.volume = parseFloat(savedVolume);
        }
        if (savedPlaybackRate !== null) {
          video.playbackRate = parseFloat(savedPlaybackRate);
        }
      } catch {
        // localStorage 不可用时忽略
      }
    };
    const handleCanPlay = () => {
      setIsReady(true);
    };
    const handleEnded = () => onEnded?.();

    // 保存音量和播放速度变化
    const handleVolumeChange = () => {
      try {
        localStorage.setItem("video-player-volume", video.volume.toString());
      } catch {
        // localStorage 不可用时忽略
      }
    };
    const handleRateChange = () => {
      try {
        localStorage.setItem("video-player-playback-rate", video.playbackRate.toString());
      } catch {
        // localStorage 不可用时忽略
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("volumechange", handleVolumeChange);
    video.addEventListener("ratechange", handleRateChange);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("volumechange", handleVolumeChange);
      video.removeEventListener("ratechange", handleRateChange);
    };
  }, [getVideoElement, initialProgress, onEnded, onProgress]);

  return (
    <div className="relative w-full aspect-video bg-black">
      <video
        ref={videoRef}
        className={`w-full h-full transition-opacity duration-300 ${isReady ? "opacity-100" : "opacity-0"}`}
        playsInline
        preload="metadata"
        poster={poster || undefined}
        controls
        autoPlay={autoStart}
      />
      {/* 封面图 + 加载指示器，视频就绪后隐藏 */}
      {!isReady && (
        <div className="absolute inset-0 transition-opacity duration-300">
          {poster && (
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${poster})` }} />
          )}
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="relative">
              {/* 旋转的加载环 */}
              <div className="w-16 h-16 rounded-full border-[3px] border-white/20 border-t-white animate-spin" />
              {/* 中央播放图标 */}
              <svg
                className="absolute inset-0 m-auto w-6 h-6 text-white drop-shadow-lg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="text-sm text-white/80 font-medium">视频加载中...</span>
          </div>
        </div>
      )}
    </div>
  );
});
