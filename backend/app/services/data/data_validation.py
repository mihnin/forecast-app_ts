import pandas as pd
import numpy as np
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

def validate_dataset(df: pd.DataFrame, dt_col: str, tgt_col: str, id_col: Optional[str] = None) -> Dict[str, Any]:
    """
    Проверяет датасет на корректность и возвращает словарь с результатами валидации
    
    Args:
        df: Исходный датафрейм
        dt_col: Название колонки с датами
        tgt_col: Название целевой колонки
        id_col: Название колонки с идентификаторами (опционально)
        
    Returns:
        Словарь с результатами валидации:
        - is_valid: Общий результат валидации
        - errors: Список ошибок
        - warnings: Список предупреждений
        - stats: Статистики по данным
    """
    result = {
        "is_valid": True,
        "errors": [],
        "warnings": [],
        "stats": {}
    }
    
    # Инициализируем outliers_count для безопасного использования в stats
    outliers_count = 0
    
    # Проверка наличия обязательных колонок
    required_cols = []
    if dt_col:
        required_cols.append(dt_col)
    if tgt_col:
        required_cols.append(tgt_col)
    if id_col:
        required_cols.append(id_col)
    
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        result["is_valid"] = False
        result["errors"].append(f"Отсутствуют обязательные колонки: {', '.join(missing_cols)}")
        return result
    
    # Проверка типа данных в колонке с датой
    if dt_col in df.columns:
        if not pd.api.types.is_datetime64_any_dtype(df[dt_col]):
            try:
                # Пытаемся преобразовать к datetime
                pd.to_datetime(df[dt_col], errors='raise')
            except Exception:
                result["is_valid"] = False
                result["errors"].append(f"Колонка {dt_col} содержит некорректные значения дат")
                return result
    
    # Проверка типа данных в колонке target
    if tgt_col in df.columns:
        if not pd.api.types.is_numeric_dtype(df[tgt_col]):
            result["is_valid"] = False
            result["errors"].append(f"Колонка {tgt_col} должна содержать числовые значения")
            return result
    
    # Проверка на пропущенные значения
    if dt_col in df.columns:
        missing_dt = df[dt_col].isna().sum()
        if missing_dt > 0:
            result["warnings"].append(f"Колонка {dt_col} содержит {missing_dt} пропущенных значений")
    
    if tgt_col in df.columns:
        missing_tgt = df[tgt_col].isna().sum()
        if missing_tgt > 0:
            result["warnings"].append(f"Колонка {tgt_col} содержит {missing_tgt} пропущенных значений ({missing_tgt/len(df)*100:.2f}%)")
    
    # Анализ аномалий в целевой переменной
    if tgt_col in df.columns:
        q1 = df[tgt_col].quantile(0.25)
        q3 = df[tgt_col].quantile(0.75)
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        outliers = df[(df[tgt_col] < lower_bound) | (df[tgt_col] > upper_bound)]
        outliers_count = len(outliers)
        
        if outliers_count > 0:
            result["warnings"].append(f"Обнаружено {outliers_count} выбросов в колонке {tgt_col} ({outliers_count/len(df)*100:.2f}%)")
    
    # Проверка временного ряда на непрерывность
    if dt_col in df.columns:
        if id_col and id_col in df.columns:
            # Для каждого ID проверяем непрерывность
            for id_value in df[id_col].unique():
                subset = df[df[id_col] == id_value].sort_values(dt_col)
                if len(subset) <= 1:
                    continue
                    
                if pd.api.types.is_datetime64_any_dtype(subset[dt_col]):
                    time_series = subset[dt_col]
                else:
                    time_series = pd.to_datetime(subset[dt_col])
                    
                # Определяем наиболее вероятную частоту
                try:
                    most_common_diff = pd.Series(np.diff(time_series)).value_counts().index[0]
                    expected_dates = pd.date_range(start=time_series.min(), 
                                                  end=time_series.max(), 
                                                  freq=pd.tseries.frequencies.to_offset(most_common_diff))
                    missing_dates = set(expected_dates) - set(time_series)
                    
                    if missing_dates:
                        result["warnings"].append(f"Для ID={id_value} обнаружены пропуски в датах. Отсутствует {len(missing_dates)} точек")
                except Exception as e:
                    result["warnings"].append(f"Для ID={id_value} не удалось определить частоту временного ряда: {e}")
        else:
            # Обрабатываем как единый временной ряд
            sorted_df = df.sort_values(dt_col)
            if pd.api.types.is_datetime64_any_dtype(sorted_df[dt_col]):
                time_series = sorted_df[dt_col]
            else:
                time_series = pd.to_datetime(sorted_df[dt_col])
                
            try:
                most_common_diff = pd.Series(np.diff(time_series)).value_counts().index[0]
                expected_dates = pd.date_range(start=time_series.min(), 
                                              end=time_series.max(), 
                                              freq=pd.tseries.frequencies.to_offset(most_common_diff))
                missing_dates = set(expected_dates) - set(time_series)
                
                if missing_dates:
                    result["warnings"].append(f"Обнаружены пропуски в датах. Отсутствует {len(missing_dates)} точек")
            except Exception as e:
                result["warnings"].append(f"Не удалось определить частоту временного ряда: {e}")
    
    # Рассчитываем и сохраняем статистики
    result["stats"] = {
        "rows_count": len(df),
        "target_min": df[tgt_col].min() if tgt_col in df.columns else None,
        "target_max": df[tgt_col].max() if tgt_col in df.columns else None,
        "target_mean": df[tgt_col].mean() if tgt_col in df.columns else None,
        "target_median": df[tgt_col].median() if tgt_col in df.columns else None,
        "target_std": df[tgt_col].std() if tgt_col in df.columns else None,
        "missing_values": {
            "dt_col": df[dt_col].isna().sum() if dt_col in df.columns else 0,
            "tgt_col": df[tgt_col].isna().sum() if tgt_col in df.columns else 0
        },
        "outliers_count": outliers_count
    }
    
    if id_col and id_col in df.columns:
        result["stats"]["unique_ids"] = df[id_col].nunique()
    
    return result