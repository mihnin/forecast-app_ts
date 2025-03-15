"""
Endpoints for time series analysis with caching
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any, Optional
import pandas as pd
from app.services.data.data_service import DataService
from app.services.analysis.time_series_analysis import TimeSeriesAnalyzer
from app.core.database import get_db
from app.core.cache import cache
from sqlalchemy.orm import Session
import logging
from statsmodels.tsa.seasonal import seasonal_decompose

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/stats/{dataset_id}")
async def get_time_series_statistics(
    dataset_id: str,
    date_column: str = Query(..., description="Имя столбца с датами"),
    value_column: str = Query(..., description="Имя столбца со значениями"),
    force_refresh: bool = Query(False, description="Принудительное обновление кеша"),
    db: Session = Depends(get_db)
):
    """
    Get statistical analysis of time series data
    """
    try:
        # Параметры для кеша
        cache_params = {
            "dataset_id": dataset_id,
            "date_column": date_column,
            "value_column": value_column
        }
        
        # Проверяем кеш, если не требуется принудительное обновление
        if not force_refresh:
            cached_result = cache.get("stats", cache_params)
            if cached_result:
                logger.info(f"Retrieved cached stats for dataset {dataset_id}")
                return cached_result
        
        # Получаем информацию о датасете
        data_service = DataService(db)
        dataset = data_service.get_dataset(dataset_id)
        
        if not dataset:
            raise HTTPException(status_code=404, detail=f"Датасет с ID {dataset_id} не найден")
        
        # Загружаем данные
        df = pd.read_csv(dataset.file_path)
        
        # Проверяем наличие указанных колонок
        if date_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Колонка {date_column} не найдена в датасете")
        if value_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Колонка {value_column} не найдена в датасете")
        
        # Создаем анализатор и получаем результаты
        analyzer = TimeSeriesAnalyzer(df, date_column, value_column)
        analysis_results = analyzer.get_full_analysis()
        
        # Кешируем результаты
        cache.set("stats", cache_params, analysis_results)
        
        return analysis_results
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при анализе временного ряда: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при анализе временного ряда: {str(e)}")

@router.get("/anomalies/{dataset_id}")
async def get_anomalies(
    dataset_id: str,
    date_column: str = Query(..., description="Имя столбца с датами"),
    value_column: str = Query(..., description="Имя столбца со значениями"),
    threshold: float = Query(3.0, description="Порог Z-score для определения аномалий"),
    force_refresh: bool = Query(False, description="Принудительное обновление кеша"),
    db: Session = Depends(get_db)
):
    """
    Detect anomalies in time series data
    """
    try:
        # Параметры для кеша
        cache_params = {
            "dataset_id": dataset_id,
            "date_column": date_column,
            "value_column": value_column,
            "threshold": threshold
        }
        
        # Проверяем кеш
        if not force_refresh:
            cached_result = cache.get("anomalies", cache_params)
            if cached_result:
                logger.info(f"Retrieved cached anomalies for dataset {dataset_id}")
                return cached_result
        
        # Получаем информацию о датасете
        data_service = DataService(db)
        dataset = data_service.get_dataset(dataset_id)
        
        if not dataset:
            raise HTTPException(status_code=404, detail=f"Датасет с ID {dataset_id} не найден")
        
        # Загружаем данные
        df = pd.read_csv(dataset.file_path)
        
        # Проверяем наличие указанных колонок
        if date_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Колонка {date_column} не найдена в датасете")
        if value_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Колонка {value_column} не найдена в датасете")
        
        # Создаем анализатор и получаем аномалии
        analyzer = TimeSeriesAnalyzer(df, date_column, value_column)
        anomalies = analyzer.detect_anomalies(threshold)
        
        result = {
            "anomalies": anomalies,
            "total_count": len(anomalies),
            "threshold": threshold
        }
        
        # Кешируем результаты
        cache.set("anomalies", cache_params, result)
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при поиске аномалий: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при поиске аномалий: {str(e)}")

@router.get("/seasonality/{dataset_id}")
async def analyze_seasonality(
    dataset_id: str,
    date_column: str = Query(..., description="Имя столбца с датами"),
    value_column: str = Query(..., description="Имя столбца со значениями"),
    period: int = Query(None, description="Количество периодов для декомпозиции"),
    force_refresh: bool = Query(False, description="Принудительное обновление кеша"),
    db: Session = Depends(get_db)
):
    """
    Analyze seasonality in time series data
    """
    try:
        # Параметры для кеша
        cache_params = {
            "dataset_id": dataset_id,
            "date_column": date_column,
            "value_column": value_column,
            "period": period
        }
        
        # Проверяем кеш
        if not force_refresh:
            cached_result = cache.get("seasonality", cache_params)
            if cached_result:
                logger.info(f"Retrieved cached seasonality analysis for dataset {dataset_id}")
                return cached_result
        
        # Получаем информацию о датасете
        data_service = DataService(db)
        dataset = data_service.get_dataset(dataset_id)
        
        if not dataset:
            raise HTTPException(status_code=404, detail=f"Датасет с ID {dataset_id} не найден")
        
        # Загружаем данные
        df = pd.read_csv(dataset.file_path)
        
        # Проверяем наличие указанных колонок
        if date_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Колонка {date_column} не найдена в датасете")
        if value_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Колонка {value_column} не найдена в датасете")
        
        # Создаем анализатор и получаем результаты анализа сезонности
        analyzer = TimeSeriesAnalyzer(df, date_column, value_column)
        seasonality_results = analyzer.analyze_seasonality(period)
        
        # Кешируем результаты
        cache.set("seasonality", cache_params, seasonality_results)
        
        return seasonality_results
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при анализе сезонности: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при анализе сезонности: {str(e)}")

# Эндпоинт для очистки кеша для конкретного датасета
@router.post("/cache/clear/{dataset_id}")
async def clear_analysis_cache(dataset_id: str):
    """
    Clear all cached analysis results for dataset
    """
    try:
        # Очищаем кеш для всех типов анализа
        prefixes = ["stats", "anomalies", "seasonality"]
        for prefix in prefixes:
            cache.clear_prefix(f"{prefix}:{dataset_id}")
        
        return {"message": "Кеш успешно очищен"}
    
    except Exception as e:
        logger.error(f"Ошибка при очистке кеша: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при очистке кеша: {str(e)}")

@router.get("/decompose/{dataset_id}")
async def decompose_time_series(
    dataset_id: str,
    date_column: str = Query(..., description="Название столбца с датами"),
    value_column: str = Query(..., description="Название столбца со значениями"),
    period: Optional[int] = Query(None, description="Период сезонности (если известен)"),
    force_refresh: bool = Query(False, description="Принудительное обновление кеша"),
    db: Session = Depends(get_db)
) -> Dict:
    """
    Выполняет декомпозицию временного ряда на составляющие:
    - тренд
    - сезонность
    - остатки
    """
    try:
        # Параметры для кеша
        cache_params = {
            "dataset_id": dataset_id,
            "date_column": date_column,
            "value_column": value_column,
            "period": period
        }
        
        # Проверяем кеш
        if not force_refresh:
            cached_result = cache.get("decompose", cache_params)
            if cached_result:
                logger.info(f"Retrieved cached decomposition for dataset {dataset_id}")
                return cached_result
        
        # Получаем информацию о датасете
        data_service = DataService(db)
        dataset = data_service.get_dataset(dataset_id)
        
        if not dataset:
            raise HTTPException(status_code=404, detail=f"Датасет с ID {dataset_id} не найден")
        
        # Загружаем данные
        df = pd.read_csv(dataset.file_path)
        
        # Проверяем наличие указанных колонок
        if date_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Колонка {date_column} не найдена в датасете")
        if value_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Колонка {value_column} не найдена в датасете")
        
        # Конвертируем даты и сортируем
        df[date_column] = pd.to_datetime(df[date_column])
        df = df.sort_values(date_column)
        
        # Если период не указан, пытаемся определить автоматически
        if period is None:
            # Определяем частоту данных
            freq = pd.infer_freq(df[date_column])
            if freq == 'D':
                period = 7  # неделя
            elif freq == 'M':
                period = 12  # год
            elif freq == 'Q':
                period = 4  # год
            elif freq == 'H':
                period = 24  # день
            else:
                period = 7  # по умолчанию неделя
        
        # Выполняем декомпозицию
        decomposition = seasonal_decompose(
            df[value_column],
            period=period,
            extrapolate_trend='freq'
        )
        
        result = {
            "dates": df[date_column].dt.strftime('%Y-%m-%d %H:%M:%S').tolist(),
            "observed": decomposition.observed.tolist(),
            "trend": decomposition.trend.tolist(),
            "seasonal": decomposition.seasonal.tolist(),
            "residual": decomposition.resid.tolist(),
            "period": period
        }
        
        # Кешируем результаты
        cache.set("decompose", cache_params, result)
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при декомпозиции временного ряда: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при декомпозиции временного ряда: {str(e)}")