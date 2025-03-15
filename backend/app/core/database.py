"""
Database configuration and connection management
"""
from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from app.core.config import settings

# Create database directory if not exists
os.makedirs("db", exist_ok=True)

# Database URL based on environment
if settings.ENVIRONMENT == "test":
    SQLALCHEMY_DATABASE_URL = "sqlite:///./db/test.db"
elif settings.ENVIRONMENT == "production":
    SQLALCHEMY_DATABASE_URL = "sqlite:///./db/prod.db"
else:  # development
    SQLALCHEMY_DATABASE_URL = "sqlite:///./db/dev.db"

# Create engine with appropriate settings for SQLite
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}  # Needed for SQLite
)

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