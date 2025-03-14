import pandas as pd
import numpy as np
import logging
import holidays
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)

def add_russian_holiday_feature(df: pd.DataFrame, date_col="timestamp", holiday_col="russian_holiday") -> pd.DataFrame:
    """
    Добавляет колонку с индикатором праздников РФ
    
    Args:
        df: Исходный датафрейм
        date_col: Название столбца с датами
        holiday_col: Название столбца для индикатора праздников
        
    Returns:
        Датафрейм с добавленным признаком праздников
    """
    if date_col not in df.columns:
        logger.warning("Колонка даты не найдена, не можем добавить признак праздника")
        return df
    
    # Создаем копию датафрейма
    result_df = df.copy()
    
    if not pd.api.types.is_datetime64_any_dtype(result_df[date_col]):
        result_df[date_col] = pd.to_datetime(result_df[date_col], errors="coerce")
    
    min_year = result_df[date_col].dt.year.min()
    max_year = result_df[date_col].dt.year.max()
    ru_holidays = holidays.country_holidays(country="RU", years=range(min_year, max_year + 1))
    
    def is_holiday(dt):
        return 1.0 if dt.date() in ru_holidays else 0.0
    
    result_df[holiday_col] = result_df[date_col].apply(is_holiday).astype(float)
    
    return result_df


def fill_missing_values(df: pd.DataFrame, method: str = "None", group_cols=None) -> pd.DataFrame:
    """
    Заполняет пропуски для числовых столбцов
    
    Args:
        df: Исходный датафрейм
        method: Метод заполнения пропусков
        group_cols: Колонки для группировки при заполнении
        
    Returns:
        Датафрейм с заполненными пропусками
    """
    numeric_cols = df.select_dtypes(include=["float", "int"]).columns
    
    if not group_cols:
        group_cols = []
    
    if len(group_cols) == 1:
        group_cols = (group_cols[0],)
    
    if method == "None":
        return df
    elif method == "Constant=0":
        result_df = df.copy()
        result_df[numeric_cols] = result_df[numeric_cols].fillna(0)
        return result_df
    elif method == "Forward fill":
        result_df = df.copy()
        if group_cols:
            result_df = result_df.sort_values(by=group_cols, na_position="last")
            result_df[numeric_cols] = result_df.groupby(group_cols)[numeric_cols].transform(lambda g: g.ffill().bfill())
        else:
            result_df[numeric_cols] = result_df[numeric_cols].ffill().bfill()
        return result_df
    elif method == "Group mean":
        result_df = df.copy()
        if group_cols:
            result_df = result_df.sort_values(by=group_cols, na_position="last")
            for c in numeric_cols:
                result_df[c] = result_df.groupby(group_cols)[c].transform(lambda x: x.fillna(x.mean()))
        else:
            for c in numeric_cols:
                result_df[c] = result_df[c].fillna(df[c].mean())
        return result_df
    elif method == "Interpolate":
        result_df = df.copy()
        if group_cols:
            result_df = result_df.sort_values(by=group_cols, na_position="last")
            for group, group_df in result_df.groupby(group_cols):
                result_df.loc[group_df.index, numeric_cols] = group_df[numeric_cols].interpolate(method='linear')
        else:
            result_df[numeric_cols] = result_df[numeric_cols].interpolate(method='linear')
        return result_df
    elif method == "KNN imputer":
        try:
            from sklearn.impute import KNNImputer
            imputer = KNNImputer(n_neighbors=5)
            
            result_df = df.copy()
            if group_cols:
                result_df = result_df.sort_values(by=group_cols, na_position="last")
                for group, group_df in result_df.groupby(group_cols):
                    if group_df[numeric_cols].isna().values.any():
                        # Если есть пропуски в группе
                        imputed_values = imputer.fit_transform(group_df[numeric_cols])
                        result_df.loc[group_df.index, numeric_cols] = imputed_values
            else:
                if result_df[numeric_cols].isna().values.any():
                    # Если есть пропуски
                    imputed_values = imputer.fit_transform(result_df[numeric_cols])
                    result_df[numeric_cols] = imputed_values
            
            return result_df
        except Exception as e:
            logger.error(f"Ошибка при использовании KNN imputer: {e}")
            logger.warning("Используем Forward fill вместо KNN imputer")
            return fill_missing_values(df, method="Forward fill", group_cols=group_cols)
    
    return df


def add_time_features(df: pd.DataFrame, date_col: str, features: List[str] = None) -> pd.DataFrame:
    """
    Добавляет временные признаки к датафрейму
    
    Args:
        df: Исходный датафрейм
        date_col: Название колонки с датами
        features: Список временных признаков для добавления
        
    Returns:
        Датафрейм с добавленными временными признаками
    """
    if date_col not in df.columns:
        logger.warning(f"Колонка {date_col} не найдена в датафрейме")
        return df
    
    # Преобразуем к формату datetime, если необходимо
    if not pd.api.types.is_datetime64_any_dtype(df[date_col]):
        df_result = df.copy()
        df_result[date_col] = pd.to_datetime(df_result[date_col], errors="coerce")
    else:
        df_result = df.copy()
    
    # Если не указаны конкретные признаки, добавляем все
    if features is None:
        features = ['year', 'month', 'day', 'dayofweek', 'quarter', 'is_weekend',
                   'is_month_start', 'is_month_end', 'sin_month', 'cos_month']
    
    # Добавляем базовые признаки
    if 'year' in features:
        df_result['year'] = df_result[date_col].dt.year
    
    if 'month' in features:
        df_result['month'] = df_result[date_col].dt.month
    
    if 'day' in features:
        df_result['day'] = df_result[date_col].dt.day
    
    if 'dayofweek' in features:
        df_result['dayofweek'] = df_result[date_col].dt.dayofweek
    
    if 'quarter' in features:
        df_result['quarter'] = df_result[date_col].dt.quarter
    
    if 'hour' in features:
        df_result['hour'] = df_result[date_col].dt.hour
    
    if 'minute' in features:
        df_result['minute'] = df_result[date_col].dt.minute
    
    # Добавляем флаги
    if 'is_weekend' in features:
        df_result['is_weekend'] = (df_result[date_col].dt.dayofweek >= 5).astype(int)
    
    if 'is_month_start' in features:
        df_result['is_month_start'] = df_result[date_col].dt.is_month_start.astype(int)
    
    if 'is_month_end' in features:
        df_result['is_month_end'] = df_result[date_col].dt.is_month_end.astype(int)
    
    # Добавляем циклические признаки
    if 'sin_month' in features:
        df_result['sin_month'] = np.sin(2 * np.pi * df_result[date_col].dt.month / 12)
    
    if 'cos_month' in features:
        df_result['cos_month'] = np.cos(2 * np.pi * df_result[date_col].dt.month / 12)
    
    if 'sin_day' in features:
        df_result['sin_day'] = np.sin(2 * np.pi * df_result[date_col].dt.day / 31)
    
    if 'cos_day' in features:
        df_result['cos_day'] = np.cos(2 * np.pi * df_result[date_col].dt.day / 31)
    
    if 'sin_dayofweek' in features:
        df_result['sin_dayofweek'] = np.sin(2 * np.pi * df_result[date_col].dt.dayofweek / 7)
    
    if 'cos_dayofweek' in features:
        df_result['cos_dayofweek'] = np.cos(2 * np.pi * df_result[date_col].dt.dayofweek / 7)
    
    return df_result


def generate_lag_features(df: pd.DataFrame, target_col: str, date_col: str,
                        id_col: Optional[str] = None,
                        lag_periods: List[int] = [1, 7, 14, 28]) -> pd.DataFrame:
    """
    Создает признаки запаздывания (лаги) для временного ряда
    
    Args:
        df: Исходный датафрейм
        target_col: Название целевой колонки
        date_col: Название колонки с датами
        id_col: Название колонки с идентификаторами
        lag_periods: Список периодов запаздывания
        
    Returns:
        Датафрейм с добавленными лаговыми признаками
    """
    # Преобразуем к формату datetime, если необходимо
    if not pd.api.types.is_datetime64_any_dtype(df[date_col]):
        df_result = df.copy()
        df_result[date_col] = pd.to_datetime(df_result[date_col], errors="coerce")
    else:
        df_result = df.copy()
    
    # Сортируем по дате
    if id_col and id_col in df.columns:
        df_result = df_result.sort_values([id_col, date_col])
    else:
        df_result = df_result.sort_values(date_col)
    
    # Создаем лаговые признаки
    for lag in lag_periods:
        lag_col_name = f'{target_col}_lag_{lag}'
        
        if id_col and id_col in df.columns:
            # Для каждого ID создаем отдельный лаг
            df_result[lag_col_name] = df_result.groupby(id_col)[target_col].shift(lag)
        else:
            # Создаем лаг для всего ряда
            df_result[lag_col_name] = df_result[target_col].shift(lag)
    
    return df_result


def generate_rolling_features(df: pd.DataFrame, target_col: str, date_col: str,
                           id_col: Optional[str] = None,
                           windows: List[int] = [7, 14, 30],
                           functions: List[str] = ['mean', 'std', 'min', 'max']) -> pd.DataFrame:
    """
    Создает скользящие (rolling) признаки для временного ряда
    
    Args:
        df: Исходный датафрейм
        target_col: Название целевой колонки
        date_col: Название колонки с датами
        id_col: Название колонки с идентификаторами
        windows: Список размеров окон для скользящих признаков
        functions: Список функций для скользящих признаков
        
    Returns:
        Датафрейм с добавленными скользящими признаками
    """
    # Преобразуем к формату datetime, если необходимо
    if not pd.api.types.is_datetime64_any_dtype(df[date_col]):
        df_result = df.copy()
        df_result[date_col] = pd.to_datetime(df_result[date_col], errors="coerce")
    else:
        df_result = df.copy()
    
    # Сортируем по дате
    if id_col and id_col in df.columns:
        df_result = df_result.sort_values([id_col, date_col])
    else:
        df_result = df_result.sort_values(date_col)
    
    # Создаем скользящие признаки
    for window in windows:
        for func in functions:
            feat_name = f'{target_col}_rolling_{window}_{func}'
            
            if id_col and id_col in df.columns:
                # Для каждого ID создаем отдельные скользящие признаки
                if func == 'mean':
                    df_result[feat_name] = df_result.groupby(id_col)[target_col].transform(
                        lambda x: x.rolling(window=window, min_periods=1).mean()
                    )
                elif func == 'std':
                    df_result[feat_name] = df_result.groupby(id_col)[target_col].transform(
                        lambda x: x.rolling(window=window, min_periods=1).std()
                    )
                elif func == 'min':
                    df_result[feat_name] = df_result.groupby(id_col)[target_col].transform(
                        lambda x: x.rolling(window=window, min_periods=1).min()
                    )
                elif func == 'max':
                    df_result[feat_name] = df_result.groupby(id_col)[target_col].transform(
                        lambda x: x.rolling(window=window, min_periods=1).max()
                    )
            else:
                # Создаем скользящие признаки для всего ряда
                if func == 'mean':
                    df_result[feat_name] = df_result[target_col].rolling(window=window, min_periods=1).mean()
                elif func == 'std':
                    df_result[feat_name] = df_result[target_col].rolling(window=window, min_periods=1).std()
                elif func == 'min':
                    df_result[feat_name] = df_result[target_col].rolling(window=window, min_periods=1).min()
                elif func == 'max':
                    df_result[feat_name] = df_result[target_col].rolling(window=window, min_periods=1).max()
    
    return df_result