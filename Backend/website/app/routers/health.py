"""
Health check routes
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db

router = APIRouter(tags=["health"])


def check_database_connection(db: Session):
    """Check if database connection is working"""
    try:
        # Test query using SQLAlchemy
        result = db.execute(text("SELECT version(), current_database()"))
        version, db_name = result.fetchone()
        
        return {
            "connected": True,
            "database": db_name,
            "version": version,
            "message": "Database connection successful"
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e),
            "message": "Cannot connect to database. Check if PostgreSQL is running and DATABASE_URL is correct."
        }


@router.get("/")
async def root():
    """Welcome message"""
    return {"message": "Welcome to FastAPI Backend"}


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@router.get("/health/db")
async def health_check_db(db: Session = Depends(get_db)):
    """Check database connection status"""
    result = check_database_connection(db)
    if not result["connected"]:
        raise HTTPException(status_code=503, detail=result)
    return result
