"""
Service for managing dataset operations using in-memory storage
"""
from sqlalchemy.orm import Session
import json
import pandas as pd
from typing import Dict, Any, List, Optional
from app.models.dataset import Dataset, DatasetPreprocessing
from app.services.data.data_processing import process_uploaded_file, detect_frequency
import uuid
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# In-memory storage
datasets = {}
preprocessings = {}

class DataService:
    def __init__(self, db: Session):
        # DB parameter kept for compatibility, but won't be used
        self.db = db

    def create_dataset(self, file_path: str, filename: str, df: pd.DataFrame) -> Dataset:
        """
        Create new dataset record in memory storage
        """
        try:
            # Generate unique ID
            dataset_id = str(uuid.uuid4())
            
            # Detect date columns
            date_cols = [col for col in df.columns if pd.api.types.is_datetime64_any_dtype(df[col]) 
                        or (pd.to_datetime(df[col], errors='coerce').notna().sum() > 0.8 * len(df))]
            
            # Detect column types
            numeric_cols = [col for col in df.columns if pd.api.types.is_numeric_dtype(df[col])]
            categorical_cols = [col for col in df.columns if pd.api.types.is_categorical_dtype(df[col])
                              or pd.api.types.is_object_dtype(df[col])]
            
            # Calculate basic statistics
            stats = {}
            for col in numeric_cols:
                stats[col] = {
                    "min": float(df[col].min()),
                    "max": float(df[col].max()),
                    "mean": float(df[col].mean()),
                    "std": float(df[col].std()),
                    "missing": int(df[col].isna().sum())
                }
            
            # Create dataset record
            now = datetime.utcnow()
            dataset = Dataset(
                id=dataset_id,
                filename=filename,
                file_path=file_path,
                rows_count=len(df),
                columns_count=len(df.columns),
                frequency=detect_frequency(df, date_cols[0]) if date_cols else None,
                has_missing_values=int(df.isna().any().any()),
                date_column=date_cols[0] if date_cols else None,
                target_column=None,  # Will be set later by user
                feature_columns=json.dumps(df.columns.tolist()),
                categorical_columns=json.dumps(categorical_cols),
                numeric_columns=json.dumps(numeric_cols),
                statistics=stats,
                additional_info={},
                created_at=now,
                updated_at=now
            )
            
            # Store in memory instead of database
            datasets[dataset_id] = dataset
            
            logger.info(f"Created new dataset record in memory: {dataset_id}")
            return dataset
            
        except Exception as e:
            logger.error(f"Error creating dataset record: {str(e)}")
            raise

    def get_dataset(self, dataset_id: str) -> Optional[Dataset]:
        """
        Get dataset by ID from memory
        """
        return datasets.get(dataset_id)

    def update_dataset(self, dataset_id: str, update_data: Dict[str, Any]) -> Optional[Dataset]:
        """
        Update dataset information in memory
        """
        try:
            dataset = self.get_dataset(dataset_id)
            if not dataset:
                return None
            
            for key, value in update_data.items():
                if hasattr(dataset, key):
                    setattr(dataset, key, value)
            
            dataset.updated_at = datetime.utcnow()
            # Update in memory
            datasets[dataset_id] = dataset
            return dataset
            
        except Exception as e:
            logger.error(f"Error updating dataset {dataset_id}: {str(e)}")
            raise

    def delete_dataset(self, dataset_id: str) -> bool:
        """
        Delete dataset and its related records from memory
        """
        try:
            if dataset_id not in datasets:
                return False
            
            # Delete related preprocessing records
            to_delete = []
            for prep_id, prep in preprocessings.items():
                if prep.dataset_id == dataset_id:
                    to_delete.append(prep_id)
                    
            for prep_id in to_delete:
                del preprocessings[prep_id]
            
            # Get file path before deletion
            file_path = datasets[dataset_id].file_path
            
            # Delete dataset record from memory
            del datasets[dataset_id]
            
            # Delete actual file
            import os
            if os.path.exists(file_path):
                os.remove(file_path)
            
            return True
            
        except Exception as e:
            logger.error(f"Error deleting dataset {dataset_id}: {str(e)}")
            raise

    def create_preprocessing(self, dataset_id: str, params: Dict[str, Any]) -> DatasetPreprocessing:
        """
        Create preprocessing record for dataset in memory
        """
        try:
            preprocessing_id = str(uuid.uuid4())
            preprocessing = DatasetPreprocessing(
                id=preprocessing_id,
                dataset_id=dataset_id,
                fill_method=params.get("fill_method"),
                scaling_method=params.get("scaling_method"),
                encoding_method=params.get("encoding_method"),
                missing_values_filled=params.get("missing_values_filled", 0),
                categorical_features_encoded=params.get("categorical_features_encoded", 0),
                preprocessing_info=params.get("preprocessing_info", {}),
                created_at=datetime.utcnow()
            )
            
            # Store in memory
            preprocessings[preprocessing_id] = preprocessing
            
            return preprocessing
            
        except Exception as e:
            logger.error(f"Error creating preprocessing record for dataset {dataset_id}: {str(e)}")
            raise

    def get_all_datasets(self) -> List[Dataset]:
        """
        Get all datasets from memory
        """
        return sorted(datasets.values(), key=lambda x: x.created_at, reverse=True)

    def get_dataset_preprocessing(self, dataset_id: str) -> List[DatasetPreprocessing]:
        """
        Get all preprocessing records for dataset from memory
        """
        result = [p for p in preprocessings.values() if p.dataset_id == dataset_id]
        return sorted(result, key=lambda x: x.created_at, reverse=True)