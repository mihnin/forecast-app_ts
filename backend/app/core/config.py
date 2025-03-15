import os
from typing import Dict, Any, List, Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    Application settings
    """
    # API settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Time Series Forecast API"
    
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = ENVIRONMENT == "development"
    
    # CORS - более безопасная конфигурация
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000"
    ]
    
    # Redis
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "1"))
    REDIS_URL: str = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
    
    # Worker settings
    MAX_WORKERS: int = int(os.getenv("MAX_WORKERS", 2))
    
    # Model settings
    MODEL_DIR: str = "models/TimeSeriesModel"
    MODEL_INFO_FILE: str = "model_info.json"
    
    # Default parameters
    DEFAULT_CHUNK_SIZE: int = 100000
    DEFAULT_PREDICTION_LENGTH: int = 10
    DEFAULT_TIME_LIMIT: int = 60
    DEFAULT_FREQ: str = "auto"
    DEFAULT_FILL_METHOD: str = "None"
    DEFAULT_METRIC: str = "MASE"
    DEFAULT_PRESET: str = "medium_quality"
    
    # Metrics and models (migrated from config/config.yaml)
    METRICS_DICT: Dict[str, str] = {
        "SQL (Scaled quantile loss)": "SQL",
        "WQL (Weighted quantile loss)": "WQL",
        "MAE (Mean absolute error)": "MAE",
        "MAPE (Mean absolute percentage error)": "MAPE",
        "MASE (Mean absolute scaled error)": "MASE",
        "MSE (Mean squared error)": "MSE",
        "RMSE (Root mean squared error)": "RMSE",
        "RMSLE (Root mean squared logarithmic error)": "RMSLE",
        "RMSSE (Root mean squared scaled error)": "RMSSE",
        "SMAPE (Symmetric mean absolute percentage error)": "SMAPE",
        "WAPE (Weighted absolute percentage error)": "WAPE"
    }
    
    AG_MODELS: Dict[str, str] = {
        "NaiveModel": "Базовая модель: прогноз = последнее наблюдение",
        "SeasonalNaiveModel": "Прогноз = последнее значение той же фазы сезона",
        "AverageModel": "Прогноз = среднее/квантиль",
        "SeasonalAverageModel": "Прогноз = среднее по тем же фазам сезона",
        "ZeroModel": "Прогноз = 0",
        "ETSModel": "Экспоненциальное сглаживание (ETS)",
        "AutoARIMAModel": "Автоматическая ARIMA",
        "AutoETSModel": "Автоматическая ETS",
        "AutoCESModel": "Комплексное экспоненциальное сглаживание (AIC)",
        "ThetaModel": "Theta",
        "ADIDAModel": "Intermittent demand (ADIDA)",
        "CrostonModel": "Intermittent demand (Croston)",
        "IMAPAModel": "Intermittent demand (IMAPA)",
        "NPTSModel": "Non-Parametric Time Series",
        "DeepARModel": "RNN (DeepAR)",
        "DLinearModel": "DLinear (убирает тренд)",
        "PatchTSTModel": "PatchTST (Transformer)",
        "SimpleFeedForwardModel": "Простая полносвязная сеть",
        "TemporalFusionTransformerModel": "LSTM + Transformer (TFT)",
        "TiDEModel": "Time series dense encoder",
        "WaveNetModel": "WaveNet (CNN)",
        "DirectTabularModel": "AutoGluon-Tabular (Direct)",
        "RecursiveTabularModel": "AutoGluon-Tabular (Recursive)",
        "ChronosModel": "Chronos pretrained"
    }

    class Config:
        case_sensitive = True


settings = Settings()