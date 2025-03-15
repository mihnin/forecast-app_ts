from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import Dict, Any
import logging
from app.models.prediction import PredictionRequest, PredictionResponse, PredictionResult
from app.core.queue import JobQueue
from app.services.forecasting.prediction import prepare_prediction_task
from app.utils.task_utils import get_task_by_id, validate_completed_task, export_to_format

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/forecast", response_model=PredictionResponse)
async def predict(
    request: PredictionRequest,
    background_tasks: BackgroundTasks,
    queue: JobQueue = Depends()
):
    """
    Запуск прогнозирования
    """
    try:
        # Подготавливаем параметры задачи
        task_params = prepare_prediction_task(request.params)
        
        # Добавляем задачу в очередь
        task_id = queue.add_task(
            user_id=request.user_id,
            task_type="prediction",
            params=task_params
        )
        
        # Получаем позицию в очереди
        position = queue.get_position(task_id)
        
        # Оцениваем время выполнения (условно)
        estimated_time = 30  # Прогнозирование обычно быстрее обучения
        
        return PredictionResponse(
            task_id=task_id,
            position=position,
            estimated_time=estimated_time
        )
    
    except Exception as e:
        logger.error(f"Ошибка при создании задачи прогнозирования: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при создании задачи прогнозирования: {str(e)}")


@router.get("/result/{task_id}", response_model=PredictionResult)
async def get_prediction_result(
    task_id: str,
    queue: JobQueue = Depends()
):
    """
    Получение результатов прогнозирования
    """
    try:
        # Используем вспомогательную функцию для получения и проверки задачи
        task = get_task_by_id(queue, task_id)
        result = validate_completed_task(task, task_id)
        
        return PredictionResult(
            prediction_id=task_id,
            predictions=result.get("predictions"),
            plots=result.get("plots")
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении результатов прогнозирования: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении результатов прогнозирования: {str(e)}")


@router.get("/export/{task_id}")
async def export_prediction(
    task_id: str,
    format: str = "json",
    queue: JobQueue = Depends()
):
    """
    Экспорт результатов прогнозирования в различных форматах
    """
    try:
        # Используем вспомогательные функции для получения и проверки задачи
        task = get_task_by_id(queue, task_id)
        result = validate_completed_task(task, task_id)
        
        # Получаем данные для экспорта
        predictions = result.get("predictions")
        
        # Используем общую функцию для экспорта в различные форматы
        return export_to_format(predictions, format, "prediction", task_id)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при экспорте результатов: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при экспорте результатов: {str(e)}")