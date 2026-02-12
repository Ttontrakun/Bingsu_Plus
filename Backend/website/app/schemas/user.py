"""
User schemas for request/response validation
"""
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional
from app.schemas.credential import CredentialResponse


class UserBase(BaseModel):
    """Base user schema"""
    email: EmailStr = Field(..., max_length=255, description="User email address")


class UserCreate(UserBase):
    """Schema for creating a user"""
    # Credential fields
    username: str = Field(..., min_length=3, max_length=50, description="Username (3-50 characters)")
    password: str = Field(..., min_length=6, max_length=128, description="Password (6-128 characters)")
    # Profile fields
    firstName: Optional[str] = Field(None, max_length=100, description="First name (max 100 characters)")
    lastName: Optional[str] = Field(None, max_length=100, description="Last name (max 100 characters)")


class UserRegister(BaseModel):
    """Schema for user registration (simplified - only email and full name)"""
    email: EmailStr = Field(..., max_length=255, description="User email address")
    fullName: Optional[str] = Field(None, max_length=200, description="Full name (max 200 characters)")


class UserUpdate(BaseModel):
    """Schema for updating a user (profile info only)"""
    email: Optional[EmailStr] = Field(None, max_length=255, description="User email address")
    firstName: Optional[str] = Field(None, max_length=100, description="First name (max 100 characters)")
    lastName: Optional[str] = Field(None, max_length=100, description="Last name (max 100 characters)")

    class Config:
        # Pydantic v2: Use model_config instead of Config class
        # For Pydantic v1: This Config class works
        # Allow null values for optional fields
        allow_none = True


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr = Field(..., max_length=255, description="User email address")
    password: str = Field(..., min_length=1, max_length=128, description="Password")


class UserResponse(UserBase):
    """Schema for user response"""
    id: int
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    emailVerified: bool = False
    isApproved: bool = False
    role: str = "user"
    credential: Optional[CredentialResponse] = None  # Include credential if exists
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True


class VerifyEmailRequest(BaseModel):
    """Schema for email verification"""
    token: str = Field(..., min_length=1, max_length=500, description="Verification token")


class SetPasswordRequest(BaseModel):
    """Schema for setting password after email verification"""
    token: str = Field(..., min_length=1, max_length=500, description="Verification token")
    password: str = Field(..., min_length=6, max_length=128, description="Password (6-128 characters)")


class ResendVerificationRequest(BaseModel):
    """Schema for resending verification email"""
    email: EmailStr = Field(..., max_length=255, description="User email address")


class ForgotPasswordRequest(BaseModel):
    """Schema for requesting password reset"""
    email: EmailStr = Field(..., max_length=255, description="User email address")


class ResetPasswordRequest(BaseModel):
    """Schema for resetting password with token"""
    token: str = Field(..., min_length=1, max_length=500, description="Password reset token")
    password: str = Field(..., min_length=6, max_length=128, description="New password (6-128 characters)")


class ForgotPasswordResponse(BaseModel):
    """Response for forgot password request (includes token for development/testing)"""
    message: str
    success: bool = True
    resetToken: Optional[str] = None  # Only for development/testing


class RegisterResponse(UserResponse):
    """Schema for user registration response (includes verification token for development)"""
    verificationToken: Optional[str] = None  # Only included for development/testing
