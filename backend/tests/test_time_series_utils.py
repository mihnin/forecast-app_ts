"""
Tests for time series preprocessing utilities
"""
import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from app.utils.time_series_utils import TimeSeriesPreprocessor

@pytest.fixture
def sample_data():
    # Создаем тестовые данные с пропусками и выбросами
    dates = pd.date_range(start='2023-01-01', end='2023-01-10', freq='D')
    values = [1.0, 2.0, np.nan, 4.0, 100.0, 6.0, np.nan, 8.0, 9.0, 10.0]
    
    df = pd.DataFrame({
        'date': dates,
        'value': values
    })
    return df

def test_detect_gaps(sample_data):
    preprocessor = TimeSeriesPreprocessor(sample_data, 'date', 'value')
    gaps = preprocessor.detect_gaps('D')
    
    assert gaps['total_missing'] == 2
    assert len(gaps['gaps']) == 2
    
    # Проверяем первый пропуск
    first_gap = gaps['gaps'][0]
    assert datetime.fromisoformat(first_gap['start']).day == 3
    assert first_gap['count'] == 1

def test_fill_missing_values_linear(sample_data):
    preprocessor = TimeSeriesPreprocessor(sample_data, 'date', 'value')
    filled_df, stats = preprocessor.fill_missing_values(method='linear')
    
    assert stats['filled_count'] == 2
    assert stats['method'] == 'linear'
    assert not filled_df['value'].isnull().any()
    
    # Проверяем линейную интерполяцию
    assert filled_df.loc[2, 'value'] == pytest.approx(3.0)  # Среднее между 2.0 и 4.0

def test_fill_missing_values_ffill(sample_data):
    preprocessor = TimeSeriesPreprocessor(sample_data, 'date', 'value')
    filled_df, stats = preprocessor.fill_missing_values(method='ffill')
    
    assert stats['filled_count'] == 2
    assert stats['method'] == 'ffill'
    assert not filled_df['value'].isnull().any()
    
    # Проверяем заполнение предыдущим значением
    assert filled_df.loc[2, 'value'] == 2.0

def test_detect_outliers(sample_data):
    preprocessor = TimeSeriesPreprocessor(sample_data, 'date', 'value')
    outliers = preprocessor.detect_outliers(threshold=2.0)
    
    assert outliers['total_outliers'] == 1
    assert len(outliers['outliers']) == 1
    
    # Проверяем обнаруженный выброс
    outlier = outliers['outliers'][0]
    assert outlier['value'] == 100.0

def test_interpolate_missing(sample_data):
    preprocessor = TimeSeriesPreprocessor(sample_data, 'date', 'value')
    interpolated_df = preprocessor.interpolate_missing(method='cubic')
    
    assert not interpolated_df['value'].isnull().any()
    assert isinstance(interpolated_df, pd.DataFrame)
    assert len(interpolated_df) == len(sample_data)

def test_empty_data():
    empty_df = pd.DataFrame(columns=['date', 'value'])
    preprocessor = TimeSeriesPreprocessor(empty_df, 'date', 'value')
    gaps = preprocessor.detect_gaps()
    
    assert gaps['total_missing'] == 0
    assert len(gaps['gaps']) == 0

def test_no_missing_values():
    dates = pd.date_range(start='2023-01-01', end='2023-01-05', freq='D')
    values = [1.0, 2.0, 3.0, 4.0, 5.0]
    df = pd.DataFrame({'date': dates, 'value': values})
    
    preprocessor = TimeSeriesPreprocessor(df, 'date', 'value')
    filled_df, stats = preprocessor.fill_missing_values()
    
    assert stats['filled_count'] == 0
    assert len(stats['gaps']) == 0

def test_all_missing_values():
    dates = pd.date_range(start='2023-01-01', end='2023-01-05', freq='D')
    values = [np.nan] * 5
    df = pd.DataFrame({'date': dates, 'value': values})
    
    preprocessor = TimeSeriesPreprocessor(df, 'date', 'value')
    gaps = preprocessor.detect_gaps()
    
    assert gaps['total_missing'] == 5
    assert len(gaps['gaps']) == 1
    assert gaps['gaps'][0]['count'] == 5