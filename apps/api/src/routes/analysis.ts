import { Elysia, t } from "elysia";
import { videoAnalysisQueue } from "../queues/video-analysis";

const MITT_URL = process.env.MITT_URL || "http://localhost:8000";

export interface PredictResponse {
  prediction: string;
  confidence: number | null;
}

export interface JobStatusResponse {
  id: string;
  state: string;
  progress: number;
  result: unknown;
}

export const analysisRoutes = new Elysia({ prefix: "/analysis" })
  .post(
    "/quick",
    async ({ body }): Promise<PredictResponse> => {
      const res = await fetch(`${MITT_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json() as Promise<PredictResponse>;
    },
    {
      body: t.Object({
        coordinates: t.Optional(t.Array(t.Tuple([t.Number(), t.Number()]))),
        frameData: t.Optional(t.String()),
      }),
    }
  )
  .post(
    "/video",
    async ({ body }) => {
      const job = await videoAnalysisQueue.add("analyze", {
        videoUrl: body.videoUrl,
      });
      return { jobId: job.id, status: "queued" as const };
    },
    {
      body: t.Object({
        videoUrl: t.String(),
      }),
    }
  )
  .get("/job/:id", async ({ params }): Promise<JobStatusResponse | { error: string }> => {
    const job = await videoAnalysisQueue.getJob(params.id);
    if (!job) return { error: "Job not found" };
    const state = await job.getState();
    return {
      id: job.id ?? "",
      state,
      progress: job.progress as number,
      result: job.returnvalue,
    };
  });
