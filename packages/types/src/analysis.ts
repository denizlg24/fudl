/** Job states in BullMQ */
export type JobState =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed";

/** Player analysis data from the ML model */
export interface PlayerAnalysis {
  player_id: string;
  position: [number, number];
  route_type: string | null;
}

/** Result returned by the video analysis worker */
export interface VideoAnalysisResult {
  routes_detected: string[];
  players: PlayerAnalysis[];
  analysis_complete: boolean;
}

/** Data submitted with a video analysis job (legacy — used by the analysis demo route) */
export interface VideoJobData {
  videoUrl: string;
}

/** Data submitted with a video processing job (post-upload pipeline) */
export interface VideoProcessJobData {
  videoId: string;
  organizationId: string;
  s3Key: string;
  s3Bucket: string;
  s3Region: string;
}

/** Result returned by the video processing worker */
export interface VideoProcessResult {
  thumbnailKey: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  codec: string | null;
  durationSecs: number | null;
}

/** Full job status returned by the API */
export interface JobStatus {
  id: string;
  name: string;
  state: JobState;
  progress: number;
  data: VideoJobData;
  timestamp: number;
  result: VideoAnalysisResult | null;
}

/** Response when creating a new job */
export interface CreateJobResponse {
  jobId: string;
  status: "queued";
}

/** Error response from the API */
export interface ApiError {
  error: string;
}
