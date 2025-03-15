import pandas as pd
import numpy as np
import logging
import os
import json
import time
import traceback  # Добавлен для более подробного логирования ошибок
from typing import Dict, Any, List, Optional, Tuple
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
            logger.error(f"Датасет с ID {dataset_id} не найден")
            raise ValueError(f"Датасет с ID {dataset_id} не найден")
        
        # Копируем данные для предотвращения модификации оригинала
        df_train = DATASETS[dataset_id]["df"].copy(deep=True)
        
        # Получаем названия колонок
        dt_col = task_params["columns"].get("date_column")
        tgt_col = task_params["columns"].get("target_column")
        id_col = task_params["columns"].get("id_column")
        
        if not dt_col or not tgt_col or not id_col:
            logger.error("Не указаны обязательные колонки (дата, целевая переменная, ID)")
            raise ValueError("Не указаны обязательные колонки (дата, целевая переменная, ID)")
        
        # Проверка наличия колонок в датасете
        missing_cols = [col for col in [dt_col, tgt_col, id_col] if col not in df_train.columns]
        if missing_cols:
            logger.error(f"В датасете отсутствуют следующие колонки: {', '.join(missing_cols)}")
            raise ValueError(f"В датасете отсутствуют следующие колонки: {', '.join(missing_cols)}")
        
        # Преобразуем даты
        df_train[dt_col] = pd.to_datetime(df_train[dt_col], errors="coerce")
        
        # Проверка на пропущенные значения в датах после преобразования
        if df_train[dt_col].isna().any():
            na_dates_count = df_train[dt_col].isna().sum()
            logger.warning(f"Обнаружены пропущенные значения в столбце даты ({na_dates_count}). Удаляем соответствующие строки.")
            df_train = df_train.dropna(subset=[dt_col])
        
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
        
        # Проверка на наличие пропусков в целевой переменной
        if df_train[tgt_col].isna().any():
            na_target_count = df_train[tgt_col].isna().sum()
            logger.warning(f"Обнаружены пропущенные значения в целевой переменной ({na_target_count}). Удаляем соответствующие строки.")
            df_train = df_train.dropna(subset=[tgt_col])
        
        # Подготавливаем статические признаки
        static_feats_val = task_params["static_features"]
        static_df = None
        if static_feats_val:
            # Проверяем наличие статических признаков в датасете
            missing_static_cols = [col for col in static_feats_val if col not in df_train.columns]
            if missing_static_cols:
                logger.warning(f"Следующие статические признаки отсутствуют в датасете: {', '.join(missing_static_cols)}")
                static_feats_val = [col for col in static_feats_val if col in df_train.columns]
            
            if static_feats_val:  # Если после фильтрации еще остались признаки
                tmp = df_train[[id_col] + static_feats_val].drop_duplicates(subset=[id_col]).copy()
                tmp.rename(columns={id_col: "item_id"}, inplace=True)
                static_df = tmp
        
        # Преобразуем в TimeSeriesDataFrame
        logger.info("Преобразуем данные в формат временных рядов")
        df_prepared = convert_to_timeseries(df_train, id_col, dt_col, tgt_col)
        
        # Проверка на пустой результат преобразования
        if df_prepared.empty:
            logger.error("После преобразования в формат временных рядов получен пустой датафрейм")
            raise ValueError("После преобразования данных получен пустой временной ряд")
        
        # Создаем TimeSeriesDataFrame
        ts_df = make_timeseries_dataframe(df_prepared, static_df=static_df)
        
        # Проверка на количество временных рядов
        num_timeseries = ts_df['item_id'].nunique()
        logger.info(f"Количество временных рядов: {num_timeseries}")
        
        # Устанавливаем частоту, если она задана явно
        freq_val = task_params["freq"]
        actual_freq = None
        if freq_val != "auto":
            try:
                freq_short = freq_val.split(" ")[0] if " " in freq_val else freq_val
                ts_df = ts_df.convert_frequency(freq_short)
                ts_df = ts_df.fill_missing_values(method="ffill")
                actual_freq = freq_short
                logger.info(f"Частота временных рядов установлена на {freq_short}")
            except Exception as e:
                logger.error(f"Ошибка при установке частоты {freq_val}: {str(e)}")
                logger.warning("Используем автоматическое определение частоты")
                actual_freq = None
        
        # Готовим hyperparameters для выбранных моделей
        all_models_opt = "* (все)"
        chosen_models_val = task_params["models"]
        
        if not chosen_models_val or (len(chosen_models_val) == 1 and chosen_models_val[0] == all_models_opt):
            hyperparams = None
            logger.info("Будут использованы все доступные модели")
        else:
            no_star = [m for m in chosen_models_val if m != all_models_opt]
            hyperparams = {m: {} for m in no_star}
            logger.info(f"Выбраны следующие модели: {', '.join(no_star)}")
        
        # Подготавливаем метрику и квантили
        eval_key = task_params["metric"]
        q_levels = [0.5] if task_params["mean_only"] else None
        
        # Создаем директорию для сохранения модели
        model_id = task_params["model_id"]
        model_dir = os.path.join(settings.MODEL_DIR, model_id)
        os.makedirs(model_dir, exist_ok=True)
        
        # Проверяем параметры обучения
        prediction_length = task_params["prediction_length"]
        if prediction_length <= 0:
            logger.error(f"Некорректная длина прогноза: {prediction_length}")
            raise ValueError("Длина прогноза должна быть положительным числом")
        
        time_limit = task_params["time_limit"]
        if time_limit <= 0:
            logger.warning(f"Отрицательное или нулевое время обучения, установим по умолчанию: {settings.DEFAULT_TIME_LIMIT}")
            time_limit = settings.DEFAULT_TIME_LIMIT
        
        # Создаем предиктор
        try:
            predictor = TimeSeriesPredictor(
                target="target",
                prediction_length=prediction_length,
                eval_metric=eval_key,
                freq=actual_freq,
                quantile_levels=q_levels,
                path=model_dir,
                verbosity=2
            )
            logger.info(f"Создан TimeSeriesPredictor с параметрами: prediction_length={prediction_length}, eval_metric={eval_key}")
        except Exception as e:
            logger.error(f"Ошибка при создании TimeSeriesPredictor: {str(e)}")
            logger.error(traceback.format_exc())
            raise ValueError(f"Ошибка инициализации модели: {str(e)}")
        
        # Запускаем обучение
        start_time = time.time()
        
        try:
            # В AutoGluon 1.2 используем параметры кросс-валидации напрямую
            predictor.fit(
                train_data=ts_df,
                time_limit=time_limit,
                presets=task_params["presets"],
                hyperparameters=hyperparams,
                num_val_windows=1,
                val_step_size=prediction_length,
                refit_every_n_windows=1
            )
            
            elapsed_time = time.time() - start_time
            logger.info(f"Обучение завершено за {elapsed_time:.2f} секунд")
        except Exception as e:
            logger.error(f"Ошибка при обучении модели: {str(e)}")
            logger.error(traceback.format_exc())
            raise ValueError(f"Ошибка при обучении модели: {str(e)}")
        
        # Получаем результаты обучения
        summ = predictor.fit_summary()
        leaderboard = predictor.leaderboard(ts_df)
        
        # Расчет дополнительных метрик
        logger.info("Расчет дополнительных метрик оценки моделей")
        additional_metrics = calculate_additional_metrics(predictor, ts_df)
        
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
            "additional_metrics": additional_metrics,
            "weighted_ensemble_info": ensemble_info,
            "model_path": model_dir
        }
        
        logger.info(f"Модель успешно обучена, ID: {model_id}, лучшая модель: {best_model}, оценка: {best_score}")
        
        return result
    
    except Exception as e:
        logger.error(f"Критическая ошибка при обучении модели: {str(e)}")
        logger.error(traceback.format_exc())
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
        logger.error(traceback.format_exc())