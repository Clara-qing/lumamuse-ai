import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
      "name": "lumamuse-light-makeup-coach",
    "compatibilityDate": "2026-10-06",
    "observability": {
      "enabled": true
    },
    "assets": {
      "notFoundHandling": "single-page-application"
    }
  }
});
