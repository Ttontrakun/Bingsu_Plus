"""
FastAPI application main file
"""
import logging
import time
import re
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from dotenv import load_dotenv
import os

# Import database
from app.database import engine, Base

# Import routers
from app.routers import health, users, chats, chat_messages, auth, logs, credential

# Load environment variables
load_dotenv()

# Create tables (with error handling)
try:
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created/verified successfully")
except Exception as e:
    print(f"⚠️  Warning: Could not create database tables: {e}")
    print("   Make sure PostgreSQL is running and DATABASE_URL is correct")

# Initialize FastAPI app
app = FastAPI(
    title="Backend API",
    version="1.0.0",
    description="FastAPI Backend with PostgreSQL"
)

# Setup logging
# Import logs router first to setup logging handlers (this sets up stream handler)
# Then get logger
app_logger = logging.getLogger("app")
# Also use root logger to ensure all logs are captured
root_logger = logging.getLogger()

# Helper function to check if origin is allowed (localhost, 127.0.0.1, or local network IP)
def is_allowed_origin(origin: str) -> bool:
    """Check if origin is allowed (localhost, 127.0.0.1, or local network IP)"""
    if not origin:
        return False
    
    # Check exact matches
    allowed_exact = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]
    if origin in allowed_exact:
        return True
    
    # Check local network IP addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    local_network_pattern = r"^http://(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+):(3000|3001|8000)$"
    if re.match(local_network_pattern, origin):
        return True
    
    return False

# CORS middleware - MUST be added before other middleware
# Order matters: CORS should be first to handle preflight requests
# Allow localhost, 127.0.0.1, and local network IP addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=r"http://(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+):(3000|3001|8000)",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# GZip compression middleware - reduces response size for better performance
# Can be disabled by setting ENABLE_GZIP=false in .env
# Automatically disabled in development to avoid warnings
# minimum_size: Only compress responses larger than this (in bytes)
# Higher value reduces compression overhead for small responses and prevents warnings
# Set to 20000 bytes to avoid GZip warnings on small responses and connection close issues
# Note: These warnings are harmless and occur when connections close before compression completes
env_mode = os.getenv("ENV", "development").lower()
enable_gzip = os.getenv("ENABLE_GZIP", "true" if env_mode == "production" else "false").lower() == "true"
if enable_gzip:
    # Increased minimum_size to 20000 bytes to significantly reduce GZip warnings
    # This prevents compression attempts on small responses that may cause I/O errors
    # when connections are closed before compression completes
    # In production, these warnings are typically suppressed or ignored
    app.add_middleware(GZipMiddleware, minimum_size=20000)


# Exception handlers to ensure CORS headers are added even on errors
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions with CORS headers"""
    response = JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )
    # Add CORS headers manually
    origin = request.headers.get("origin")
    if is_allowed_origin(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all exceptions with CORS headers"""
    app_logger.error(f"Unhandled exception: {exc}", exc_info=True)
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
    # Add CORS headers manually
    origin = request.headers.get("origin")
    if is_allowed_origin(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# Request logging middleware (optimized - only log slow requests in production)
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all HTTP requests"""
    start_time = time.time()
    
    try:
    # Process request
    response = await call_next(request)
    
        # Ensure CORS headers are present on all responses
        origin = request.headers.get("origin")
        if origin and is_allowed_origin(origin):
            if "Access-Control-Allow-Origin" not in response.headers:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
    
    # Log response
    process_time = time.time() - start_time
    
    # Only log slow requests (>1s) or errors to reduce logging overhead
    if process_time > 1.0 or response.status_code >= 400:
        app_logger.info(
            f"{request.method} {request.url.path} - "
            f"Status: {response.status_code} - "
            f"Time: {process_time:.3f}s - "
            f"Client: {request.client.host if request.client else 'unknown'}"
        )
    
    return response
    except Exception as e:
        # Log the error
        app_logger.error(f"Error processing request: {e}", exc_info=True)
        raise

# Include routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(credential.router)
app.include_router(chats.router)
app.include_router(chat_messages.router)
app.include_router(logs.router)
