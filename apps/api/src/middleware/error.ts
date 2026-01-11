/**
 * Error handling middleware
 * Provides consistent error responses across the API
 */

import { Elysia } from "elysia";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const errorHandler = new Elysia({ name: "middleware/errorHandler" })
  .onError(({ code, error, set }) => {
    if (error instanceof ApiError) {
      set.status = error.statusCode;
      return {
        error: error.message,
        code: error.code,
      };
    }

    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: "Validation failed",
        details: error.message,
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: "Not found",
      };
    }

    console.error("Unhandled error:", error);
    set.status = 500;
    return {
      error: "Internal server error",
    };
  });
