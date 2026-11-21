import type { Metadata, Viewport } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "JLPT Mock Exams for N1–N5",
  description: "Prepare for JLPT N1–N5 with timed mock exams, answer explanations, and focused practice from reviewed questions.",
  openGraph: {
    title: "JLPT Mock Exams for N1–N5",
    description: "Timed JLPT practice with answer explanations and mistake review.",
    type: "website",
    images: [{ url: "/share.jpg", width: 1200, height: 630, alt: "Origami Sakura tree on a warm paper background" }],
  },
  twitter: { card: "summary_large_image", images: ["/share.jpg"] },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBFAF7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-type="software" data-radius="soft" data-ground="sand" data-buttons="solid" data-motion>
      <head>
        <meta name="page-type" content="software" />
        <meta name="site-kind" content="software" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400..700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <link rel="preload" as="image" href="/hero/origami-sakura-tree.webp" type="image/webp" />
        <link rel="modulepreload" href="/assets/moments/moments.js" />
        <link rel="modulepreload" href="/assets/moments/lib.js" />
        <link rel="modulepreload" href="/assets/moments/line-carries-colour/moment.js" />
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('m-enter', 'mo-js'); setTimeout(() => document.documentElement.classList.add('m-enter-done', 'mo-safe'), 2500);" }} />
        <link rel="stylesheet" href="/assets/system.css" />
        <link rel="stylesheet" href="/assets/ui/base.css" />
        <link rel="stylesheet" href="/assets/ui/cards.css" />
        <link rel="stylesheet" href="/assets/ui/window/fragment.css" />
        <link rel="stylesheet" href="/assets/motion/motion.css" />
        <link rel="stylesheet" href="/assets/backgrounds/backgrounds.css" />
        <link rel="stylesheet" href="/assets/layout/layout.css" />
        <link rel="stylesheet" href="/assets/icons/icon.css" />
        <link rel="stylesheet" href="/assets/moments/line-carries-colour/moment.css" />
        <link rel="stylesheet" href="/css/site.css" />
      </head>
      <body>
        {children}
        <Script src="/assets/system.js" type="module" strategy="afterInteractive" />
        <Script src="/assets/layout/layout.js" type="module" strategy="afterInteractive" />
        <Script src="/assets/motion/motion.js" type="module" strategy="afterInteractive" />
      </body>
    </html>
  );
}
