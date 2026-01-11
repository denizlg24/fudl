/**
 * API-specific type definitions
 * Re-exports shared types and defines API-only types
 */

// Re-export shared types
export type {
  JobStatus,
  CreateJobResponse,
  VideoAnalysisResult,
} from "@repo/types";

// API-specific types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface HealthCheck {
  status: "healthy" | "unhealthy";
  timestamp: string;
  checks?: Record<string, "healthy" | "unhealthy" | "degraded">;
}
