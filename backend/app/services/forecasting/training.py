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
        "fill_method": params.get("fill_method", settings.DEFAULT_FILL_METHOD),
        "group_cols": params.get("group_cols", []),
        "use_holidays": params.get("use_holidays", False),
        "freq": params.get("freq", settings.DEFAULT_FREQ),
        "metric": params.get("metric", settings.DEFAULT_METRIC),
        "models": params.get("models", ["* (все)"]),
        "presets": params.get("presets", settings.DEFAULT_PRESET),
        "prediction_length": params.get("prediction_length", settings.DEFAULT_PREDICTION_LENGTH),
        "time_limit": params.get("time_limit", settings.DEFAULT_TIME_LIMIT),
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
    ts_df = TimeSeriesDataFrame.from_data_frame(
        df,
        id_column="item_id",
        timestamp_column="timestamp",
        static_features_df=static_df
    )
    return ts_df


def train_model(task_params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Выполняет обучение модели согласно заданным параметрам
    
    Args:
        task_params: Параметры задачи обучения
        
    Returns:
        Результаты обучения модели
    """
    try:
        logger.info(f"Запуск обучения модели с параметрами: {task_params}")
        
        # Получаем данные из хранилища (в реальном приложении здесь было бы обращение к БД)
        from app.api.endpoints.data import DATASETS
        dataset_id = task_params["dataset_id"]
        
        if dataset_id not in DATASETS:
            raise ValueError(f"Датасет с ID {dataset_id} не найден")
        
        df_train = DATASETS[dataset_id]["df"].copy()
        
        # Получаем названия колонок
        dt_col = task_params["columns"].get("date_column")
        tgt_col = task_params["columns"].get("target_column")
        id_col = task_params["columns"].get("id_column")
        
        if not dt_col or not tgt_col or not id_col:
            raise ValueError("Не указаны обязательные колонки (дата, целевая переменная, ID)")
        
        # Преобразуем даты
        df_train[dt_col] = pd.to_datetime(df_train[dt_col], errors="coerce")
        
        # Добавляем праздники, если нужно
        if task_params["use_holidays"]:
            df_train = add_russian_holiday_feature(df_train, date_col=dt_col, holiday_col="russian_holiday")
            logger.info("Добавлен признак праздников 'russian_holiday'")
        
        # Заполняем пропуски
        df_train = fill_missing_values(
            df_train,
            method=task_params["fill_method"],
            group_cols=task_params["group_cols"]
        )
        
        # Подготавливаем статические признаки
        static_feats_val = task_params["static_features"]
        static_df = None
        if static_feats_val:
            tmp = df_train[[id_col] + static_feats_val].drop_duplicates(subset=[id_col]).copy()
            tmp.rename(columns={id_col: "item_id"}, inplace=True)
            static_df = tmp
        
        # Преобразуем в TimeSeriesDataFrame
        df_prepared = convert_to_timeseries(df_train, id_col, dt_col, tgt_col)
        ts_df = make_timeseries_dataframe(df_prepared, static_df=static_df)
        
        # Устанавливаем частоту, если она задана явно
        freq_val = task_params["freq"]
        actual_freq = None
        if freq_val != "auto":
            freq_short = freq_val.split(" ")[0] if " " in freq_val else freq_val
            ts_df = ts_df.convert_frequency(freq_short)
            ts_df = ts_df.fill_missing_values(method="ffill")
            actual_freq = freq_short
        
        # Готовим hyperparameters для выбранных моделей
        all_models_opt = "* (все)"
        chosen_models_val = task_params["models"]
        
        if not chosen_models_val or (len(chosen_models_val) == 1 and chosen_models_val[0] == all_models_opt):
            hyperparams = None
        else:
            no_star = [m for m in chosen_models_val if m != all_models_opt]
            hyperparams = {m: {} for m in no_star}
        
        # Подготавливаем метрику и квантили
        eval_key = task_params["metric"]
        q_levels = [0.5] if task_params["mean_only"] else None
        
        # Создаем директорию для сохранения модели
        model_id = task_params["model_id"]
        model_dir = os.path.join(settings.MODEL_DIR, model_id)
        os.makedirs(model_dir, exist_ok=True)
        
        # Создаем предиктор
        predictor = TimeSeriesPredictor(
            target="target",
            prediction_length=task_params["prediction_length"],
            eval_metric=eval_key,
            freq=actual_freq,
            quantile_levels=q_levels,
            path=model_dir,
            verbosity=2
        )
        
        # Запускаем обучение
        start_time = time.time()
        
        # В AutoGluon 1.2 используем параметры кросс-валидации напрямую
        predictor.fit(
            train_data=ts_df,
            time_limit=task_params["time_limit"],
            presets=task_params["presets"],
            hyperparameters=hyperparams,
            num_val_windows=1,
            val_step_size=task_params["prediction_length"],
            refit_every_n_windows=1
        )
        
        elapsed_time = time.time() - start_time
        logger.info(f"Обучение завершено за {elapsed_time:.2f} секунд")
        
        # Получаем результаты обучения
        summ = predictor.fit_summary()
        leaderboard = predictor.leaderboard(ts_df)
        
        # Сохраняем метаданные модели
        save_model_metadata(
            model_dir,
            dt_col, tgt_col, id_col,
            static_feats_val, freq_val,
            task_params["fill_method"], task_params["group_cols"],
            task_params["use_holidays"], task_params["metric"],
            task_params["presets"], task_params["models"],
            task_params["mean_only"],
            task_params["prediction_length"]
        )
        
        # Получаем информацию о лучшей модели
        if not leaderboard.empty:
            best_model = leaderboard.iloc[0]["model"]
            best_score = float(leaderboard.iloc[0]["score_val"])
            
            # Проверяем, является ли лучшая модель ансамблем
            ensemble_info = None
            if best_model == "WeightedEnsemble":
                info_dict = predictor.info()
                ensemble_block = info_dict.get("model_info", {}).get("WeightedEnsemble", {})
                model_weights = ensemble_block.get("model_weights", {})
                
                if model_weights:
                    ensemble_info = {
                        "models": list(model_weights.keys()),
                        "weights": list(model_weights.values())
                    }
        else:
            best_model = "Unknown"
            best_score = 0.0
            ensemble_info = None
        
        # Формируем результаты обучения
        result = {
            "model_id": model_id,
            "best_model": best_model,
            "best_score": best_score,
            "training_time": elapsed_time,
            "leaderboard": leaderboard.to_dict("records"),
            "fit_summary": summ,
            "weighted_ensemble_info": ensemble_info,
            "model_path": model_dir
        }
        
        logger.info(f"Модель успешно обучена, ID: {model_id}, лучшая модель: {best_model}, оценка: {best_score}")
        
        return result
    
    except Exception as e:
        logger.error(f"Ошибка при обучении модели: {str(e)}")
        raise


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