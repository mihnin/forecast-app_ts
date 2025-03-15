"""
Integration tests for preprocessing endpoints
"""
import pytest
from fastapi.testclient import TestClient
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
from app.main import app
from app.core.config import settings

client = TestClient(app)

@pytest.fixture
def test_dataset(tmp_path):
    # Создаем тестовый датасет
    dates = pd.date_range(start='2023-01-01', end='2023-01-10', freq='D')
    values = [1.0, 2.0, np.nan, 4.0, 100.0, 6.0, np.nan, 8.0, 9.0, 10.0]
    
    df = pd.DataFrame({
        'date': dates,
        'value': values
    })
    
    # Сохраняем в временную директорию
    file_path = tmp_path / "test_data.csv"
    df.to_csv(file_path, index=False)
    
    # Загружаем датасет через API
    with open(file_path, "rb") as f:
        response = client.post(
            "/api/v1/data/upload",
            files={"file": ("test_data.csv", f, "text/csv")}
        )
    
    assert response.status_code == 200
    return response.json()["dataset_id"]

def test_detect_gaps(test_dataset):
    response = client.get(
        f"/api/v1/preprocessing/gaps/{test_dataset}",
        params={
            "date_column": "date",
            "value_column": "value"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["total_missing"] == 2
    assert len(data["gaps"]) == 2
    assert all(isinstance(gap["count"], int) for gap in data["gaps"])

def test_detect_gaps_invalid_column(test_dataset):
    response = client.get(
        f"/api/v1/preprocessing/gaps/{test_dataset}",
        params={
            "date_column": "nonexistent",
            "value_column": "value"
        }
    )
    
    assert response.status_code == 400

def test_fill_missing_values(test_dataset):
    response = client.post(
        f"/api/v1/preprocessing/fill-missing/{test_dataset}",
        params={
            "date_column": "date",
            "value_column": "value",
            "method": "linear"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["success"] is True
    assert "dataset_id" in data
    assert isinstance(data["stats"], dict)
    assert data["stats"]["method"] == "linear"

def test_fill_missing_values_invalid_method(test_dataset):
    response = client.post(
        f"/api/v1/preprocessing/fill-missing/{test_dataset}",
        params={
            "date_column": "date",
            "value_column": "value",
            "method": "invalid_method"
        }
    )
    
    assert response.status_code == 400

def test_detect_outliers(test_dataset):
    response = client.get(
        f"/api/v1/preprocessing/outliers/{test_dataset}",
        params={
            "date_column": "date",
            "value_column": "value",
            "threshold": 2.0
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    
    assert "total_outliers" in data
    assert isinstance(data["outliers"], list)
    assert data["threshold"] == 2.0

def test_detect_outliers_invalid_threshold(test_dataset):
    response = client.get(
        f"/api/v1/preprocessing/outliers/{test_dataset}",
        params={
            "date_column": "date",
            "value_column": "value",
            "threshold": -1.0
        }
    )
    
    assert response.status_code == 400

def test_nonexistent_dataset():
    response = client.get(
        "/api/v1/preprocessing/gaps/nonexistent-id",
        params={
            "date_column": "date",
            "value_column": "value"
        }
    )
    
    assert response.status_code == 404