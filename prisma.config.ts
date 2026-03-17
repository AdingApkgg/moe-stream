import path from "node:path";
import { defineConfig } from "prisma/config";

try {
  const { config } = require("dotenv");
  const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
  config({ path: path.join(__dirname, envFile) });
} catch {
  // dotenv not available (e.g. standalone Docker image) — env vars injected by compose
}

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
