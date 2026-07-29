import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Tunnels used to show the dev server to someone else.
   *
   * Next blocks cross-origin requests to dev-only assets by default, so through
   * a tunnel the client bundle never loads: the page renders from the server,
   * React never hydrates, and every button silently does nothing. Development
   * only — `next start` ignores this.
   */
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.trycloudflare.com",
    "*.loca.lt",
  ],

  images: {
    remotePatterns: [
      // YouTube poster frames for video testimonials. Instagram is not listed
      // because it blocks hotlinking — reels use an uploaded thumbnail instead.
      { protocol: "https", hostname: "img.youtube.com", pathname: "/vi/**" },
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
    ],
  },
};

export default nextConfig;
