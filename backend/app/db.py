from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
import os
from .settings import settings

DATABASE_URL = settings.DATABASE_URL or os.getenv("DATABASE_URL", "postgresql+psycopg2://localhost/invoice_automation")

# Vercel/Supabase uses postgres:// but SQLAlchemy needs postgresql+psycopg2://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)

# Use NullPool on Vercel (serverless, stateless functions) to avoid connection pool exhaustion
# This disables pooling and creates a new connection for each request, then closes it
if os.getenv("VERCEL"):
    engine = create_engine(
        DATABASE_URL, 
        poolclass=NullPool,
        connect_args={
            "connect_timeout": 10,
            "options": "-c statement_timeout=30000"
        }
    )
else:
    engine = create_engine(DATABASE_URL)
    
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
