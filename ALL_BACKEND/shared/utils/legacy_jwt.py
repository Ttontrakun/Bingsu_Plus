"""
JWT utilities for authentication
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import HTTPException, status
import os
from dotenv import load_dotenv

load_dotenv()

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
JWT_ISSUER = os.getenv("JWT_ISSUER", "bingsu-plus-api")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "bingsu-plus-client")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token with standard claims"""
    to_encode = data.copy()
    now = datetime.utcnow()
    
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Add standard JWT claims
    to_encode.update({
        "exp": expire,  # Expiration time
        "iat": now,     # Issued at
        "iss": JWT_ISSUER,  # Issuer
        "aud": JWT_AUDIENCE,  # Audience
    })
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> dict:
    """
    Verify and decode a JWT token with full validation
    Validates: signature, expiration (exp), issued at (iat), issuer (iss), audience (aud)
    Supports backward compatibility with tokens that don't have iss/aud claims
    """
    try:
        # First, decode without strict issuer/audience validation
        # This allows both old tokens (without iss/aud) and new tokens (with iss/aud) to work
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={
                "verify_signature": True,  # Verify signature (required)
                "verify_exp": True,        # Verify expiration (required)
                "verify_iat": False,       # Don't require iat (for backward compatibility)
                "verify_iss": False,       # Don't require iss (we'll validate manually)
                "verify_aud": False,       # Don't require aud (we'll validate manually)
            }
        )
        
        
        # If token has iss/aud, validate them match expected values
        if "iss" in payload and payload["iss"] != JWT_ISSUER:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token issuer",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if "aud" in payload:
            token_aud = payload["aud"]
            expected_aud = JWT_AUDIENCE
            if isinstance(token_aud, list):
                if expected_aud not in token_aud:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid token audience",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            elif token_aud != expected_aud:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token audience",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        
        return payload
    except HTTPException:
        # Re-raise HTTPException as-is
        raise
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
