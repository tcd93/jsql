import { resolve } from "path";
import checker from "vite-plugin-checker";
import tsconfigPaths from "vite-tsconfig-paths";

export default {
  plugins: [
    checker({
      typescript: true,
      eslint: {
        lintCommand: 'eslint "src/**/*.{ts,tsx}"',
        // flat config required for eslint v9
        // https://github.com/fi3ework/vite-plugin-checker/issues/418
        useFlatConfig: true,
      },
    }),
    tsconfigPaths(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/extension.ts"),
      formats: ["cjs"],
      fileName: () => "extension.js",
    },
    outDir: "out",
    rollupOptions: {
      external: [
        "vscode",
        "path",
        "fs",
        "os",
        "util",
        "events",
        "stream",
        "buffer",
        "url",
        "child_process",
        "assert",
        "crypto",
        "tls",
        "net",
        "dns",
        "constants",
        "timers",
        "dgram",
        "node:events",
        "node:stream",
        "node:url",
        "node:os",
        "pg",
        "pg-query-stream",
        "mock-aws-s3",
        "aws-sdk",
        "nock",
      ],
      output: {
        globals: {
          vscode: "vscode",
        },
      },
    },
    minify: false,
  },
};
