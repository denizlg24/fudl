import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { config } from "./config";
import { errorHandler } from "./middleware";
import { v1Routes } from "./routes";

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
