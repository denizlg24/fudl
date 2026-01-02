import { Elysia } from "elysia";

export const healthRoutes = new Elysia({ prefix: "/health" })
  .get("/", () => ({ status: "healthy" }))
  .get("/mitt", async () => {
    try {
      const res = await fetch("http://localhost:8000/health");
      return { mitt: res.ok ? "healthy" : "unhealthy" };
    } catch {
      return { mitt: "unreachable" };
    }
  });
