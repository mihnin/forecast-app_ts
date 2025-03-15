"""
Utilities for time series data processing
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, Tuple
from scipy import interpolate
import logging

logger = logging.getLogger(__name__)

class TimeSeriesPreprocessor:
    def __init__(self, df: pd.DataFrame, date_column: str, value_column: str):
        """
        Initialize preprocessor
        
        Args:
            df: DataFrame with time series data
            date_column: Name of date column
            value_column: Name of value column
        """
        self.df = df.copy()
        self.date_column = date_column
        self.value_column = value_column
        
        # Конвертируем даты и сортируем
        self.df[date_column] = pd.to_datetime(self.df[date_column])
        self.df = self.df.sort_values(date_column)

    def detect_gaps(self, freq: Optional[str] = None) -> Dict[str, Any]:
        """
        Detect gaps in time series
        
        Args:
            freq: Expected frequency (e.g., 'D' for daily, 'H' for hourly)
                 If None, will try to infer
        
        Returns:
            Dictionary with gap information
        """
        if not freq:
            freq = pd.infer_freq(self.df[self.date_column])
        
        # Создаем полный индекс дат
        full_idx = pd.date_range(
            start=self.df[self.date_column].min(),
            end=self.df[self.date_column].max(),
            freq=freq
        )
        
        # Находим пропущенные даты
        missing_dates = full_idx.difference(self.df[self.date_column])
        
        # Анализируем пропуски
        gaps = []
        if len(missing_dates) > 0:
            current_gap = {"start": missing_dates[0], "count": 1}
            
            for i in range(1, len(missing_dates)):
                if missing_dates[i] - missing_dates[i-1] == pd.Timedelta(freq):
                    current_gap["count"] += 1
                else:
                    current_gap["end"] = missing_dates[i-1]
                    gaps.append(current_gap)
                    current_gap = {"start": missing_dates[i], "count": 1}
            
            # Добавляем последний gap
            current_gap["end"] = missing_dates[-1]
            gaps.append(current_gap)
        
        return {
            "total_missing": len(missing_dates),
            "gaps": [{
                "start": gap["start"].isoformat(),
                "end": gap["end"].isoformat(),
                "count": gap["count"]
            } for gap in gaps],
            "missing_dates": [d.isoformat() for d in missing_dates]
        }

    def fill_missing_values(self, method: str = 'linear') -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Fill missing values in time series
        
        Args:
            method: Filling method ('linear', 'ffill', 'bfill', 'cubic', 'mean')
            
        Returns:
            Tuple of (filled DataFrame, statistics about filling)
        """
        original_count = len(self.df)
        
        # Получаем информацию о пропусках
        gaps_info = self.detect_gaps()
        
        if gaps_info["total_missing"] == 0:
            return self.df, {
                "filled_count": 0,
                "method": method,
                "gaps": []
            }
        
        # Создаем новый индекс с полными датами
        freq = pd.infer_freq(self.df[self.date_column])
        full_idx = pd.date_range(
            start=self.df[self.date_column].min(),
            end=self.df[self.date_column].max(),
            freq=freq
        )
        
        # Создаем DataFrame с полным индексом
        filled_df = self.df.set_index(self.date_column).reindex(full_idx)
        
        # Заполняем пропуски в зависимости от метода
        if method == 'linear':
            filled_df[self.value_column] = filled_df[self.value_column].interpolate(method='linear')
        elif method == 'cubic':
            filled_df[self.value_column] = filled_df[self.value_column].interpolate(method='cubic')
        elif method == 'ffill':
            filled_df[self.value_column] = filled_df[self.value_column].fillna(method='ffill')
        elif method == 'bfill':
            filled_df[self.value_column] = filled_df[self.value_column].fillna(method='bfill')
        elif method == 'mean':
            filled_df[self.value_column] = filled_df[self.value_column].fillna(
                filled_df[self.value_column].mean()
            )
        
        # Сбрасываем индекс и восстанавливаем колонку с датами
        filled_df = filled_df.reset_index()
        filled_df = filled_df.rename(columns={'index': self.date_column})
        
        return filled_df, {
            "filled_count": gaps_info["total_missing"],
            "method": method,
            "gaps": gaps_info["gaps"]
        }

    def detect_outliers(self, threshold: float = 3.0) -> Dict[str, Any]:
        """
        Detect outliers using Z-score method
        
        Args:
            threshold: Z-score threshold for outlier detection
            
        Returns:
            Dictionary with outlier information
        """
        z_scores = np.abs((self.df[self.value_column] - self.df[self.value_column].mean()) 
                         / self.df[self.value_column].std())
        
        outliers_idx = z_scores > threshold
        outliers_df = self.df[outliers_idx]
        
        return {
            "total_outliers": len(outliers_df),
            "outliers": [{
                "date": row[self.date_column].isoformat(),
                "value": float(row[self.value_column]),
                "z_score": float(z_scores[idx])
            } for idx, row in outliers_df.iterrows()],
            "threshold": threshold
        }

    def interpolate_missing(self, method: str = 'cubic') -> pd.DataFrame:
        """
        Interpolate missing values using advanced methods
        
        Args:
            method: Interpolation method ('cubic', 'akima', 'pchip')
            
        Returns:
            DataFrame with interpolated values
        """
        # Получаем непропущенные значения
        valid_data = self.df.dropna(subset=[self.value_column])
        
        if len(valid_data) < 4:  # Нужно минимум 4 точки для кубической интерполяции
            return self.df
        
        # Создаем интерполятор
        if method == 'cubic':
            f = interpolate.interp1d(
                valid_data.index.values,
                valid_data[self.value_column].values,
                kind='cubic',
                bounds_error=False,
                fill_value='extrapolate'
            )
        elif method == 'akima':
            f = interpolate.Akima1DInterpolator(
                valid_data.index.values,
                valid_data[self.value_column].values
            )
        elif method == 'pchip':
            f = interpolate.PchipInterpolator(
                valid_data.index.values,
                valid_data[self.value_column].values
            )
        
        # Применяем интерполяцию
        interpolated_values = f(self.df.index.values)
        result_df = self.df.copy()
        result_df[self.value_column] = interpolated_values
        
        return result_df