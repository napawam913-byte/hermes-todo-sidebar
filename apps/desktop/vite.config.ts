import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/dist-electron/**"],
    globals: true,
    environment: "node"
  }
});
