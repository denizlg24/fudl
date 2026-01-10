import { Queue, QueueEvents } from "bullmq";
import Redis from "ioredis";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const videoAnalysisQueue = new Queue("video-analysis", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

// Event listener for real-time job updates (uses Redis pub/sub, not polling)
export const videoAnalysisEvents = new QueueEvents("video-analysis", {
  connection: new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  }),
});
