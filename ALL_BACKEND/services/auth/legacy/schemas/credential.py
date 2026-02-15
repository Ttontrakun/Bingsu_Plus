"""
Credential schemas for request/response validation
"""
from pydantic import BaseModel, Field
from datetime import datetime


class CredentialBase(BaseModel):
    """Base credential schema"""
    username: str = Field(..., min_length=3, max_length=50, description="Username (3-50 characters)")


class CredentialCreate(CredentialBase):
    """Schema for creating credentials"""
    password: str = Field(..., min_length=6, max_length=128, description="Password (6-128 characters)")


class CredentialUpdate(BaseModel):
    """Schema for updating credentials"""
    username: str | None = Field(None, min_length=3, max_length=50, description="Username (3-50 characters)")
    password: str | None = Field(None, min_length=6, max_length=128, description="Password (6-128 characters)")


class ChangePasswordRequest(BaseModel):
    """Schema for changing password (requires old password verification)"""
    old_password: str = Field(..., min_length=1, max_length=128, description="Current password for verification")
    new_password: str = Field(..., min_length=6, max_length=128, description="New password (6-128 characters)")


class ChangePasswordResponse(BaseModel):
    """Response schema for password change"""
    message: str
    success: bool = True


class CredentialResponse(CredentialBase):
    """Schema for credential response (password excluded)"""
    id: int
    userId: int
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True
