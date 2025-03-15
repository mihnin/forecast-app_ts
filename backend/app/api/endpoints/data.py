from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query, Path, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
import pandas as pd
import os
import uuid
import json
import logging
import traceback  # Для подробного логирования ошибок
from app.models.data import DataResponse, DataAnalysisRequest, DataAnalysisResponse, ColumnSelection
from app.services.data.data_processing import process_uploaded_file
from app.services.data.data_validation import validate_dataset
from app.services.data.data_service import DataService
from app.core.config import settings
from app.core.queue import JobQueue
from app.core.database import get_db
from sqlalchemy.orm import Session
from app.utils.file_utils import save_upload_file, clean_old_files
from fastapi.middleware.cors import CORSMiddleware

router = APIRouter()
logger = logging.getLogger(__name__)

@router.options("/upload")
async def upload_options():
    """
    Обработка OPTIONS-запроса для загрузки файлов
    """
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Content-Length",
            "Access-Control-Max-Age": "86400",
        }
    )

@router.post("/upload", response_model=DataResponse)
async def upload_data(
    file: UploadFile = File(...),
    chunk_size: int = Query(settings.DEFAULT_CHUNK_SIZE, description="Размер чанка для больших файлов"),
    db: Session = Depends(get_db)
):
    """
    Загрузка файла с данными для анализа и прогнозирования
    """
    file_path = None
    try:
        # Проверяем, что файл существует и не пустой
        if not file or not file.filename:
            logger.error("Файл не был загружен или имеет пустое имя")
            raise HTTPException(
                status_code=400,
                detail="Файл не был загружен или имеет пустое имя"
            )
        
        # Проверяем размер файла
        try:
            # Сначала проверяем, доступен ли размер файла
            if hasattr(file, 'size'):
                file_size = file.size
            else:
                # Если размер не доступен напрямую, читаем кусок и проверяем позицию
                await file.seek(0)
                chunk = await file.read(8192)
                file_size = 8192 if chunk else 0
                await file.seek(0)  # Возвращаем указатель в начало
            
            # Проверяем, что файл не пустой
            if file_size == 0:
                logger.error("Загружен пустой файл")
                raise HTTPException(
                    status_code=400, 
                    detail="Загружен пустой файл"
                )
            
            logger.info(f"Загрузка файла: {file.filename}, размер: {file_size} байт")
        except Exception as e:
            logger.error(f"Ошибка при проверке размера файла: {str(e)}")
            logger.error(traceback.format_exc())
            # Если не можем проверить размер, продолжаем, но логируем предупреждение
            logger.warning("Не удалось проверить размер файла, продолжаем обработку")

        # Очищаем старые файлы перед загрузкой нового
        clean_old_files("data")
        
        # Безопасно сохраняем файл
        logger.info(f"Сохранение загруженного файла {file.filename}")
        file_path, safe_filename = await save_upload_file(file, "data")
        logger.info(f"Файл сохранен как {safe_filename} по пути {file_path}")
        
        # Обрабатываем файл
        try:
            logger.info(f"Начало обработки файла {file_path}")
            df, info = process_uploaded_file(file_path, chunk_size)
            logger.info(f"Успешная обработка файла: {len(df)} строк, {len(df.columns)} колонок")
        except MemoryError as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error(f"Недостаточно памяти для обработки файла: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(
                status_code=507,  # Insufficient Storage
                detail=f"Недостаточно памяти для обработки файла. Попробуйте разделить файл на меньшие части или увеличить доступную память."
            )
        except pd.errors.ParserError as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error(f"Ошибка при парсинге файла: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(
                status_code=400,
                detail=f"Файл имеет неверный формат или структуру данных: {str(e)}"
            )
        except pd.errors.EmptyDataError as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error(f"Загруженный файл не содержит данных: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(
                status_code=400,
                detail="Загруженный файл не содержит данных"
            )
        except ImportError as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error(f"Отсутствуют необходимые библиотеки для чтения файла: {str(e)}")
            logger.error(traceback.format_exc())
            # Проверяем, связан ли импорт с Excel-библиотеками
            error_msg = str(e).lower()
            if 'openpyxl' in error_msg or 'xlrd' in error_msg:
                raise HTTPException(
                    status_code=500,
                    detail="Отсутствуют необходимые библиотеки для чтения Excel-файлов. Установите пакеты openpyxl и xlrd."
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Ошибка импорта библиотеки: {str(e)}"
                )
        except ValueError as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error(f"Ошибка валидации данных: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(
                status_code=400,
                detail=f"Ошибка в данных: {str(e)}"
            )
        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error(f"Ошибка при обработке файла: {str(e)}")
            logger.error(traceback.format_exc())
            # Проверяем, связана ли ошибка с Excel-файлами
            error_msg = str(e).lower()
            if 'excel' in error_msg or 'xls' in error_msg or 'sheet' in error_msg:
                raise HTTPException(
                    status_code=400,
                    detail=f"Ошибка при обработке Excel-файла: {str(e)}. Возможно, файл поврежден или имеет неподдерживаемый формат."
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Ошибка при обработке файла: {str(e)}"
                )
        
        # Базовая валидация данных
        if df.empty:
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error("Загружен пустой датасет")
            raise HTTPException(
                status_code=400,
                detail="Загруженный файл не содержит данных или формат не поддерживается"
            )
        
        # Проверка наличия хотя бы одной числовой колонки
        numeric_cols = df.select_dtypes(include=['number']).columns
        if len(numeric_cols) == 0:
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error("Датасет не содержит числовых колонок")
            raise HTTPException(
                status_code=400,
                detail="Файл должен содержать хотя бы одну числовую колонку для анализа временных рядов"
            )

        # Проверка наличия колонки с датами
        date_cols = [col for col in df.columns if pd.api.types.is_datetime64_any_dtype(df[col]) 
                    or (pd.to_datetime(df[col], errors='coerce').notna().sum() > 0.7 * len(df))]
        if not date_cols:
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error("Не найдены колонки с датами")
            raise HTTPException(
                status_code=400,
                detail="Файл должен содержать колонку с датами для анализа временных рядов"
            )
            
        # Сохраняем информацию в базу данных
        try:
            logger.info(f"Сохранение информации о датасете в базу данных")
            data_service = DataService(db)
            dataset = data_service.create_dataset(file_path, safe_filename, df)
            logger.info(f"Датасет сохранен с ID: {dataset.id}")
        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            logger.error(f"Ошибка при сохранении в базу данных: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(
                status_code=500,
                detail=f"Ошибка при сохранении данных в базу: {str(e)}"
            )
        
        # Формируем ответ
        response = DataResponse(
            success=True,
            message=f"Файл {safe_filename} успешно загружен",
            dataset_id=dataset.id,
            info=info
        )
        
        logger.info(f"Файл успешно загружен и обработан, присвоен ID: {dataset.id}")
        return JSONResponse(
            status_code=200,
            content=response.dict(),
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Content-Length",
                "Access-Control-Max-Age": "86400",
            }
        )
    
    except HTTPException:
        # Повторно логируем исключение для диагностики
        logger.error(f"HTTP исключение при загрузке файла: {traceback.format_exc()}")
        raise
    except Exception as e:
        # Удаляем файл при необработанной ошибке
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        logger.error(f"Необработанная ошибка при загрузке файла: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Внутренняя ошибка сервера: {str(e)}"
        )


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