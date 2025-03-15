from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query, Path, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
import pandas as pd
import os
import uuid
import json
import logging
from app.models.data import DataResponse, DataAnalysisRequest, DataAnalysisResponse, ColumnSelection
from app.services.data.data_processing import process_uploaded_file, detect_frequency
from app.services.data.data_validation import validate_dataset
from app.core.config import settings
from app.core.queue import JobQueue

router = APIRouter()
logger = logging.getLogger(__name__)

# Временное хранилище данных (в реальном приложении здесь была бы база данных)
DATASETS = {}

@router.post("/upload", response_model=DataResponse)
async def upload_data(
    file: UploadFile = File(...),
    chunk_size: int = Query(settings.DEFAULT_CHUNK_SIZE, description="Размер чанка для больших файлов")
):
    """
    Загрузка файла с данными для анализа и прогнозирования
    """
    try:
        # Генерируем уникальный ID для датасета
        dataset_id = str(uuid.uuid4())
        
        # Сохраняем загруженный файл во временную директорию
        file_path = f"data/{dataset_id}_{file.filename}"
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Обрабатываем файл
        df, info = process_uploaded_file(file_path, chunk_size)
        
        # Определяем частоту временного ряда
        try:
            # Ищем подходящие имена для колонок даты/времени
            date_cols = [col for col in df.columns if any(keyword in col.lower() 
                                                         for keyword in ["date", "time", "дата", "время"])]
            
            # Если подходящие колонки не найдены, ищем колонки с datetime типом
            if not date_cols:
                date_cols = [col for col in df.columns 
                            if pd.api.types.is_datetime64_any_dtype(df[col]) 
                            or (pd.to_datetime(df[col], errors='coerce').notna().sum() > 0.8 * len(df))]
            
            # Если колонка найдена, определяем частоту
            freq = None
            if date_cols:
                freq = detect_frequency(df, date_cols[0])
                logger.info(f"Определена частота временного ряда: {freq}")
        except Exception as e:
            logger.warning(f"Не удалось определить частоту: {str(e)}")
            freq = None
        
        # Сохраняем информацию о датасете
        DATASETS[dataset_id] = {
            "file_path": file_path,
            "filename": file.filename,
            "info": info,
            "df": df,  # В реальном приложении мы бы не хранили DataFrame в памяти
            "detected_frequency": freq
        }
        
        # Дополняем информацию о датасете
        additional_info = {
            "detected_frequency": freq,
            "has_missing_values": any(df[col].isna().any() for col in df.columns),
            "categorical_columns": [col for col in df.columns if pd.api.types.is_categorical_dtype(df[col]) 
                                  or pd.api.types.is_object_dtype(df[col])],
            "numeric_columns": [col for col in df.columns if pd.api.types.is_numeric_dtype(df[col])]
        }
        
        # Добавляем дополнительную информацию к основной
        if hasattr(info, "additional"):
            info.additional.update(additional_info)
        else:
            info.additional = additional_info
        
        # Формируем ответ
        response = DataResponse(
            success=True,
            message=f"Файл {file.filename} успешно загружен",
            dataset_id=dataset_id,
            info=info
        )
        
        return response
    
    except Exception as e:
        logger.error(f"Ошибка при загрузке файла: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке файла: {str(e)}")


@router.post("/analyze", response_model=DataAnalysisResponse)
async def analyze_data(
    request: DataAnalysisRequest,
    background_tasks: BackgroundTasks,
    queue: JobQueue = Depends()
):
    """
    Выполнение анализа данных
    """
    try:
        # Проверяем, существует ли датасет
        if request.dataset_id not in DATASETS:
            raise HTTPException(status_code=404, detail=f"Датасет с ID {request.dataset_id} не найден")
        
        # Получаем данные
        dataset = DATASETS[request.dataset_id]
        df = dataset["df"]
        
        # Создаем задачу для анализа в фоне
        task_id = queue.add_task(
            user_id="user123",  # В реальном приложении здесь был бы ID пользователя
            task_type="analysis",
            params={
                "dataset_id": request.dataset_id,
                "columns": request.columns.dict(),
                "analysis_type": request.analysis_type,
                "params": request.params
            }
        )
        
        # Возвращаем идентификатор задачи и позицию в очереди
        return DataAnalysisResponse(
            success=True,
            message="Задача на анализ данных успешно создана",
            analysis_id=task_id
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при анализе данных: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при анализе данных: {str(e)}")


@router.get("/columns/{dataset_id}", response_model=List[str])
async def get_columns(dataset_id: str = Path(..., description="Идентификатор набора данных")):
    """
    Получение списка колонок датасета
    """
    try:
        # Проверяем, существует ли датасет
        if dataset_id not in DATASETS:
            raise HTTPException(status_code=404, detail=f"Датасет с ID {dataset_id} не найден")
        
        # Получаем и возвращаем список колонок
        columns = DATASETS[dataset_id]["info"].column_names
        return columns
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении списка колонок: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении списка колонок: {str(e)}")


@router.get("/preview/{dataset_id}", response_model=Dict[str, Any])
async def get_preview(
    dataset_id: str = Path(..., description="Идентификатор набора данных"),
    rows: int = Query(10, description="Количество строк для предпросмотра")
):
    """
    Получение предпросмотра данных
    """
    try:
        # Проверяем, существует ли датасет
        if dataset_id not in DATASETS:
            raise HTTPException(status_code=404, detail=f"Датасет с ID {dataset_id} не найден")
        
        # Получаем данные
        df = DATASETS[dataset_id]["df"]
        
        # Преобразуем данные в формат для ответа
        preview = df.head(rows).to_dict(orient="records")
        
        return {
            "preview": preview,
            "total_rows": len(df),
            "displayed_rows": min(rows, len(df))
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении предпросмотра данных: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении предпросмотра данных: {str(e)}")