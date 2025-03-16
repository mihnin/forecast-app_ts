import pandas as pd
import numpy as np
import logging
import os
import json
import time
import traceback  # Добавлен для более подробного логирования ошибок
from typing import Dict, Any, List, Optional, Tuple, Callable
# Восстанавливаем импорт autogluon
from autogluon.timeseries import TimeSeriesDataFrame, TimeSeriesPredictor
from app.services.features.feature_engineering import add_russian_holiday_feature, fill_missing_values
from app.services.data.data_processing import convert_to_timeseries
from app.core.config import settings

logger = logging.getLogger(__name__)

# Добавляем кастомные метрики для оценки моделей
def calculate_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    Рассчитывает Mean Absolute Percentage Error (MAPE)
    
    Args:
        y_true: Истинные значения
        y_pred: Предсказанные значения
        
    Returns:
        MAPE в процентах
    """
    mask = y_true != 0
    return 100 * np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask]))


def calculate_rmsse(y_true: np.ndarray, y_pred: np.ndarray, train_values: np.ndarray) -> float:
    """
    Рассчитывает Root Mean Squared Scaled Error (RMSSE)
    
    Args:
        y_true: Истинные значения
        y_pred: Предсказанные значения
        train_values: Значения обучающего набора для масштабирования
        
    Returns:
        RMSSE
    """
    # Вычисляем знаменатель (сезонная наивная ошибка на тренировочном наборе)
    naive_errors = np.diff(train_values)
    naive_error_sq_mean = np.mean(naive_errors ** 2)
    
    # Если знаменатель близок к нулю, возвращаем большое значение или применяем регуляризацию
    if naive_error_sq_mean < 1e-10:
        return np.mean((y_true - y_pred) ** 2) / (naive_error_sq_mean + 1e-10)
    
    # Вычисляем числитель (MSE модели)
    model_error_sq_mean = np.mean((y_true - y_pred) ** 2)
    
    # RMSSE
    return np.sqrt(model_error_sq_mean / naive_error_sq_mean)


def calculate_additional_metrics(predictor: TimeSeriesPredictor, ts_df: TimeSeriesDataFrame) -> Dict[str, Dict[str, float]]:
    """
    Рассчитывает дополнительные метрики для моделей
    
    Args:
        predictor: Обученный TimeSeriesPredictor
        ts_df: Оригинальный TimeSeriesDataFrame
        
    Returns:
        Словарь с дополнительными метриками для каждой модели
    """
    metrics = {}
    
    try:
        # Получаем все модели
        model_names = predictor.get_model_names()
        
        for model_name in model_names:
            # Разбиваем данные на обучение и валидацию
            # (используем последние prediction_length точек для валидации)
            last_idx = -predictor.prediction_length
            if abs(last_idx) >= len(ts_df):
                last_idx = -int(len(ts_df) * 0.2)  # Берем 20% в конце, если длина прогноза больше размера набора
            
            train_df = ts_df.slice_by_timestep(None, last_idx)
            val_df = ts_df.slice_by_timestep(last_idx, None)
            
            if val_df.empty:
                logger.warning(f"Недостаточно данных для валидации модели {model_name}")
                continue
                
            # Делаем прогноз с указанной моделью
            try:
                preds = predictor.predict(train_df, model=model_name)
                
                # Получаем истинные значения
                y_true = val_df['target'].values
                
                # Получаем предсказанные значения (используем медиану, если возможно)
                if '0.5' in preds.columns:
                    y_pred = preds['0.5'].values
                elif 'mean' in preds.columns:
                    y_pred = preds['mean'].values
                else:
                    y_pred = preds.iloc[:, 0].values  # берем первый столбец
                
                # Отсекаем по длине массивов (так как количество рядов может быть разным)
                n = min(len(y_true), len(y_pred))
                y_true = y_true[:n]
                y_pred = y_pred[:n]
                
                # Рассчитываем MAPE
                mape = calculate_mape(y_true, y_pred)
                
                # Рассчитываем RMSSE
                train_values = train_df['target'].values
                rmsse = calculate_rmsse(y_true, y_pred, train_values)
                
                # Сохраняем метрики
                metrics[model_name] = {
                    'MAPE': float(mape),
                    'RMSSE': float(rmsse)
                }
                
            except Exception as e:
                logger.error(f"Ошибка при расчете дополнительных метрик для модели {model_name}: {str(e)}")
                metrics[model_name] = {
                    'error': str(e)
                }
                
    except Exception as e:
        logger.error(f"Ошибка при расчете дополнительных метрик: {str(e)}")
        logger.error(traceback.format_exc())
    
    return metrics


def prepare_training_task(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Подготавливает параметры задачи для обучения модели в формате для очереди
    
    Args:
        params: Параметры обучения модели
        
    Returns:
        Подготовленные параметры задачи
    """
    # Получаем идентификатор датасета
    dataset_id = params.get("dataset_id")
    if not dataset_id:
        raise ValueError("Не указан идентификатор датасета")
    
    # Подготовка параметров обучения с дефолтными значениями
    task_params = {
        "dataset_id": dataset_id,
        "columns": params.get("columns", {}),
        "static_features": params.get("static_features", []),
        "fill_method": params.get("fill_method", "ffill"),  # Используем значение по умолчанию
        "group_cols": params.get("group_cols", []),
        "use_holidays": params.get("use_holidays", False),
        "freq": params.get("freq", "auto"),  # Используем значение по умолчанию
        "metric": params.get("metric", "MASE"),  # Используем значение по умолчанию
        "models": params.get("models", ["* (все)"]),
        "presets": params.get("presets", "medium_quality"),  # Используем значение по умолчанию
        "prediction_length": params.get("prediction_length", settings.DEFAULT_PREDICTION_LENGTH),
        "time_limit": params.get("time_limit", settings.DEFAULT_TRAINING_TIME_LIMIT),
        "mean_only": params.get("mean_only", False),
        "model_id": f"model_{int(time.time())}"  # Генерируем уникальный ID модели
    }
    
    return task_params


def make_timeseries_dataframe(df: pd.DataFrame, static_df: Optional[pd.DataFrame] = None) -> TimeSeriesDataFrame:
    """
    Создаёт TimeSeriesDataFrame из DataFrame
    
    Args:
        df: DataFrame с колонками (item_id, timestamp, target)
        static_df: DataFrame со статическими признаками (опционально)
        
    Returns:
        TimeSeriesDataFrame для использования с AutoGluon
    """
    try:
        ts_df = TimeSeriesDataFrame.from_data_frame(
            df,
            id_column="item_id",
            timestamp_column="timestamp",
            static_features_df=static_df
        )
        return ts_df
    except Exception as e:
        logger.error(f"Ошибка при создании TimeSeriesDataFrame: {str(e)}")
        logger.error(traceback.format_exc())
        raise ValueError(f"Ошибка при создании TimeSeriesDataFrame: {str(e)}")


def train_model(task_params: Dict[str, Any], progress_callback: Optional[Callable] = None) -> Dict[str, Any]:
    """
    Заглушка для train_model, возвращает данные о задаче.
    
    В данный момент функция временно отключена из-за проблем с зависимостями autogluon.
    
    Args:
        task_params: Параметры задачи обучения
        progress_callback: Функция обратного вызова для отображения прогресса (опционально)
        
    Returns:
        Результаты задачи обучения (заглушка)
    """
    logger.warning("Функция train_model временно отключена из-за проблем с зависимостями")
    
    if progress_callback:
        # Имитируем прогресс для интерфейса
        for i in range(10):
            progress = (i + 1) * 10
            progress_callback(progress, f"Этап имитации {i+1}/10")
            time.sleep(0.5)  # Имитация задержки работы
    
    # Создаем результаты-заглушку
    model_id = task_params.get("model_id", f"dummy_model_{int(time.time())}")
    
    return {
        "status": "completed",
        "model_id": model_id,
        "message": "Функция обучения моделей временно отключена из-за проблем с зависимостями",
        "parameters": task_params,
        "dummy_model": True
    }


def save_model_metadata(model_dir: str, dt_col: str, tgt_col: str, id_col: str,
                     static_feats: List[str], freq_val: str,
                     fill_method_val: str, group_cols_val: List[str],
                     use_holidays_val: bool, metric: str,
                     presets: str, chosen_models: List[str],
                     mean_only: bool, prediction_length: int):
    """
    Сохраняет метаданные (колонки и настройки) модели в JSON-файл
    
    Args:
        model_dir: Директория модели
        dt_col: Колонка с датами
        tgt_col: Целевая колонка
        id_col: Колонка с ID
        static_feats: Статические признаки
        freq_val: Частота данных
        fill_method_val: Метод заполнения пропусков
        group_cols_val: Колонки группировки
        use_holidays_val: Использовать праздники
        metric: Метрика оценки
        presets: Пресет обучения
        chosen_models: Выбранные модели
        mean_only: Прогнозировать только среднее
        prediction_length: Горизонт прогноза
    """
    info_dict = {
        "dt_col": dt_col,
        "tgt_col": tgt_col,
        "id_col": id_col,
        "static_feats": static_feats,
        "freq_val": freq_val,
        "fill_method_val": fill_method_val,
        "group_cols_val": group_cols_val,
        "use_holidays_val": use_holidays_val,
        "metric": metric,
        "presets": presets,
        "chosen_models": chosen_models,
        "mean_only": mean_only,
        "prediction_length": prediction_length,
        "created_at": time.time()
    }
    
    path_json = os.path.join(model_dir, settings.MODEL_INFO_FILE)
    try:
        with open(path_json, "w", encoding="utf-8") as f:
            json.dump(info_dict, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Ошибка при сохранении model_info.json: {e}")
        logger.error(traceback.format_exc())