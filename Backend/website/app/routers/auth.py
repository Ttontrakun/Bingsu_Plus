"""
Authentication routes
"""
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional

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
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Login with email and password
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
    
    # Create JWT token (sub must be string for jose library)
    # Use email instead of username
    access_token = create_access_token(data={"sub": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    request: VerifyEmailRequest,
    db: Session = Depends(get_db)
):
    """
    Verify email with verification token
    Token will be kept until password is set
    """
    user = (
        db.query(User)
        .filter(User.verificationToken == request.token)
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
async def set_password(
    request: SetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Set password after email verification
    Requires verification token
    """
    user = (
        db.query(User)
        .options(joinedload(User.credential))
        .filter(User.verificationToken == request.token)
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
    hashed_password = await hash_password(request.password)
    
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
async def resend_verification(
    request: ResendVerificationRequest,
    db: Session = Depends(get_db)
):
    """
    Resend verification email
    Returns verification token in response for development/testing
    In production, token should only be sent via email
    """
    user = db.query(User).filter(User.email == request.email).first()
    
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
async def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Request password reset - sends reset token via email
    Generates a new reset token every time (replaces any existing token)
    Returns reset token in response for development/testing
    In production, token should only be sent via email
    """
    user = db.query(User).filter(User.email == request.email).first()
    
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
async def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Reset password using reset token
    Requires password reset token from forgot-password endpoint
    """
    user = (
        db.query(User)
        .options(joinedload(User.credential))
        .filter(User.passwordResetToken == request.token)
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
    hashed_password = await hash_password(request.password)
    
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
