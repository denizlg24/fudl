"""
BullMQ-compatible worker for processing video analysis jobs.
Uses the official bullmq Python package for proper protocol compatibility.
"""
import asyncio
import os
import time
from dotenv import load_dotenv
from typing import TypedDict
from bullmq import Worker

load_dotenv()

REDIS_HOST = os.getenv('REDIS_HOST')
REDIS_PORT = int(os.getenv('REDIS_PORT'))


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


def process_video(video_url: str) -> VideoAnalysisResult:
    """Process a video and return analysis results."""
    print(f"[INFO] Processing video: {video_url}")
    time.sleep(2)  # Simulate processing
    return VideoAnalysisResult(
        routes_detected=[],
        players=[],
        analysis_complete=True,
    )


async def process_job(job, token):
    """Process a single job from the queue."""
    print(f"[DEBUG] Received job {job.id}")
    print(f"[DEBUG] Job name: {job.name}")
    print(f"[DEBUG] Job data: {job.data}")

    video_url = job.data.get('videoUrl')
    if not video_url:
        raise ValueError(f"No videoUrl in job data: {job.data}")

    # Update progress
    for i in range(1,100,5):
        await job.updateProgress(i)
        time.sleep(0.5)
    # Process the video
    result = process_video(video_url)
    # Update progress to complete
    await job.updateProgress(100)

    print(f"[OK] Job {job.id} completed successfully")
    print(f"[DEBUG] Returning result: {result}")
    return result


async def run_worker() -> None:
    """Run the BullMQ worker."""
    print(f"[INFO] Connecting to Redis at {REDIS_HOST}:{REDIS_PORT}")

    worker = Worker(
        "video-analysis",
        process_job,
        {
            "connection": {
                "host": REDIS_HOST,
                "port": REDIS_PORT,
            }
        }
    )

    print("[OK] mitt-worker started, waiting for jobs...")

    while True:
        await asyncio.sleep(1)


def main():
    """Entry point."""
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
