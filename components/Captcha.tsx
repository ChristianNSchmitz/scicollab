"use client";

import type {} from "altcha/types/react";
import { forwardRef, useEffect } from "react";

/**
 * The "I'm not a robot" box. ALTCHA widget, self-hosted: the challenge comes
 * from our own /api/captcha and nothing is loaded from a third party.
 * The widget adds a hidden field named "altcha" to the surrounding form.
 */
const Captcha = forwardRef<HTMLElement>(function Captcha(_props, ref) {
  useEffect(() => {
    // Web components only exist in the browser: load the widget there.
    void import("altcha");
  }, []);

  return (
    <altcha-widget
      ref={ref}
      challenge="/api/captcha"
      name="altcha"
      type="checkbox"
      language="en"
      suppressHydrationWarning
      style={{
        "--altcha-border-radius": "0",
        "--altcha-checkbox-border-radius": "0",
        "--altcha-input-border-radius": "0",
        "--altcha-border-color": "var(--rule)",
        "--altcha-color-base": "var(--bg)",
        "--altcha-color-base-content": "var(--ink)",
        "--altcha-color-primary": "var(--ink)",
        "--altcha-color-success": "var(--ok)",
        "--altcha-color-error": "var(--err)",
        "--altcha-shadow": "none",
        "--altcha-max-width": "100%",
        display: "block",
      }}
    />
  );
});

export default Captcha;
