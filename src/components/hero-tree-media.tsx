"use client";

import { useEffect, useRef, useState } from "react";

export function HeroTreeMedia() {
  const [videoStatus, setVideoStatus] = useState<"loading" | "playing" | "error">("loading");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      if (reducedMotion.matches) {
        video.pause();
        setVideoStatus("loading");
        return;
      }

      void video.play().catch(() => setVideoStatus("error"));
    };

    syncPlayback();
    reducedMotion.addEventListener("change", syncPlayback);
    return () => reducedMotion.removeEventListener("change", syncPlayback);
  }, []);

  return (
    <div className="hero__media span-7 start-6" data-video-state={videoStatus} role="img" aria-label="Origami Sakura tree with animated blossoms, paper cranes, and drifting petals">
      <video
        ref={videoRef}
        className="hero__video"
        aria-hidden="true"
        tabIndex={-1}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/hero/origami-sakura-tree.webp"
        onPlaying={() => setVideoStatus("playing")}
        onError={() => setVideoStatus("error")}
      >
        <source src="/hero/origami-sakura-tree.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
