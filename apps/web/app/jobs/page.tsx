"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components/card";
import { Badge } from "@repo/ui/components/badge";
import { Progress } from "@repo/ui/components/progress";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import Link from "next/link";
import { useJobsStream, AuthorizationError, type JobStatus } from "../hooks/use-jobs-stream";

function useAnimatedValue(targetValue: number, duration: number = 300) {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startValueRef = useRef<number>(targetValue);

  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    startValueRef.current = displayValue;
    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      const eased = 1 - Math.pow(1 - progress, 3);
      const newValue =
        startValueRef.current + (targetValue - startValueRef.current) * eased;

      setDisplayValue(newValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration, displayValue]);

  return displayValue;
}

function AnimatedProgress({ value }: { value: number }) {
  const animatedValue = useAnimatedValue(value, 400);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>Progress</span>
        <span className="tabular-nums">{Math.round(animatedValue)}%</span>
      </div>
      <Progress value={animatedValue} />
    </div>
  );
}

function getStateBadgeVariant(
  state: JobStatus["state"]
): "default" | "secondary" | "destructive" | "outline" {
  switch (state) {
    case "completed":
      return "default";
    case "active":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString();
}

export default function JobsPage() {
  const { jobs, isConnected, submitJob, clearJobs } = useJobsStream();
  const [videoUrl, setVideoUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; isAuthError: boolean } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await submitJob(videoUrl);
      setVideoUrl("");
    } catch (err) {
      console.error("Failed to submit job:", err);
      if (err instanceof AuthorizationError) {
        setError({ message: err.message, isAuthError: true });
      } else {
        setError({ 
          message: err instanceof Error ? err.message : "Failed to submit job", 
          isAuthError: false 
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Job Queue Tester</h1>
        <p className="text-muted-foreground">
          Submit video analysis jobs and monitor their progress in real-time.
        </p>
      </div>

      {/* Connection Status */}
      <div className="mb-6 flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
        />
        <span className="text-sm text-muted-foreground">
          {isConnected ? "Ready" : "Connection issues"}
        </span>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>{error.isAuthError ? "Authentication Required" : "Error"}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error.message}</span>
            {error.isAuthError && (
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Login
                </Button>
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Submit Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Submit New Job</CardTitle>
          <CardDescription>
            Enter a video URL to queue for analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="videoUrl" className="sr-only">
                Video URL
              </Label>
              <Input
                id="videoUrl"
                type="url"
                placeholder="https://example.com/video.mp4"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <Button type="submit" disabled={isSubmitting || !videoUrl.trim()}>
              {isSubmitting ? "Submitting..." : "Submit Job"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Jobs List Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Jobs ({jobs.length})</h2>
        {jobs.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearJobs}>
            Clear All
          </Button>
        )}
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {jobs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No jobs yet. Submit a video URL above to get started.
            </CardContent>
          </Card>
        ) : (
          jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-mono">
                    Job #{job.id}
                  </CardTitle>
                  <Badge variant={getStateBadgeVariant(job.state)}>
                    {job.state}
                  </Badge>
                </div>
                <CardDescription className="truncate">
                  {job.data?.videoUrl || "Unknown URL"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {job.state === "active" && (
                  <AnimatedProgress value={job.progress} />
                )}

                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Queued at {formatTimestamp(job.timestamp)}</span>
                  {job.state === "completed" && job.result && (
                    <span className="text-green-600">Analysis complete</span>
                  )}
                  {job.state === "failed" && (
                    <span className="text-destructive">Processing failed</span>
                  )}
                </div>

                {job.state === "completed" && job.result && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View Result
                    </summary>
                    <pre className="mt-2 p-3 bg-muted rounded-md overflow-auto text-xs">
                      {JSON.stringify(job.result, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}
