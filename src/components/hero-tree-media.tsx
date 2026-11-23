"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function HeroTreeMedia() {
  const [videoStatus, setVideoStatus] = useState<"loading" | "playing" | "paused" | "error">("loading");
  const [userPaused, setUserPaused] = useState(false);
  const [motionReduced, setMotionReduced] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      setMotionReduced(reducedMotion.matches);
      if (reducedMotion.matches) {
        video.pause();
        setVideoStatus("paused");
        return;
      }
      if (userPaused) {
        video.pause();
        setVideoStatus("paused");
        return;
      }

      void video.play().catch(() => setVideoStatus("error"));
    };

    syncPlayback();
    reducedMotion.addEventListener("change", syncPlayback);
    return () => reducedMotion.removeEventListener("change", syncPlayback);
  }, [userPaused]);

  function togglePlayback() {
    const video = videoRef.current;
    if (!video || motionReduced) return;
    if (video.paused) {
      setUserPaused(false);
      void video.play().catch(() => setVideoStatus("error"));
    } else {
      setUserPaused(true);
      video.pause();
      setVideoStatus("paused");
    }
  }

  return (
    <div className="hero__media hero-tree-media span-7 start-6" data-video-state={videoStatus} role="group" aria-label="Origami Sakura tree animation">
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
      {!motionReduced && videoStatus !== "error" ? <button
        className="btn btn--secondary loop-pause hero-tree-media__toggle"
        data-pause
        type="button"
        aria-label={videoStatus === "playing" ? "Pause Sakura tree animation" : "Play Sakura tree animation"}
        aria-pressed={userPaused}
        onClick={togglePlayback}
      >
        {videoStatus === "playing" ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
      </button> : null}
    </div>
  );
}
