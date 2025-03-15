"""
Database configuration and connection management
"""
from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from app.core.config import settings

# Database URL construction
if settings.ENVIRONMENT == "test":
    SQLALCHEMY_DATABASE_URL = "postgresql://postgres_admin:postgres_admin@172.27.57.214:5433/test_app"
else:  # development and production
    SQLALCHEMY_DATABASE_URL = "postgresql://postgres_admin:postgres_admin@172.27.57.214:5433/test_app"

# Create engine without SQLite-specific arguments
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for database models
Base = declarative_base()

# Metadata object for database schema operations
metadata = MetaData()

def get_db():
    """
    Get database session
    
    Yields:
        Session: Database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()