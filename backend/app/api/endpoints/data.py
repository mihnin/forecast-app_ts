from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query, Path, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
import pandas as pd
import os
import uuid
import json
import logging
from app.models.data import DataResponse, DataAnalysisRequest, DataAnalysisResponse, ColumnSelection
from app.services.data.data_processing import process_uploaded_file
from app.services.data.data_validation import validate_dataset
from app.services.data.data_service import DataService
from app.core.config import settings
from app.core.queue import JobQueue
from app.core.database import get_db
from sqlalchemy.orm import Session
from app.utils.file_utils import save_upload_file, clean_old_files

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/upload", response_model=DataResponse)
async def upload_data(
    file: UploadFile = File(...),
    chunk_size: int = Query(settings.DEFAULT_CHUNK_SIZE, description="Размер чанка для больших файлов"),
    db: Session = Depends(get_db)
):
    """
    Загрузка файла с данными для анализа и прогнозирования
    """
    try:
        # Проверяем, что файл существует
        if not file or not file.filename:
            raise HTTPException(
                status_code=400,
                detail="Файл не был загружен"
            )

        # Очищаем старые файлы перед загрузкой нового
        clean_old_files("data")
        
        # Безопасно сохраняем файл
        file_path, safe_filename = await save_upload_file(file, "data")
        
        # Обрабатываем файл
        try:
            df, info = process_uploaded_file(file_path, chunk_size)
        except Exception as e:
            # Если произошла ошибка при обработке, удаляем загруженный файл
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error(f"Ошибка при обработке файла: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Ошибка при обработке файла: {str(e)}")
        
        # Сохраняем информацию в базу данных
        try:
            data_service = DataService(db)
            dataset = data_service.create_dataset(file_path, safe_filename, df)
        except Exception as e:
            # Если произошла ошибка при сохранении в БД, удаляем загруженный файл
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error(f"Ошибка при сохранении в базу данных: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Ошибка при сохранении данных: {str(e)}")
        
        # Формируем ответ
        response = DataResponse(
            success=True,
            message=f"Файл {safe_filename} успешно загружен",
            dataset_id=dataset.id,
            info=info
        )
        
        return JSONResponse(
            status_code=200,
            content=response.dict(),
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Неожиданная ошибка при загрузке файла: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Неожиданная ошибка при загрузке файла: {str(e)}")


@router.post("/analyze", response_model=DataAnalysisResponse)
async def analyze_data(
    request: DataAnalysisRequest,
    background_tasks: BackgroundTasks,
    queue: JobQueue = Depends(),
    db: Session = Depends(get_db)
):
    """
    Выполнение анализа данных
    """
    try:
        # Проверяем существование датасета
        data_service = DataService(db)
        dataset = data_service.get_dataset(request.dataset_id)
        
        if not dataset:
            raise HTTPException(status_code=404, detail=f"Датасет с ID {request.dataset_id} не найден")
        
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
        
        # Возвращаем идентификатор задачи
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
async def get_columns(
    dataset_id: str = Path(..., description="Идентификатор набора данных"),
    db: Session = Depends(get_db)
):
    """
    Получение списка колонок датасета
    """
    try:
        # Получаем информацию о датасете из базы данных
        data_service = DataService(db)
        dataset = data_service.get_dataset(dataset_id)
        
        if not dataset:
            raise HTTPException(status_code=404, detail=f"Датасет с ID {dataset_id} не найден")
        
        # Получаем список колонок из JSON строки
        columns = json.loads(dataset.feature_columns)
        return columns
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении списка колонок: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении списка колонок: {str(e)}")


@router.get("/preview/{dataset_id}", response_model=Dict[str, Any])
async def get_preview(
    dataset_id: str = Path(..., description="Идентификатор набора данных"),
    rows: int = Query(10, description="Количество строк для предпросмотра"),
    db: Session = Depends(get_db)
):
    """
    Получение предпросмотра данных
    """
    try:
        # Получаем информацию о датасете из базы данных
        data_service = DataService(db)
        dataset = data_service.get_dataset(dataset_id)
        
        if not dataset:
            raise HTTPException(status_code=404, detail=f"Датасет с ID {dataset_id} не найден")
        
        # Проверяем существование файла
        if not os.path.exists(dataset.file_path):
            raise HTTPException(status_code=404, detail="Файл данных не найден")
        
        # Читаем данные из файла
        df = pd.read_csv(dataset.file_path)
        
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