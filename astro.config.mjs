import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://example.com",
  vite: {
    server: {
      proxy: {
        "/__studio": {
          target: "http://127.0.0.1:4323",
          changeOrigin: true,
          rewrite: (pathname) => pathname.replace(/^\/__studio/, "")
        }
      }
    }
  }
});
