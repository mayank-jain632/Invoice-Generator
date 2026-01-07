from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from .settings import settings

DATABASE_URL = settings.DATABASE_URL or os.getenv("DATABASE_URL", "postgresql+psycopg2://localhost/invoice_automation")

# Vercel/Supabase uses postgres:// but SQLAlchemy needs postgresql+psycopg2://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
