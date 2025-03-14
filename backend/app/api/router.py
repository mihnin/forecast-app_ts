from fastapi import APIRouter
from app.api.endpoints import data, training, prediction, queue

# Create the API router
api_router = APIRouter()

# Include routes from endpoint modules
api_router.include_router(data.router, prefix="/data", tags=["data"])
api_router.include_router(training.router, prefix="/training", tags=["training"])
api_router.include_router(prediction.router, prefix="/prediction", tags=["prediction"])
api_router.include_router(queue.router, prefix="/queue", tags=["queue"])