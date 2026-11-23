"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";

export function StepUpContinue({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const { language } = useLocale();
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const response = await fetch("/api/auth/step-up", { method: "POST", credentials: "same-origin", cache: "no-store" });
        const result = await response.json() as { status?: string };
        if (!active) return;
        if (response.status === 401) {
          window.location.replace(`/auth/login?next=${encodeURIComponent(nextPath)}`);
          return;
        }
        if (response.ok && result.status === "ready") {
          window.location.replace(nextPath);
          return;
        }
        if (response.ok && result.status === "required") {
          router.replace(`/auth/mfa?next=${encodeURIComponent(nextPath)}`);
          return;
        }
        setMessage(language === "bn"
          ? "এই সাইন-ইন যাচাই করা যায়নি। আবার সাইন ইন করুন, অথবা প্রশাসকের সঙ্গে যোগাযোগ করুন।"
          : "This sign-in could not be verified. Sign in again or contact the platform administrator.");
      } catch {
        if (active) setMessage(language === "bn" ? "যাচাই সাময়িকভাবে অনুপলব্ধ। আবার চেষ্টা করুন।" : "Verification is temporarily unavailable. Try again.");
      }
    }
    void check();
    return () => { active = false; };
  }, [language, nextPath, router]);

  return <div className="admin-mfa-challenge" aria-live="polite">
    <p role={message ? "alert" : "status"}>{message || (language === "bn" ? "আপনার সাইন-ইন সেশন যাচাই করা হচ্ছে…" : "Checking your sign-in session…")}</p>
    {message ? <Link className="btn btn--secondary" href="/auth/login">{language === "bn" ? "সাইন ইন পৃষ্ঠায় ফিরুন" : "Return to sign in"}</Link> : null}
  </div>;
}
