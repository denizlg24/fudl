"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { JobStatus, CreateJobResponse } from "@repo/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

async function fetchJobStatus(jobId: string): Promise<JobStatus | null> {
  try {
    const response = await fetch(`${API_URL}/analysis/job/${jobId}`);
    const data = await response.json();
    if ("error" in data) return null;
    return data as JobStatus;
  } catch {
    return null;
  }
}

export function useJobsStream() {
  const [jobs, setJobs] = useState<Map<string, JobStatus>>(new Map());
  const activeJobsRef = useRef<Set<string>>(new Set());
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const pollJobs = useCallback(async () => {
    const activeJobs = Array.from(activeJobsRef.current);
    if (activeJobs.length === 0) return;

    const updates = await Promise.all(
      activeJobs.map(async (jobTimestamp) => {
        const job = jobs.get(jobTimestamp);
        if (!job) return {jobId:jobTimestamp};
        const status = await fetchJobStatus(job.id);
        return { jobId: job.id, status,timestamp:jobTimestamp };
      })
    );

    setJobs((prev) => {
      const next = new Map(prev);
      for (const { status,timestamp } of updates) {
        if (status) {
          next.set(timestamp, status);
          if (status.state === "completed" || status.state === "failed") {
            activeJobsRef.current.delete(timestamp);
          }
        }
      }
      return next;
    });
  }, [jobs]);

  useEffect(() => {
    pollingRef.current = setInterval(pollJobs, 500);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [pollJobs]);

  const submitJob = useCallback(async (videoUrl: string) => {
    const timestamp = Date.now();

    const placeholderJob: JobStatus = {
      id: timestamp.toString(),
      name: "analyze",
      state: "waiting",
      progress: 0,
      data: { videoUrl },
      timestamp: timestamp,
      result: null,
    };

    setJobs((prev) => {
      const next = new Map(prev);
      next.set(timestamp.toString(), placeholderJob);
      return next;
    });

    const response = await fetch(`${API_URL}/analysis/video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl }),
    });

    const result = (await response.json()) as CreateJobResponse;
    setJobs((prev) => {
      const next = new Map(prev);
      const previous = prev.get(timestamp.toString());
      if(!previous){
        return prev;
      }
      next.set(timestamp.toString(), {...previous,id:result.jobId});
      return next;
    });
    activeJobsRef.current.add(timestamp.toString());

    return result;
  }, []);

  const clearJobs = useCallback(() => {
    activeJobsRef.current.clear();
    setJobs(new Map());
  }, []);

  const jobsList = Array.from(jobs.values()).sort(
    (a, b) => b.timestamp - a.timestamp
  );

  const isConnected = true;

  return { jobs: jobsList, isConnected, submitJob, clearJobs };
}

export type { JobStatus };
