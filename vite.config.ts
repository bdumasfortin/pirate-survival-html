import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  server: {
    port: 5173,
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
  },
});
