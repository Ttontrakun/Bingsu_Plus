"""
Chat message schemas for request/response validation
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.schemas.user import UserResponse


class ChatMessageBase(BaseModel):
    """Base chat message schema"""
    message: str = Field(..., min_length=1, max_length=10000, description="Message content (1-10000 characters)")


class ChatMessageCreate(ChatMessageBase):
    """Schema for creating a chat message"""
    pass


class ChatMessageUpdate(BaseModel):
    """Schema for updating a chat message"""
    message: str = Field(..., min_length=1, max_length=10000, description="Message content (1-10000 characters)")


class ChatMessageResponse(ChatMessageBase):
    """Schema for chat message response"""
    id: int
    chatId: int
    userId: int
    isAiGenerated: bool = False
    createdAt: datetime
    updatedAt: datetime
    sender: Optional[UserResponse] = None

    class Config:
        from_attributes = True
