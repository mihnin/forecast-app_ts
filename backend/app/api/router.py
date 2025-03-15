from fastapi import APIRouter
from app.api.endpoints import data, training, prediction, analysis, preprocessing, queue

api_router = APIRouter()

# Data management routes
api_router.include_router(
    data.router,
    prefix="/data",
    tags=["data"]
)

# Model training routes
api_router.include_router(
    training.router,
    prefix="/training",
    tags=["training"]
)

# Prediction routes
api_router.include_router(
    prediction.router,
    prefix="/prediction",
    tags=["prediction"]
)

# Analysis routes
api_router.include_router(
    analysis.router,
    prefix="/analysis",
    tags=["analysis"]
)

# Preprocessing routes
api_router.include_router(
    preprocessing.router,
    prefix="/preprocessing",
    tags=["preprocessing"]
)

# Queue management routes
api_router.include_router(
    queue.router,
    prefix="/queue",
    tags=["queue"]
)