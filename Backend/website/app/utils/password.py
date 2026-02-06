"""
Password hashing utilities
Optimized for high concurrency
"""
import bcrypt
import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial

# Thread pool for CPU-intensive password operations
# This prevents blocking the event loop during password hashing
# Increased workers for 70+ concurrent logins
# Formula: (CPU cores * 2) + 1, but for 70 concurrent logins, we need more
_password_executor = ThreadPoolExecutor(max_workers=20, thread_name_prefix="password")


def _hash_password_sync(password: str) -> str:
    """Synchronous password hashing (runs in thread pool)"""
    # Bcrypt has a 72 byte limit, so we'll truncate if necessary
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    # Generate salt and hash
    # Using rounds=10 for better performance with high concurrency
    # Still secure but faster (70+ concurrent logins)
    salt = bcrypt.gensalt(rounds=10)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def _verify_password_sync(plain_password: str, hashed_password: str) -> bool:
    """Synchronous password verification (runs in thread pool)"""
    try:
        password_bytes = plain_password.encode('utf-8')
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


async def hash_password(password: str) -> str:
    """Hash a password using bcrypt (async, non-blocking)"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_password_executor, _hash_password_sync, password)


def hash_password_sync(password: str) -> str:
    """Hash a password using bcrypt (synchronous version for compatibility)"""
    return _hash_password_sync(password)


async def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash (async, non-blocking)"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _password_executor, 
        _verify_password_sync, 
        plain_password, 
        hashed_password
    )


def verify_password_sync(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash (synchronous version for compatibility)"""
    return _verify_password_sync(plain_password, hashed_password)
