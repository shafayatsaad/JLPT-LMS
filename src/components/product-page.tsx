import type { ReactNode } from "react";
import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LocalizedText } from "@/components/i18n/localized-text";
import type { MessageKey } from "@/lib/i18n";

export function ProductPage({
  eyebrow,
  title,
  description,
  children,
  className = "",
  eyebrowKey,
  titleKey,
  titleValues,
  descriptionKey,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  eyebrowKey?: MessageKey;
  titleKey?: MessageKey;
  titleValues?: Record<string, string | number>;
  descriptionKey?: MessageKey;
}) {
  return (
    <>
      <SiteHeader />
      <main className={`origami-theme product-page ${className}`} id="top" tabIndex={-1}>
        <section className="product-hero" data-enter aria-labelledby="product-page-title">
          <div className="wrap grid product-hero__wrap">
            <div className="product-hero__copy">
              <p className="product-eyebrow"><span className="dot" aria-hidden="true" />{eyebrowKey ? <LocalizedText messageKey={eyebrowKey} /> : eyebrow}</p>
              <h1 id="product-page-title">{titleKey ? <LocalizedText messageKey={titleKey} values={titleValues} /> : title}</h1>
              <p className="product-intro">{descriptionKey ? <LocalizedText messageKey={descriptionKey} /> : description}</p>
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
  titleKey,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  titleKey?: MessageKey;
}) {
  return (
    <section className={`product-section ${className}`} data-reveal>
      <div className="wrap">
        <h2>{titleKey ? <LocalizedText messageKey={titleKey} /> : title}</h2>
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
