import type { ReactNode } from "react";
import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function ProductPage({
  eyebrow,
  title,
  description,
  children,
  className = "",
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <>
      <SiteHeader />
      <main className={`origami-theme product-page ${className}`} id="top">
        <section className="product-hero" data-enter aria-labelledby="product-page-title">
          <div className="wrap grid product-hero__wrap">
            <div className="product-hero__copy">
              <p className="product-eyebrow"><span className="dot" aria-hidden="true" />{eyebrow}</p>
              <h1 id="product-page-title">{title}</h1>
              <p className="product-intro">{description}</p>
            </div>
            <div className="product-hero__visual" aria-hidden="true">
              <Image src="/hero/origami-sakura-tree.webp" alt="" width={1536} height={1024} sizes="(max-width: 800px) 100vw, 52vw" preload />
            </div>
          </div>
        </section>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}

export function ProductSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`product-section ${className}`} data-reveal>
      <div className="wrap">
        <h2>{title}</h2>
        {children}
      </div>
    </section>
  );
}

export function PaperPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`paper-panel ${className}`}>{children}</div>;
}
