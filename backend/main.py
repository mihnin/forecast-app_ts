from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.core.config import settings
from app.core.queue import JobQueue
import logging

logger = logging.getLogger(__name__)

app = FastAPI(title="Time Series Forecast API")

# CORS middleware setup to allow React frontend to communicate with API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,  # Используем настройки из конфигурационного файла
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # Ограничиваем методы только необходимыми
    allow_headers=["Content-Type", "Authorization"],  # Ограничиваем заголовки только необходимыми
)

# Include API routes
app.include_router(api_router, prefix="/api")

# Initialize job queue
queue = JobQueue()

@app.on_event("startup")
async def startup_event():
    """
    Initialization tasks on application startup
    """
    # Создание необходимых директорий при старте
    import os
    os.makedirs("data", exist_ok=True)
    os.makedirs("models", exist_ok=True)
    os.makedirs("logs", exist_ok=True)

@app.on_event("shutdown")
async def shutdown_event():
    """
    Cleanup tasks on application shutdown
    """
    # Освобождение ресурсов при остановке
    try:
        queue.cleanup()
        logger.info("Ресурсы очереди освобождены")
    except Exception as e:
        logger.error(f"Ошибка при освобождении ресурсов: {str(e)}")