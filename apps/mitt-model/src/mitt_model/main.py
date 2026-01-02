from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(
    title="mitt-model",
    description="AI model for flag football analytics",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    status: str


class PredictRequest(BaseModel):
    coordinates: list[tuple[float, float]] | None = None
    frame_data: bytes | None = None


class PredictResponse(BaseModel):
    prediction: str
    confidence: float | None = None


@app.get("/health")
async def health_check() -> HealthResponse:
    return HealthResponse(status="healthy")


@app.post("/predict")
async def predict(request: PredictRequest) -> PredictResponse:
    # Placeholder for quick inference
    return PredictResponse(prediction="placeholder", confidence=None)
