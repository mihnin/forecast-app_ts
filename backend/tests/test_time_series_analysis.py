import pytest
import pandas as pd
import numpy as np
from app.services.analysis.time_series_analysis import decompose_time_series

def test_decompose_time_series():
    # Создаем тестовые данные
    dates = pd.date_range(start='2023-01-01', periods=100, freq='D')
    # Создаем временной ряд с трендом и сезонностью
    trend = np.linspace(0, 10, 100)
    seasonal = 5 * np.sin(np.linspace(0, 8*np.pi, 100))
    random = np.random.normal(0, 1, 100)
    values = trend + seasonal + random
    
    df = pd.DataFrame({
        'date': dates,
        'value': values
    })
    
    # Выполняем декомпозицию
    result = decompose_time_series(df, 'date', 'value')
    
    # Проверяем наличие всех компонентов
    assert 'trend' in result
    assert 'seasonal' in result
    assert 'residual' in result
    
    # Проверяем, что размерности компонентов совпадают с исходными данными
    assert len(result['trend']) == len(df)
    assert len(result['seasonal']) == len(df)
    assert len(result['residual']) == len(df)
    
    # Проверяем, что сумма компонентов приблизительно равна исходному ряду
    reconstructed = result['trend'] + result['seasonal'] + result['residual']
    np.testing.assert_array_almost_equal(reconstructed, values, decimal=10)

def test_decompose_time_series_invalid_input():
    # Тест с некорректными входными данными
    with pytest.raises(ValueError):
        decompose_time_series(None, 'date', 'value')
    
    # Тест с пустым DataFrame
    empty_df = pd.DataFrame()
    with pytest.raises(ValueError):
        decompose_time_series(empty_df, 'date', 'value')
    
    # Тест с отсутствующими колонками
    invalid_df = pd.DataFrame({'wrong_column': [1, 2, 3]})
    with pytest.raises(ValueError):
        decompose_time_series(invalid_df, 'date', 'value')