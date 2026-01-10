import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { healthRoutes } from "./routes/health";
import { analysisRoutes } from "./routes/analysis";

const app = new Elysia()
  .use(cors())
  .use(healthRoutes)
  .use(analysisRoutes)
  .listen(3002);

console.log(`API running at http://localhost:${app.server?.port}`);

export type App = typeof app;
