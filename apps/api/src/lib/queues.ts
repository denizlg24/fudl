/**
 * Video Processing Queue
 * BullMQ queue for post-upload video processing (thumbnail, metadata, etc.)
 */

import { Queue, QueueEvents } from "bullmq";
import { redisConnection } from "./redis";

export const videoProcessingQueue = new Queue("video-processing", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const videoProcessingEvents = new QueueEvents("video-processing", {
  connection: redisConnection,
});
