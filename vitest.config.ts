import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Temporary workaround: disable file parallelism globally to avoid
    // Miniflare dev-registry EPERM collisions on Windows when multiple
    // workers try to write concurrently. This slows tests down on all
    // platforms, so remove it once the upstream concurrency issue is fixed:
    // https://github.com/cloudflare/workers-sdk/issues/4716
    fileParallelism: false,
  },
});
