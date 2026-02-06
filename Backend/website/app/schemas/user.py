"""
User schemas for request/response validation
"""
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional
from app.schemas.credential import CredentialResponse


class UserBase(BaseModel):
    """Base user schema"""
    email: EmailStr


class UserCreate(UserBase):
    """Schema for creating a user"""
    # Credential fields
    username: str
    password: str
    # Profile fields
    firstName: Optional[str] = None
    lastName: Optional[str] = None


class UserRegister(BaseModel):
    """Schema for user registration (simplified - only email and full name)"""
    email: EmailStr
    fullName: Optional[str] = None  # Full name that will be split into firstName and lastName


class UserUpdate(BaseModel):
    """Schema for updating a user (profile info only)"""
    email: Optional[EmailStr] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None

    class Config:
        # Pydantic v2: Use model_config instead of Config class
        # For Pydantic v1: This Config class works
        # Allow null values for optional fields
        allow_none = True


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str


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
    token: str


class SetPasswordRequest(BaseModel):
    """Schema for setting password after email verification"""
    token: str
    password: str = Field(..., min_length=6, description="Password (minimum 6 characters)")


class ResendVerificationRequest(BaseModel):
    """Schema for resending verification email"""
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    """Schema for requesting password reset"""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Schema for resetting password with token"""
    token: str
    password: str = Field(..., min_length=6, description="New password (minimum 6 characters)")


class ForgotPasswordResponse(BaseModel):
    """Response for forgot password request (includes token for development/testing)"""
    message: str
    success: bool = True
    resetToken: Optional[str] = None  # Only for development/testing


class RegisterResponse(UserResponse):
    """Schema for user registration response (includes verification token for development)"""
    verificationToken: Optional[str] = None  # Only included for development/testing
