import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Installable app ("Add to Home Screen"). The service worker caches the app's
    // own files only: API calls always go to the network, so no vault data is
    // stored on the device.
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "favicon-32.png", "apple-touch-icon.png", "brand/*.svg"],
      manifest: {
        name: "2keevo",
        short_name: "2keevo",
        description: "Passwords, logins and secrets for you and your team.",
        id: "/",
        start_url: "/notes",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#f7f6f3",
        theme_color: "#5b4fc4",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        // App pages open from the cache; the API and docs are never answered by it.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/doc/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 11600,
  },
});
