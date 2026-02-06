"""
Credential schemas for request/response validation
"""
from pydantic import BaseModel, Field
from datetime import datetime


class CredentialBase(BaseModel):
    """Base credential schema"""
    username: str


class CredentialCreate(CredentialBase):
    """Schema for creating credentials"""
    password: str


class CredentialUpdate(BaseModel):
    """Schema for updating credentials"""
    username: str | None = None
    password: str | None = None


class ChangePasswordRequest(BaseModel):
    """Schema for changing password (requires old password verification)"""
    old_password: str = Field(..., min_length=1, description="Current password for verification")
    new_password: str = Field(..., min_length=6, description="New password (minimum 6 characters)")


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
