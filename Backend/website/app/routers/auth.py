"""
Authentication routes
"""
from fastapi import APIRouter, HTTPException, Depends, status, Request
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.models import User, Credential
from app.schemas.user import (
    UserLogin, 
    UserResponse, 
    VerifyEmailRequest,
    SetPasswordRequest,
    ResendVerificationRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ForgotPasswordResponse
)
from app.utils.jwt import create_access_token
from app.dependencies import get_current_user
from app.utils.password import verify_password, hash_password
from app.utils.verification import generate_verification_token

router = APIRouter(prefix="/auth", tags=["auth"])

# Create limiter instance - will be initialized with app.state.limiter in main.py
limiter = Limiter(key_func=get_remote_address)


class TokenResponse(BaseModel):
    """Token response schema"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    """Generic message response"""
    message: str
    success: bool = True


class ResendVerificationResponse(BaseModel):
    """Response for resend verification (includes token for development/testing)"""
    message: str
    success: bool = True
    verificationToken: Optional[str] = None  # Only for development/testing


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")  # 5 failed login attempts per minute per IP
async def login(
    request: Request,
    credentials: UserLogin,
    db: Session = Depends(get_db)
):
    """
    Login with email and password
    Rate limited: 5 failed attempts per minute per IP (prevents brute force attacks)
    Successful logins automatically reset the rate limit for that IP
    Optimized for high concurrency (70+ concurrent logins)
    """
    # Find user by email
    user = (
        db.query(User)
        .options(joinedload(User.credential))
        .filter(User.email == credentials.email)
        .first()
    )
    
    if not user:
        # Use same error message to prevent email enumeration
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    
    # Check if email is verified
    if not user.emailVerified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email before logging in."
        )
    
    # Check if user is approved by admin
    if not user.isApproved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending approval from an administrator. Please wait for approval before logging in."
        )
    
    # Check if credential exists
    if not user.credential:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    
    # Verify password (async, non-blocking) - runs in thread pool
    is_valid = await verify_password(credentials.password, user.credential.password)
    
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    
    # If we reach here, login is successful
    # Reset rate limit for this IP to allow immediate successful login
    # This ensures that successful logins don't get blocked by previous failed attempts
    try:
        # Get the limiter from app state
        limiter_instance = request.app.state.limiter
        # Get the key for this request (IP address)
        key = get_remote_address(request)
        # Reset the rate limit for this key by accessing the storage
        # slowapi uses a storage backend (default: MemoryStorage) that tracks rate limits
        if hasattr(limiter_instance, 'storage'):
            # The storage format in slowapi is typically a dict-like structure
            # We need to clear the entry for this key
            try:
                # Access the internal storage and clear the entry
                if hasattr(limiter_instance.storage, '_storage'):
                    # MemoryStorage uses _storage dict
                    storage_dict = limiter_instance.storage._storage
                    # Find and remove entries for this key (format: "LIMITER:key:endpoint")
                    keys_to_remove = [k for k in list(storage_dict.keys()) if key in str(k) and '/auth/login' in str(k)]
                    for k in keys_to_remove:
                        del storage_dict[k]
            except Exception as clear_error:
                # If clearing fails, log but don't fail the login
                import logging
                logger = logging.getLogger("app")
                logger.warning(f"Could not clear rate limit after successful login: {clear_error}")
    except Exception as e:
        # If reset fails, log but don't fail the login
        import logging
        logger = logging.getLogger("app")
        logger.warning(f"Could not reset rate limit after successful login: {e}")
    
    # Create JWT token (sub must be string for jose library)
    # Use email instead of username
    access_token = create_access_token(data={"sub": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/verify-email", response_model=MessageResponse)
@limiter.limit("10/hour")  # 10 verification attempts per hour per IP
async def verify_email(
    request: Request,
    verify_request: VerifyEmailRequest,
    db: Session = Depends(get_db)
):
    """
    Verify email with verification token
    Token will be kept until password is set
    Rate limited: 10 attempts per hour per IP
    """
    user = (
        db.query(User)
        .filter(User.verificationToken == verify_request.token)
        .first()
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid verification token"
        )
    
    if user.emailVerified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified"
        )
    
    # Mark email as verified (keep token for set-password step)
    user.emailVerified = True
    db.commit()
    
    return MessageResponse(
        message="Email verified successfully. You can now set your password.",
        success=True
    )


@router.post("/set-password", response_model=MessageResponse)
@limiter.limit("5/hour")  # 5 password set attempts per hour per IP
async def set_password(
    request: Request,
    set_password_request: SetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Set password after email verification
    Requires verification token
    Rate limited: 5 attempts per hour per IP
    """
    user = (
        db.query(User)
        .options(joinedload(User.credential))
        .filter(User.verificationToken == set_password_request.token)
        .first()
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid verification token"
        )
    
    if not user.emailVerified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email must be verified before setting password"
        )
    
    # Hash password (async, non-blocking)
    hashed_password = await hash_password(set_password_request.password)
    
    # Create or update credential
    if user.credential:
        # Update existing credential
        user.credential.password = hashed_password
    else:
        # Create new credential with email as username
        from datetime import datetime
        credential = Credential(
            userId=user.id,
            username=user.email,  # Use email as username
            password=hashed_password,
            createdAt=datetime.now(),
            updatedAt=datetime.now()
        )
        db.add(credential)
    
    # Clear verification token
    user.verificationToken = None
    db.commit()
    
    return MessageResponse(
        message="Password set successfully",
        success=True
    )


@router.post("/resend-verification", response_model=ResendVerificationResponse)
@limiter.limit("3/hour")  # 3 resend attempts per hour per IP - prevents spam
async def resend_verification(
    request: Request,
    resend_request: ResendVerificationRequest,
    db: Session = Depends(get_db)
):
    """
    Resend verification email
    Returns verification token in response for development/testing
    In production, token should only be sent via email
    Rate limited: 3 attempts per hour per IP
    """
    user = db.query(User).filter(User.email == resend_request.email).first()
    
    if not user:
        # Don't reveal if email exists (security)
        return ResendVerificationResponse(
            message="If the email exists, a verification email has been sent",
            success=True,
            verificationToken=None
        )
    
    if user.emailVerified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified"
        )
    
    # Generate new verification token
    new_token = generate_verification_token()
    user.verificationToken = new_token
    db.commit()
    
    # TODO: Send verification email here with token
    # In production, integrate with email service (SendGrid, AWS SES, etc.)
    # Email should contain link like: https://yourapp.com/verifying?token={new_token}
    
    # For development/testing, return token in response
    return ResendVerificationResponse(
        message="Verification email sent (if email exists)",
        success=True,
        verificationToken=new_token  # Only for development/testing
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit("3/hour")  # 3 password reset requests per hour per IP - prevents spam
async def forgot_password(
    request: Request,
    forgot_request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Request password reset - sends reset token via email
    Generates a new reset token every time (replaces any existing token)
    Returns reset token in response for development/testing
    In production, token should only be sent via email
    Rate limited: 3 attempts per hour per IP
    """
    user = db.query(User).filter(User.email == forgot_request.email).first()
    
    if not user:
        # Don't reveal if email exists (security)
        return ForgotPasswordResponse(
            message="If the email exists, a password reset email has been sent",
            success=True,
            resetToken=None
        )
    
    # Check if user has verified email
    if not user.emailVerified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not verified. Please verify your email first."
        )
    
    # Clear any existing reset token first (important for security)
    # Then generate a new password reset token
    # This ensures only the latest token is valid
    user.passwordResetToken = None
    db.flush()  # Clear old token before generating new one
    
    # Generate new password reset token
    reset_token = generate_verification_token()
    user.passwordResetToken = reset_token
    db.commit()
    
    # TODO: Send password reset email here with token
    # In production, integrate with email service (SendGrid, AWS SES, etc.)
    # Email should contain link like: https://yourapp.com/reset-password?token={reset_token}
    # IMPORTANT: Only the latest token sent via email will be valid
    # Previous tokens are automatically invalidated when a new request is made
    
    # For development/testing, return token in response
    return ForgotPasswordResponse(
        message="Password reset email sent (if email exists)",
        success=True,
        resetToken=reset_token  # Only for development/testing
    )


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("5/hour")  # 5 password reset attempts per hour per IP - prevents brute force
async def reset_password(
    request: Request,
    reset_request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Reset password using reset token
    Requires password reset token from forgot-password endpoint
    Rate limited: 5 attempts per hour per IP
    """
    user = (
        db.query(User)
        .options(joinedload(User.credential))
        .filter(User.passwordResetToken == reset_request.token)
        .first()
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired reset token"
        )
    
    # Check if user has verified email
    if not user.emailVerified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email must be verified before resetting password"
        )
    
    # Hash new password (async, non-blocking)
    hashed_password = await hash_password(reset_request.password)
    
    # Update or create credential
    if user.credential:
        # Update existing credential
        user.credential.password = hashed_password
    else:
        # Create new credential with email as username
        from datetime import datetime
        credential = Credential(
            userId=user.id,
            username=user.email,  # Use email as username
            password=hashed_password,
            createdAt=datetime.now(),
            updatedAt=datetime.now()
        )
        db.add(credential)
    
    # Clear reset token
    user.passwordResetToken = None
    db.commit()
    
    return MessageResponse(
        message="Password reset successfully",
        success=True
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current authenticated user information"""
    # Eager load credential for response
    user = (
        db.query(User)
        .options(joinedload(User.credential))
        .filter(User.id == current_user.id)
        .first()
    )
    return user
