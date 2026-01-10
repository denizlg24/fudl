import { Elysia, t } from "elysia";
import { videoAnalysisQueue, videoAnalysisEvents } from "../queues/video-analysis";
import type { JobStatus, CreateJobResponse, VideoAnalysisResult } from "@repo/types";

export const analysisRoutes = new Elysia({ prefix: "/analysis" })
  .post(
    "/video",
    async ({ body }): Promise<CreateJobResponse> => {
      const job = await videoAnalysisQueue.add("analyze", {
        videoUrl: body.videoUrl,
      });
      return { jobId: job.id!, status: "queued" };
    },
    {
      body: t.Object({
        videoUrl: t.String(),
      }),
    }
  )
  .get(
    "/job/:id",
    async ({ params }): Promise<JobStatus | { error: string }> => {
      try {
        const job = await videoAnalysisQueue.getJob(params.id);
        if (!job) return { error: "Job not found" };
        const state = await job.getState();

        return {
          id: job.id ?? "",
          name: job.name,
          state: state as JobStatus["state"],
          progress: job.progress as number,
          data: job.data,
          timestamp: job.timestamp,
          result: job.returnvalue ?? null,
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }
  )
  .get("/job/:id/stream", ({ params }) => {
    const jobId = params.id;
    const encoder = new TextEncoder();
    let isClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const sendJobState = async () => {
          if (isClosed) return;
          try {
            const job = await videoAnalysisQueue.getJob(jobId);
            if (!job) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ error: "Job not found" })}\n\n`)
              );
              cleanup();
              return;
            }

            const state = await job.getState();
            const data: JobStatus = {
              id: job.id ?? "",
              name: job.name,
              state: state as JobStatus["state"],
              progress: job.progress as number,
              data: job.data,
              timestamp: job.timestamp,
              result: job.returnvalue as VideoAnalysisResult | null,
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

            // Close stream if job is done
            if (state === "completed" || state === "failed") {
              cleanup();
            }
          } catch {
            // Ignore errors on closed stream
          }
        };

        const cleanup = () => {
          if (isClosed) return;
          isClosed = true;
          videoAnalysisEvents.off("active", onActive);
          videoAnalysisEvents.off("progress", onProgress);
          videoAnalysisEvents.off("completed", onCompleted);
          videoAnalysisEvents.off("failed", onFailed);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        };

        // Event handlers - only react to events for this specific job
        const onActive = async ({ jobId: eventJobId }: { jobId: string }) => {
          if (eventJobId === jobId) await sendJobState();
        };

        const onProgress = async ({ jobId: eventJobId }: { jobId: string }) => {
          if (eventJobId === jobId) await sendJobState();
        };

        // Use returnvalue from event directly to avoid race condition
        const onCompleted = async ({
          jobId: eventJobId,
          returnvalue,
        }: {
          jobId: string;
          returnvalue: string;
        }) => {
          if (eventJobId !== jobId || isClosed) return;
          try {
            const job = await videoAnalysisQueue.getJob(jobId);
            if (!job) return;

            // Parse the returnvalue from the event (it's a JSON string)
            const result = returnvalue ? JSON.parse(returnvalue) : null;

            const data: JobStatus = {
              id: job.id ?? "",
              name: job.name,
              state: "completed",
              progress: 100,
              data: job.data,
              timestamp: job.timestamp,
              result: result as VideoAnalysisResult | null,
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            cleanup();
          } catch {
            // Ignore errors
          }
        };

        const onFailed = async ({ jobId: eventJobId }: { jobId: string }) => {
          if (eventJobId === jobId) await sendJobState();
        };

        // Subscribe to BullMQ events
        videoAnalysisEvents.on("active", onActive);
        videoAnalysisEvents.on("progress", onProgress);
        videoAnalysisEvents.on("completed", onCompleted);
        videoAnalysisEvents.on("failed", onFailed);

        // Send initial state
        await sendJobState();
      },
      cancel() {
        isClosed = true;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });
