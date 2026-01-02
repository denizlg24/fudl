"""
BullMQ-compatible worker for processing video analysis jobs.
Uses Redis to poll for jobs from the 'video-analysis' queue.
"""
import json
import os
import time
import redis
from dotenv import load_dotenv
from typing import TypedDict

load_dotenv()

REDIS_URL = os.getenv('REDIS_URL')


class PlayerAnalysis(TypedDict):
    player_id: str
    position: tuple[float, float]
    route_type: str | None


class VideoAnalysisResult(TypedDict):
    routes_detected: list[str]
    players: list[PlayerAnalysis]
    analysis_complete: bool


class JobData(TypedDict):
    videoUrl: str


class BullMQJob(TypedDict):
    id: str
    data: JobData


def process_video(video_url: str) -> VideoAnalysisResult:
    """Process a video and return analysis results."""
    # Placeholder - replace with actual ML processing
    print(f"Processing video: {video_url}")
    time.sleep(2)  # Simulate processing
    return VideoAnalysisResult(
        routes_detected=[],
        players=[],
        analysis_complete=True,
    )


def run_worker() -> None:
    """Simple worker that polls Redis for BullMQ jobs."""
    print(f"Connecting to Redis at: {REDIS_URL}")
    
    try:
        r: redis.Redis[bytes] = redis.from_url(REDIS_URL)
        r.ping()  # Test connection
        print("[OK] Successfully connected to Redis")
    except Exception as e:
        print(f"[ERROR] Failed to connect to Redis: {e}")
        return
    
    print("mitt-worker started, waiting for jobs...")

    while True:
        try:
            # BullMQ stores jobs in bull:<queue>:wait list
            job_data = r.brpoplpush(
                "bull:video-analysis:wait",
                "bull:video-analysis:active",
                timeout=5
            )

            if job_data:
                try:
                    job: BullMQJob = json.loads(job_data)
                    video_url = job["data"]["videoUrl"]
                    result = process_video(video_url)

                    # Store result
                    job_id = job["id"]
                    r.hset(f"bull:video-analysis:{job_id}", "returnvalue", json.dumps(result))
                    print(f"Job {job_id} completed")
                except (json.JSONDecodeError, KeyError) as e:
                    print(f"Error processing job: {e}")
        except KeyboardInterrupt:
            print("\nWorker shutting down...")
            break
        except Exception as e:
            print(f"Worker error: {e}")


if __name__ == "__main__":
    run_worker()
