import pandas as pd
import numpy as np
import logging
import os
import json
import time
from typing import Dict, Any, List, Optional
from autogluon.timeseries import TimeSeriesDataFrame, TimeSeriesPredictor
from app.services.features.feature_engineering import add_russian_holiday_feature, fill_missing_values
from app.services.data.data_processing import convert_to_timeseries
from app.core.config import settings

logger = logging.getLogger(__name__)

def prepare_prediction_task(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Подготавливает параметры задачи для прогнозирования в формате для очереди
    
    Args:
        params: Параметры прогнозирования
        
    Returns:
        Подготовленные параметры задачи
    """
    # Получаем идентификатор модели
    model_id = params.get("model_id")
    if not model_id:
        raise ValueError("Не указан идентификатор модели")
    
    # Получаем идентификатор датасета
    dataset_id = params.get("dataset_id")
    if not dataset_id:
        raise ValueError("Не указан идентификатор датасета")
    
    # Подготовка параметров прогнозирования
    task_params = {
        "model_id": model_id,
        "dataset_id": dataset_id,
        "prediction_length": params.get("prediction_length"),
        "prediction_id": f"pred_{int(time.time())}"  # Генерируем уникальный ID прогноза
    }
    
    return task_params


def forecast(predictor: TimeSeriesPredictor, ts_df: TimeSeriesDataFrame, known_covariates=None) -> pd.DataFrame:
    """
    Вызывает predictor.predict() и возвращает прогноз
    
    Args:
        predictor: Обученный TimeSeriesPredictor
        ts_df: TimeSeriesDataFrame с данными
        known_covariates: Известные ковариаты (опционально)
        
    Returns:
        DataFrame с прогнозами
    """
    logger.info("Вызов predictor.predict()...")
    preds = predictor.predict(ts_df, known_covariates=known_covariates)
    logger.info("Прогнозирование завершено.")
    return preds


def make_prediction(task_params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Выполняет прогнозирование согласно заданным параметрам
    
    Args:
        task_params: Параметры задачи прогнозирования
        
    Returns:
        Результаты прогнозирования
    """
    try:
        logger.info(f"Запуск прогнозирования с параметрами: {task_params}")
        
        # Получаем идентификаторы модели и датасета
        model_id = task_params["model_id"]
        dataset_id = task_params["dataset_id"]
        
        # Получаем данные из хранилища (в реальном приложении здесь было бы обращение к БД)
        from app.api.endpoints.data import DATASETS
        
        if dataset_id not in DATASETS:
            raise ValueError(f"Датасет с ID {dataset_id} не найден")
        
        df_pred = DATASETS[dataset_id]["df"].copy()
        
        # Путь к модели
        model_dir = os.path.join(settings.MODEL_DIR, model_id)
        
        if not os.path.exists(model_dir):
            raise ValueError(f"Модель с ID {model_id} не найдена")
        
        # Загружаем метаданные модели
        metadata_path = os.path.join(model_dir, settings.MODEL_INFO_FILE)
        
        if not os.path.exists(metadata_path):
            raise ValueError(f"Метаданные модели с ID {model_id} не найдены")
        
        with open(metadata_path, "r", encoding="utf-8") as f:
            model_metadata = json.load(f)
        
        # Получаем параметры из метаданных
        dt_col = model_metadata["dt_col"]
        tgt_col = model_metadata["tgt_col"]
        id_col = model_metadata["id_col"]
        
        static_feats = model_metadata.get("static_feats", [])
        use_holidays = model_metadata.get("use_holidays_val", False)
        fill_method = model_metadata.get("fill_method_val", "None")
        group_cols = model_metadata.get("group_cols_val", [])
        freq_val = model_metadata.get("freq_val", "auto")
        
        # Преобразуем даты
        df_pred[dt_col] = pd.to_datetime(df_pred[dt_col], errors="coerce")
        
        # Добавляем праздники, если нужно
        if use_holidays:
            df_pred = add_russian_holiday_feature(df_pred, date_col=dt_col, holiday_col="russian_holiday")
            logger.info("Добавлен признак праздников 'russian_holiday'")
        
        # Заполняем пропуски
        df_pred = fill_missing_values(
            df_pred,
            method=fill_method,
            group_cols=group_cols
        )
        
        # Подготавливаем статические признаки
        static_df = None
        if static_feats:
            tmp = df_pred[[id_col] + static_feats].drop_duplicates(subset=[id_col]).copy()
            tmp.rename(columns={id_col: "item_id"}, inplace=True)
            static_df = tmp
        
        # Проверяем, существует ли целевая колонка
        if tgt_col not in df_pred.columns:
            df_pred[tgt_col] = None
        
        # Преобразуем в TimeSeriesDataFrame
        df_prepared = convert_to_timeseries(df_pred, id_col, dt_col, tgt_col)
        ts_df = TimeSeriesDataFrame.from_data_frame(
            df_prepared,
            id_column="item_id",
            timestamp_column="timestamp",
            static_features_df=static_df
        )
        
        # Устанавливаем частоту, если она задана явно
        if freq_val != "auto":
            freq_short = freq_val.split(" ")[0] if " " in freq_val else freq_val
            ts_df = ts_df.convert_frequency(freq_short)
            ts_df = ts_df.fill_missing_values(method="ffill")
        
        # Загружаем предиктор
        predictor = TimeSeriesPredictor.load(model_dir)
        
        # Переопределяем prediction_length, если указан
        if task_params.get("prediction_length"):
            predictor.prediction_length = task_params["prediction_length"]
        
        # Выполняем прогнозирование
        start_time = time.time()
        preds = forecast(predictor, ts_df)
        elapsed_time = time.time() - start_time
        
        logger.info(f"Прогнозирование завершено за {elapsed_time:.2f} секунд")
        
        # Преобразуем прогноз в формат для ответа
        predictions = preds.reset_index().to_dict("records")
        
        # Подготавливаем данные для графиков
        plots = prepare_plot_data(preds)
        
        # Формируем результаты прогнозирования
        result = {
            "prediction_id": task_params["prediction_id"],
            "model_id": model_id,
            "dataset_id": dataset_id,
            "prediction_time": elapsed_time,
            "predictions": predictions,
            "plots": plots
        }
        
        return result
    
    except Exception as e:
        logger.error(f"Ошибка при прогнозировании: {str(e)}")
        raise


def prepare_plot_data(predictions: pd.DataFrame) -> Dict[str, Any]:
    """
    Подготавливает данные для построения графиков на фронтенде
    
    Args:
        predictions: DataFrame с прогнозами
        
    Returns:
        Данные для построения графиков
    """
    plot_data = {}
    
    try:
        # Преобразуем индекс и получаем уникальные ID
        df_reset = predictions.reset_index()
        unique_ids = df_reset["item_id"].unique()
        
        # Ограничиваем количество ID для визуализации
        max_ids = 10
        if len(unique_ids) > max_ids:
            unique_ids = unique_ids[:max_ids]
        
        # Подготавливаем данные для каждого ID
        for item_id in unique_ids:
            item_data = df_reset[df_reset["item_id"] == item_id]
            
            # Базовые данные для графика
            item_plot = {
                "timestamps": item_data["timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S").tolist()
            }
            
            # Добавляем все квантили, если они есть
            quantiles = [col for col in item_data.columns if col not in ["item_id", "timestamp"]]
            for q in quantiles:
                item_plot[q] = item_data[q].tolist()
            
            plot_data[str(item_id)] = item_plot
        
        # Добавляем метаданные для построения графиков
        plot_data["metadata"] = {
            "total_items": len(unique_ids),
            "displayed_items": len(plot_data) - 1,  # -1 из-за метаданных
            "quantiles": [col for col in predictions.columns if col not in ["item_id", "timestamp"]]
        }
    
    except Exception as e:
        logger.error(f"Ошибка при подготовке данных для графиков: {str(e)}")
        plot_data["error"] = str(e)
    
    return plot_data