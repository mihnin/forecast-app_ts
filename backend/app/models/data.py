from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class DatasetInfo(BaseModel):
    """Информация о датасете"""
    rows: int = Field(..., description="Количество строк")
    columns: int = Field(..., description="Количество столбцов")
    column_names: List[str] = Field(..., description="Имена столбцов")
    missing_values: Dict[str, int] = Field(..., description="Пропущенные значения по столбцам")


class DataResponse(BaseModel):
    """Ответ на загрузку данных"""
    success: bool = Field(..., description="Успешность загрузки")
    message: str = Field(..., description="Сообщение о результате")
    dataset_id: Optional[str] = Field(None, description="Идентификатор набора данных")
    info: Optional[DatasetInfo] = Field(None, description="Информация о датасете")


class ColumnSelection(BaseModel):
    """Выбор колонок для анализа"""
    date_column: str = Field(..., description="Колонка с датой")
    target_column: str = Field(..., description="Целевая колонка")
    id_column: Optional[str] = Field(None, description="Колонка с ID")
    static_features: List[str] = Field(default=[], description="Статические признаки")


class DataAnalysisRequest(BaseModel):
    """Запрос на анализ данных"""
    dataset_id: str = Field(..., description="Идентификатор набора данных")
    columns: ColumnSelection = Field(..., description="Выбранные колонки")
    analysis_type: str = Field(..., description="Тип анализа (distribution, timeseries, outliers, etc.)")
    params: Dict[str, Any] = Field(default={}, description="Дополнительные параметры анализа")


class DataAnalysisResponse(BaseModel):
    """Ответ на запрос анализа данных"""
    success: bool = Field(..., description="Успешность анализа")
    message: str = Field(..., description="Сообщение о результате")
    analysis_id: Optional[str] = Field(None, description="Идентификатор анализа")
    results: Optional[Dict[str, Any]] = Field(None, description="Результаты анализа")
    plots: Optional[Dict[str, Any]] = Field(None, description="Данные для построения графиков")