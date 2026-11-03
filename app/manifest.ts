import type { MetadataRoute } from "next";

/** Lets SciCollab be added to a phone's home screen and opened like an app (also needed for push on iOS). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SciCollab",
    short_name: "SciCollab",
    description: "The network for scientists: groups, methods, data and feedback.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#f6f6f8",
    theme_color: "#16161a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
