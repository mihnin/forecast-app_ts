import os
from typing import Any, Dict, List, Optional
from pydantic_settings import BaseSettings
import json
from pathlib import Path

class Settings(BaseSettings):
    """
    Application settings
    """
    PROJECT_NAME: str = "Прогнозирование временных рядов"
    API_V1_STR: str = "/api/v1"
    
    # Режим отладки
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Настройки окружения
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Лимиты ресурсов
    MAX_WORKERS: int = int(os.getenv("MAX_WORKERS", "4"))
    MAX_MEMORY_GB: int = int(os.getenv("MAX_MEMORY_GB", "8"))
    
    # Настройки Redis
    REDIS_HOST: str = os.getenv("REDIS_HOST", "redis")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_URL: str = os.getenv("REDIS_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}")
    
    # Настройки путей для хранения данных
    DATA_DIR: str = "data"
    MODELS_DIR: str = "models"
    TEMP_DIR: str = "temp"
    
    # Настройки очистки временных файлов
    MAX_FILE_AGE_DAYS: int = 7  # Максимальный возраст файлов в днях
    
    # Настройки обработки данных
    DEFAULT_CHUNK_SIZE: int = 100000  # Размер чанка для чтения больших файлов
    MAX_UPLOAD_SIZE_MB: int = 200  # Максимальный размер загружаемого файла в МБ
    
    # Настройки прогнозирования
    DEFAULT_PREDICTION_LENGTH: int = 10  # Длина прогноза по умолчанию
    MAX_PREDICTION_LENGTH: int = 365  # Максимальная длина прогноза
    
    # Настройки обучения моделей
    DEFAULT_TRAINING_TIME_LIMIT: int = 60  # Лимит времени обучения в секундах
    MAX_TRAINING_TIME_LIMIT: int = 3600  # Максимальный лимит времени обучения в секундах
    
    # Доступные модели
    AVAILABLE_MODELS: List[str] = [
        "DeepAR",
        "Prophet",
        "Transformer",
        "NPTS",
        "ARIMA",
        "ETS",
        "AutoETS",
        "NBEATS",
        "FFT",
        "AutoARIMA",
        "SeasonalNaive",
        "Theta",
    ]
    
    # Категории моделей
    MODEL_CATEGORIES: Dict[str, List[str]] = {
        "deep_learning": ["DeepAR", "Transformer", "NBEATS"],
        "statistical": ["ARIMA", "ETS", "AutoETS", "AutoARIMA", "Theta"],
        "baseline": ["Prophet", "NPTS", "SeasonalNaive", "FFT"],
    }
    
    # Конфигурации моделей
    MODEL_CONFIGS: Dict[str, Dict[str, Any]] = {
        "DeepAR": {
            "context_length": 100,
            "epochs": 10,
            "learning_rate": 1e-3,
        },
        "Transformer": {
            "context_length": 100,
            "epochs": 10,
            "learning_rate": 1e-3,
        },
        # Другие модели могут иметь дополнительные параметры
    }
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Создаем объект настроек
settings = Settings()

# Создаем папки, если они не существуют
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.MODELS_DIR, exist_ok=True)
os.makedirs(settings.TEMP_DIR, exist_ok=True)