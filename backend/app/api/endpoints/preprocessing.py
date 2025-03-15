"""
Endpoints for time series preprocessing operations
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any, Optional
import pandas as pd
from app.services.data.data_service import DataService
from app.utils.time_series_utils import TimeSeriesPreprocessor
from app.core.database import get_db
from app.core.cache import cache
from sqlalchemy.orm import Session
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/gaps/{dataset_id}")
async def detect_gaps(
    dataset_id: str,
    date_column: str = Query(..., description="Имя столбца с датами"),
    value_column: str = Query(..., description="Имя столбца со значениями"),
    freq: Optional[str] = Query(None, description="Ожидаемая частота данных (D, H, M и т.д.)"),
    db: Session = Depends(get_db)
):
    """
    Detect gaps in time series data
    """
    try:
        # Проверяем кеш
        cache_params = {
            "dataset_id": dataset_id,
            "date_column": date_column,
            "value_column": value_column,
            "freq": freq
        }
        
        cached_result = cache.get("gaps", cache_params)
        if cached_result:
            return cached_result
        
        # Получаем данные
        data_service = DataService(db)
        dataset = data_service.get_dataset(dataset_id)
        
        if not dataset:
            raise HTTPException(status_code=404, detail=f"Датасет с ID {dataset_id} не найден")
        
        df = pd.read_csv(dataset.file_path)
        
        # Проверяем колонки
        if date_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Колонка {date_column} не найдена")
        if value_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Колонка {value_column} не найдена")
        
        # Анализируем пропуски
        preprocessor = TimeSeriesPreprocessor(df, date_column, value_column)
        result = preprocessor.detect_gaps(freq)
        
        # Кешируем результат
        cache.set("gaps", cache_params, result)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при поиске пропусков: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при поиске пропусков: {str(e)}")

@router.post("/fill-missing/{dataset_id}")
async def fill_missing_values(
    dataset_id: str,
    date_column: str = Query(..., description="Имя столбца с датами"),
    value_column: str = Query(..., description="Имя столбца со значениями"),
    method: str = Query("linear", description="Метод заполнения (linear, ffill, bfill, cubic, mean)"),
    db: Session = Depends(get_db)
):
    """
    Fill missing values in time series
    """
    try:
        # Получаем данные
        data_service = DataService(db)
        dataset = data_service.get_dataset(dataset_id)
        
        if not dataset:
            raise HTTPException(status_code=404, detail=f"Датасет с ID {dataset_id} не найден")
        
        df = pd.read_csv(dataset.file_path)
        
        # Проверяем колонки
        if date_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Колонка {date_column} не найдена")
        if value_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Колонка {value_column} не найдена")
        
        # Заполняем пропуски
        preprocessor = TimeSeriesPreprocessor(df, date_column, value_column)
        filled_df, stats = preprocessor.fill_missing_values(method)
        
        # Сохраняем обработанный датасет
        new_file_path = dataset.file_path.replace('.csv', f'_filled_{method}.csv')
        filled_df.to_csv(new_file_path, index=False)
        
        # Создаем новую запись в базе данных
        new_dataset = data_service.create_dataset(
            new_file_path,
            f"{dataset.filename}_filled_{method}",
            filled_df
        )
        
        return {
            "success": True,
            "dataset_id": new_dataset.id,
            "stats": stats
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при заполнении пропусков: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при заполнении пропусков: {str(e)}")

@router.get("/outliers/{dataset_id}")
async def detect_outliers(
    dataset_id: str,
    date_column: str = Query(..., description="Имя столбца с датами"),
    value_column: str = Query(..., description="Имя столбца со значениями"),
    threshold: float = Query(3.0, description="Порог для определения выбросов (Z-score)"),
    db: Session = Depends(get_db)
):
    """
    Detect outliers in time series data
    """
    try:
        # Проверяем кеш
        cache_params = {
            "dataset_id": dataset_id,
            "date_column": date_column,
            "value_column": value_column,
            "threshold": threshold
        }
        
        cached_result = cache.get("outliers", cache_params)
        if cached_result:
            return cached_result
        
        # Получаем данные
        data_service = DataService(db)
        dataset = data_service.get_dataset(dataset_id)
        
        if not dataset:
            raise HTTPException(status_code=404, detail=f"Датасет с ID {dataset_id} не найден")
        
        df = pd.read_csv(dataset.file_path)
        
        # Проверяем колонки
        if date_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Колонка {date_column} не найдена")
        if value_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Колонка {value_column} не найдена")
        
        # Ищем выбросы
        preprocessor = TimeSeriesPreprocessor(df, date_column, value_column)
        result = preprocessor.detect_outliers(threshold)
        
        # Кешируем результат
        cache.set("outliers", cache_params, result)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при поиске выбросов: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при поиске выбросов: {str(e)}")