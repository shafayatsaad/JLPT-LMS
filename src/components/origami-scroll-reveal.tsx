"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function OrigamiScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    window.dispatchEvent(new Event("jlpt:route-change"));
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (reducedMotion.matches || !("IntersectionObserver" in window)) return;

    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          "#top.origami-theme > .section > .wrap > .section-head",
          "#top.origami-theme #practice .app-frame",
          "#top.origami-theme #review .review-step",
          "#top.origami-theme #levels .format-picker",
          "#top.origami-theme #questions .faq-item",
          "#top.origami-theme #questions .content-review-preview",
          "#closing.origami-theme > .wrap > *",
          ".product-shell .product-section__heading",
          ".product-shell .level-section-card",
          ".product-shell .preview-section-row",
          ".product-shell .instruction-card",
          ".product-shell .preview-disclosure",
          ".product-shell .product-next-step",
          ".product-shell .answer-review-card",
          ".product-shell .result-counts",
          ".product-shell .product-note",
          ".product-page .product-section > .wrap > h2",
          ".product-page .paper-panel",
          ".product-page .admin-link-list a",
        ].join(", "),
      ),
    );
    const targets = candidates.filter(
      (element) => !element.closest("[data-moment]") && element.getBoundingClientRect().top > window.innerHeight * 0.82,
    );

    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const element = entry.target as HTMLElement;
          element.dataset.origamiReveal = "shown";
          observer.unobserve(element);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    const revealVisibleFallback = () => {
      for (const element of targets) {
        if (element.dataset.origamiReveal !== "pending") continue;
        const bounds = element.getBoundingClientRect();
        if (bounds.top < window.innerHeight * 0.94 && bounds.bottom > window.innerHeight * 0.06) {
          element.dataset.origamiReveal = "shown";
          observer.unobserve(element);
        }
      }
    };

    targets.forEach((element, index) => {
      element.dataset.origamiReveal = "pending";
      const isCard = element.matches(".review-step, .app-frame, .format-picker, .faq-item, .content-review-preview, .product-page .paper-panel, .product-page .admin-link-list a");
      element.style.setProperty("--origami-reveal-delay", `${(index % 3) * 110}ms`);
      element.style.setProperty("--origami-reveal-lift", isCard ? "24px" : "18px");
      element.style.setProperty("--origami-reveal-fold", isCard ? "-5deg" : "-3deg");
      observer.observe(element);
    });
    root.classList.add("origami-scroll-motion-ready");
    window.addEventListener("scroll", revealVisibleFallback, { passive: true });
    window.addEventListener("resize", revealVisibleFallback);

    return () => {
      window.removeEventListener("scroll", revealVisibleFallback);
      window.removeEventListener("resize", revealVisibleFallback);
      observer.disconnect();
      root.classList.remove("origami-scroll-motion-ready");
      targets.forEach((element) => {
        delete element.dataset.origamiReveal;
        element.style.removeProperty("--origami-reveal-delay");
        element.style.removeProperty("--origami-reveal-lift");
        element.style.removeProperty("--origami-reveal-fold");
      });
    };
  }, [pathname]);

  return null;
}
