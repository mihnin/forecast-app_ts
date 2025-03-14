from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class PredictionParams(BaseModel):
    """Параметры прогнозирования"""
    model_id: str = Field(..., description="Идентификатор модели")
    dataset_id: str = Field(..., description="Идентификатор набора данных")
    prediction_length: Optional[int] = Field(None, description="Горизонт прогноза (если отличается от указанного при обучении)")


class PredictionRequest(BaseModel):
    """Запрос на прогнозирование"""
    user_id: str = Field(..., description="Идентификатор пользователя")
    params: PredictionParams = Field(..., description="Параметры прогнозирования")


class PredictionResponse(BaseModel):
    """Ответ на запрос прогнозирования"""
    task_id: str = Field(..., description="Идентификатор задачи")
    position: int = Field(..., description="Позиция в очереди")
    estimated_time: Optional[int] = Field(None, description="Оценка времени выполнения (сек)")


class PredictionResult(BaseModel):
    """Результаты прогнозирования"""
    prediction_id: str = Field(..., description="Идентификатор прогноза")
    predictions: Dict[str, Any] = Field(..., description="Предсказанные значения")
    plots: Optional[Dict[str, Any]] = Field(None, description="Данные для построения графиков")