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
    allow_origins=["*"],  # В продакшене заменить на конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Подключаем маршруты API
app.include_router(api_router, prefix=settings.API_V1_STR)

# Инициализация очереди задач
queue = JobQueue()

@app.on_event("startup")
async def startup_event():
    logger.info("Starting up application...")
    await queue.initialize()

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down application...")
    await queue.cleanup()

# Добавляем глобальный обработчик OPTIONS запросов
@app.options("/{path:path}")
async def options_handler(path: str):
    return {}