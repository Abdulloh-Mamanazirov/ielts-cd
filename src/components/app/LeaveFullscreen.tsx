"use client";

import { useEffect } from "react";

import { exitFullscreen } from "./MockProgress";

/** Leaves full screen when it mounts — the mock is over, the browser can come back. */
export function LeaveFullscreen() {
  useEffect(() => {
    exitFullscreen();
  }, []);
  return null;
}
