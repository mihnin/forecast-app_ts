from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.core.config import settings
from app.core.queue import JobQueue
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],  # Разрешаем все методы
    allow_headers=["*"],  # Разрешаем все заголовки
    expose_headers=["*"],  # Разрешаем все заголовки в ответах
    max_age=3600,  # Кэширование префлайт запросов на 1 час
)

# Подключаем маршруты API
app.include_router(api_router, prefix=settings.API_V1_STR)

# Инициализация очереди задач
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
    try:
        queue.cleanup()
        logger.info("Queue resources released")
    except Exception as e:
        logger.error(f"Error releasing queue resources: {str(e)}")

# Добавляем обработчик OPTIONS запросов для поддержки CORS
@app.options("/{full_path:path}")
async def options_handler():
    return {"message": "OK"}