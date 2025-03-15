from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import Dict, Any, List, Optional
import logging
import os
import json
from app.models.training import TrainingRequest, TrainingResponse, TrainingResult
from app.core.queue import JobQueue
from app.services.forecasting.training import prepare_training_task

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/train", response_model=TrainingResponse)
async def train_model(
    request: TrainingRequest,
    background_tasks: BackgroundTasks,
    queue: JobQueue = Depends()
):
    """
    Запуск обучения модели
    """
    try:
        # Подготавливаем параметры задачи
        task_params = prepare_training_task(request.params)
        
        # Добавляем задачу в очередь
        task_id = queue.add_task(
            user_id=request.user_id,
            task_type="training",
            params=task_params
        )
        
        # Получаем позицию в очереди
        position = queue.get_position(task_id)
        
        # Оцениваем время выполнения (условно)
        estimated_time = request.params.time_limit * 1.2  # 20% запас
        
        return TrainingResponse(
            task_id=task_id,
            position=position,
            estimated_time=int(estimated_time)
        )
    
    except Exception as e:
        logger.error(f"Ошибка при создании задачи обучения: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при создании задачи обучения: {str(e)}")


@router.get("/result/{task_id}", response_model=TrainingResult)
async def get_training_result(
    task_id: str,
    queue: JobQueue = Depends()
):
    """
    Получение результатов обучения модели
    """
    try:
        # Получаем информацию о задаче
        tasks = queue.get_all_tasks()
        task = next((t for t in tasks if t.get("task_id") == task_id), None)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"Задача с ID {task_id} не найдена")
        
        if task["status"] != "completed":
            raise HTTPException(status_code=400, detail=f"Задача с ID {task_id} еще не завершена (статус: {task['status']})")
        
        # Получаем результаты обучения
        if "result" not in task or not task["result"]:
            raise HTTPException(status_code=500, detail=f"Результаты для задачи с ID {task_id} отсутствуют")
        
        # Преобразуем результаты для возврата
        result = task["result"]
        
        return TrainingResult(
            model_id=result.get("model_id"),
            best_model=result.get("best_model"),
            best_score=result.get("best_score"),
            leaderboard=result.get("leaderboard"),
            fit_summary=result.get("fit_summary"),
            weighted_ensemble_info=result.get("weighted_ensemble_info")
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении результатов обучения: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении результатов обучения: {str(e)}")


@router.get("/models", response_model=Dict[str, Any])
async def get_available_models():
    """
    Получение списка доступных моделей и их описаний
    """
    from app.core.config import settings
    
    return {
        "metrics": settings.METRICS_DICT,
        "models": settings.AG_MODELS,
        "presets": ["fast_training", "medium_quality", "high_quality", "best_quality"]
    }

@router.get("/models/trained", response_model=List[Dict[str, Any]])
async def get_trained_models():
    """
    Получение списка обученных моделей
    """
    try:
        from app.core.config import settings
        # Проверяем директорию с моделями
        model_dir = settings.MODEL_DIR
        if not os.path.exists(model_dir):
            return []
        
        # Получаем список моделей
        models = []
        for model_id in os.listdir(model_dir):
            model_path = os.path.join(model_dir, model_id)
            if not os.path.isdir(model_path):
                continue
                
            # Проверяем наличие информации о модели
            info_path = os.path.join(model_path, settings.MODEL_INFO_FILE)
            if not os.path.exists(info_path):
                continue
                
            # Загружаем информацию о модели
            with open(info_path, "r", encoding="utf-8") as f:
                model_info = json.load(f)
            
            # Получаем информацию о лидерборде, если есть
            leaderboard_path = os.path.join(model_path, "leaderboard.json")
            leaderboard = None
            best_model = None
            score_val = None
            
            if os.path.exists(leaderboard_path):
                try:
                    with open(leaderboard_path, "r", encoding="utf-8") as f:
                        leaderboard = json.load(f)
                        
                    if leaderboard and len(leaderboard) > 0:
                        best_model = leaderboard[0].get("model")
                        score_val = leaderboard[0].get("score_val")
                except Exception as e:
                    logger.error(f"Ошибка при загрузке лидерборда модели {model_id}: {str(e)}")
            
            # Создаем запись о модели
            model_entry = {
                "id": model_id,
                "name": f"{best_model or 'Model'} ({model_id[:8]}...)",
                "best_model": best_model,
                "score_val": score_val,
                "created_at": model_info.get("created_at", 0),
                "dataset_id": model_info.get("dataset_id"),
                "prediction_length": model_info.get("prediction_length"),
                "freq": model_info.get("freq_val"),
                "metric": model_info.get("metric"),
                "is_ensemble": best_model == "WeightedEnsemble"
            }
            
            models.append(model_entry)
        
        # Сортируем модели по времени создания (сначала новые)
        models.sort(key=lambda x: x.get("created_at", 0), reverse=True)
        
        return models
    
    except Exception as e:
        logger.error(f"Ошибка при получении списка обученных моделей: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении списка обученных моделей: {str(e)}")