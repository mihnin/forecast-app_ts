"""
In-memory models for storing dataset information
"""
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field

@dataclass
class Dataset:
    """
    Model for storing dataset information in memory
    """
    id: str
    filename: str
    file_path: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    # Dataset properties
    rows_count: int = 0
    columns_count: int = 0
    frequency: Optional[str] = None  # Detected time series frequency
    has_missing_values: int = 0  # Boolean
    
    # Column information
    date_column: Optional[str] = None  # Name of the datetime column
    target_column: Optional[str] = None  # Name of the target column
    feature_columns: str = "[]"  # JSON string of feature column names
    categorical_columns: str = "[]"  # JSON string of categorical column names
    numeric_columns: str = "[]"  # JSON string of numeric column names
    
    # Statistics
    statistics: Dict[str, Any] = field(default_factory=dict)  # Dict with basic statistics (min, max, mean, etc.)
    
    # Additional information
    additional_info: Dict[str, Any] = field(default_factory=dict)  # Any additional dataset information

@dataclass
class DatasetPreprocessing:
    """
    Model for storing dataset preprocessing information in memory
    """
    id: str
    dataset_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    # Preprocessing parameters
    fill_method: Optional[str] = None  # Method used for filling missing values
    scaling_method: Optional[str] = None  # Method used for scaling
    encoding_method: Optional[str] = None  # Method used for encoding categoricals
    
    # Preprocessing results
    missing_values_filled: int = 0  # Number of filled values
    categorical_features_encoded: int = 0  # Number of encoded features
    
    # Additional information
    preprocessing_info: Dict[str, Any] = field(default_factory=dict)  # Additional preprocessing details

# Global in-memory storage
datasets = {}
preprocessings = {}