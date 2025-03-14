from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class TrainingParams(BaseModel):
    """Параметры обучения модели"""
    dataset_id: str = Field(..., description="Идентификатор набора данных")
    columns: Dict[str, str] = Field(..., description="Соответствие колонок")
    static_features: List[str] = Field(default=[], description="Статические признаки")
    fill_method: str = Field(default="None", description="Метод заполнения пропусков")
    group_cols: List[str] = Field(default=[], description="Колонки для группировки при заполнении")
    use_holidays: bool = Field(default=False, description="Использовать признак праздников")
    freq: str = Field(default="auto", description="Частота временного ряда")
    metric: str = Field(default="MASE", description="Метрика для оценки")
    models: List[str] = Field(default=["* (все)"], description="Список моделей")
    presets: str = Field(default="medium_quality", description="Preset для AutoGluon")
    prediction_length: int = Field(default=10, description="Горизонт прогноза")
    time_limit: int = Field(default=60, description="Ограничение времени обучения (сек)")
    mean_only: bool = Field(default=False, description="Прогнозировать только среднее")


class TrainingRequest(BaseModel):
    """Запрос на обучение модели"""
    user_id: str = Field(..., description="Идентификатор пользователя")
    params: TrainingParams = Field(..., description="Параметры обучения")


class TrainingResponse(BaseModel):
    """Ответ на запрос обучения модели"""
    task_id: str = Field(..., description="Идентификатор задачи")
    position: int = Field(..., description="Позиция в очереди")
    estimated_time: Optional[int] = Field(None, description="Оценка времени выполнения (сек)")


class TrainingResult(BaseModel):
    """Результаты обучения модели"""
    model_id: str = Field(..., description="Идентификатор модели")
    best_model: str = Field(..., description="Лучшая модель")
    best_score: float = Field(..., description="Лучшая оценка")
    leaderboard: List[Dict[str, Any]] = Field(..., description="Таблица результатов")
    fit_summary: Dict[str, Any] = Field(..., description="Сводка по обучению")
    weighted_ensemble_info: Optional[Dict[str, Any]] = Field(None, description="Информация о взвешенном ансамбле")