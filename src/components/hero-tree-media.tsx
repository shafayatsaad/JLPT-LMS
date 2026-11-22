"use client";

import Image from "next/image";
import { useState } from "react";

export function HeroTreeMedia() {
  const [videoStatus, setVideoStatus] = useState<"loading" | "playing" | "error">("loading");

  return (
    <div className="hero__media span-7 start-6" data-video-state={videoStatus} role="group" aria-label="Full-frame Sakura animation beside the complete origami tree illustration">
      <div className="hero__motion">
        <video
          className="hero__video"
          aria-hidden="true"
          tabIndex={-1}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="/hero/origami-sakura-motion-poster.jpg"
          onPlaying={() => setVideoStatus("playing")}
          onError={() => setVideoStatus("error")}
        >
          <source src="/hero/origami-sakura-tree.mp4" type="video/mp4" />
        </video>
      </div>
      <Image
        src="/hero/origami-sakura-tree.webp"
        className="hero__still"
        alt="A cherry blossom tree made from folded pink and ivory paper, with origami cranes and petals."
        width={1536}
        height={1024}
        priority
        sizes="(max-width: 639px) 43vw, (max-width: 1023px) 32vw, 25vw"
        data-source="client"
        data-subject="origami Sakura tree"
      />
    </div>
  );
}
