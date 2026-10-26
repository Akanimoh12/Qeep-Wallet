"use client";

import { useEffect } from "react";

/** Registers the service worker so Qeep can be installed to the home screen. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
