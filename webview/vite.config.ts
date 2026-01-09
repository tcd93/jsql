/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import checker from "vite-plugin-checker";
import tsconfigPaths from "vite-tsconfig-paths";

export default {
  plugins: [
    react(),
    tsconfigPaths(),
    !process.env.VITEST
      ? checker({
          typescript: true,
          eslint: {
            lintCommand: 'eslint "src/**/*.{ts,tsx}"',
            // flat config required for eslint v9
            useFlatConfig: true,
          },
        })
      : undefined,
  ],
  // Add dev server configuration
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../out/webview",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "./src/main.tsx",
      },
      output: {
        entryFileNames: "jsql-editor.js",
        chunkFileNames: "chunk-[name].js",
        assetFileNames: "jsql-editor.css",
        sourcemapExcludeSources: false,
        format: "es",
      },
    },
    minify: false,
  },
  define: {
    global: "globalThis",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
};
