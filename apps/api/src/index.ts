import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { config } from "./config";
import { errorHandler } from "./middleware";
import { v1Routes } from "./routes";

// Enable BigInt JSON serialization (Prisma returns BigInt for large integer columns)
// biome-ignore lint/suspicious/noGlobalAssign: Required for JSON.stringify compatibility
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

const app = new Elysia()
  .use(errorHandler)
  .use(
    cors({
      origin: config.cors.origins,
      credentials: config.cors.credentials,
    }),
  )

  .get("/", () => ({
    name: "FUDL API",
    version: "1.0.0",
    docs: "/v1/health",
  }))

  .use(v1Routes)

  .listen(config.port);

console.log(
  `API running at http://localhost:${app.server?.port} [${config.env}]`,
);

export type App = typeof app;
