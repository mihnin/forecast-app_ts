"""
Database models for storing dataset information
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text
from datetime import datetime
from app.core.database import Base

class Dataset(Base):
    """
    Model for storing dataset information
    """
    __tablename__ = "datasets"

    id = Column(String, primary_key=True)  # UUID
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Dataset properties
    rows_count = Column(Integer)
    columns_count = Column(Integer)
    frequency = Column(String)  # Detected time series frequency
    has_missing_values = Column(Integer, default=0)  # Boolean
    
    # Column information
    date_column = Column(String)  # Name of the datetime column
    target_column = Column(String)  # Name of the target column
    feature_columns = Column(Text)  # JSON string of feature column names
    categorical_columns = Column(Text)  # JSON string of categorical column names
    numeric_columns = Column(Text)  # JSON string of numeric column names
    
    # Statistics
    statistics = Column(JSON)  # JSON with basic statistics (min, max, mean, etc.)
    
    # Additional information
    additional_info = Column(JSON)  # Any additional dataset information

class DatasetPreprocessing(Base):
    """
    Model for storing dataset preprocessing information
    """
    __tablename__ = "dataset_preprocessing"

    id = Column(String, primary_key=True)  # UUID
    dataset_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Preprocessing parameters
    fill_method = Column(String)  # Method used for filling missing values
    scaling_method = Column(String)  # Method used for scaling
    encoding_method = Column(String)  # Method used for encoding categoricals
    
    # Preprocessing results
    missing_values_filled = Column(Integer)  # Number of filled values
    categorical_features_encoded = Column(Integer)  # Number of encoded features
    
    # Additional information
    preprocessing_info = Column(JSON)  # Additional preprocessing details