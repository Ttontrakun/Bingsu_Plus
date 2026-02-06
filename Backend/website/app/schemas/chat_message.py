"""
Chat message schemas for request/response validation
"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.schemas.user import UserResponse


class ChatMessageBase(BaseModel):
    """Base chat message schema"""
    message: str


class ChatMessageCreate(ChatMessageBase):
    """Schema for creating a chat message"""
    pass


class ChatMessageUpdate(BaseModel):
    """Schema for updating a chat message"""
    message: str


class ChatMessageResponse(ChatMessageBase):
    """Schema for chat message response"""
    id: int
    chatId: int
    userId: int
    createdAt: datetime
    updatedAt: datetime
    sender: Optional[UserResponse] = None

    class Config:
        from_attributes = True
