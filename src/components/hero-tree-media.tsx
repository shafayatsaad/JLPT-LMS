"use client";

import Image from "next/image";
import { useState } from "react";

export function HeroTreeMedia() {
  const [videoStatus, setVideoStatus] = useState<"loading" | "playing" | "error">("loading");

  return (
    <div className="hero__media span-6 start-7" data-video-state={videoStatus} aria-label="Origami Sakura tree hero image">
      <Image
        src="/hero/origami-sakura-tree.webp"
        className="hero__still"
        alt="A cherry blossom tree made from folded pink and ivory paper, with origami cranes and petals."
        width={1536}
        height={1024}
        priority
        sizes="(max-width: 1023px) 100vw, 50vw"
        data-source="client"
        data-subject="origami Sakura tree"
      />
      <video
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
