"""
Chat schemas for request/response validation
"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.schemas.user import UserResponse


class ChatBase(BaseModel):
    """Base chat schema"""
    name: Optional[str] = None


class ChatCreate(ChatBase):
    """Schema for creating a chat"""
    user_ids: List[int] = []  # Users to add to chat


class ChatUpdate(BaseModel):
    """Schema for updating a chat"""
    name: Optional[str] = None


class ChatUserResponse(BaseModel):
    """Schema for chat user response"""
    chatId: int
    userId: int
    joinedAt: datetime
    role: str

    class Config:
        from_attributes = True


class ChatResponse(ChatBase):
    """Schema for chat response"""
    id: int
    createdAt: datetime
    updatedAt: datetime
    lastUsed: datetime
    users: Optional[List[UserResponse]] = None

    class Config:
        from_attributes = True


class ChatUserCreate(BaseModel):
    """Schema for adding user to chat"""
    userId: int
    role: Optional[str] = "member"


class ChatUserUpdate(BaseModel):
    """Schema for updating user role in chat"""
    role: str
