"use client";

import { useEffect, useRef } from "react";

/**
 * Hidden field that carries the native device's push token into the sign-out
 * server action, so it can drop exactly this device's token on logout. Empty on
 * web (no persisted token) → sign-out behaves unchanged.
 */
export function DeviceTokenField() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const t = window.localStorage.getItem("dp_push_token");
      if (t && ref.current) ref.current.value = t;
    } catch {
      // localStorage unavailable — leave empty.
    }
  }, []);
  return <input ref={ref} type="hidden" name="deviceToken" defaultValue="" />;
}
