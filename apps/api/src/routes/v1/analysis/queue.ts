/**
 * Video Analysis Queue
 * BullMQ queue for processing video analysis jobs
 */

import { Queue, QueueEvents } from "bullmq";
import { redisConnection } from "../../../lib";

export const videoAnalysisQueue = new Queue("video-analysis", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

export const videoAnalysisEvents = new QueueEvents("video-analysis", {
  connection: redisConnection,
});
