"""
Chat message routes
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import ChatMessage, Chat, User
from app.schemas.chat_message import ChatMessageCreate, ChatMessageUpdate, ChatMessageResponse
from app.dependencies import get_current_user

router = APIRouter(prefix="/chats/{chat_id}/messages", tags=["chat-messages"])


@router.get("", response_model=List[ChatMessageResponse])
async def get_chat_messages(
    chat_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all messages in a chat"""
    # Optimized: Use exists() subquery instead of separate query
    from sqlalchemy import exists
    chat_exists = db.query(exists().where(Chat.id == chat_id)).scalar()
    if not chat_exists:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Optimized query with eager loading to prevent N+1 queries
    from sqlalchemy.orm import joinedload
    messages = (
        db.query(ChatMessage)
        .options(
            joinedload(ChatMessage.sender).joinedload(User.credential)  # Eager load sender and credential
        )
        .filter(ChatMessage.chatId == chat_id)
        .order_by(ChatMessage.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return messages


@router.get("/{message_id}", response_model=ChatMessageResponse)
async def get_chat_message(chat_id: int, message_id: int, db: Session = Depends(get_db)):
    """Get message by ID"""
    from sqlalchemy.orm import joinedload
    message = (
        db.query(ChatMessage)
        .options(
            joinedload(ChatMessage.sender).joinedload(User.credential)  # Eager load sender and credential
        )
        .filter(ChatMessage.id == message_id, ChatMessage.chatId == chat_id)
        .first()
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    return message


@router.post("", response_model=ChatMessageResponse, status_code=201)
async def create_chat_message(
    chat_id: int,
    message: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new message in chat"""
    # Optimized: Check membership with single query instead of loading all users
    from sqlalchemy import exists
    from app.models import chat_users
    
    chat_exists = db.query(exists().where(Chat.id == chat_id)).scalar()
    if not chat_exists:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Check membership efficiently
    membership = db.query(
        exists().where(
            (chat_users.c.chatId == chat_id) & 
            (chat_users.c.userId == current_user.id)
        )
    ).scalar()
    
    if not membership:
        raise HTTPException(status_code=403, detail="User is not a member of this chat")
    
    from datetime import datetime
    now = datetime.now()
    db_message = ChatMessage(
        chatId=chat_id,
        userId=current_user.id,
        message=message.message,
        updatedAt=now
    )
    db.add(db_message)
    
    # Optimized: Update chat's lastUsed timestamp with single UPDATE query
    db.execute(
        Chat.__table__.update()
        .where(Chat.id == chat_id)
        .values(lastUsed=now, updatedAt=now)
    )
    
    db.commit()
    db.refresh(db_message)
    return db_message


@router.put("/{message_id}", response_model=ChatMessageResponse)
async def update_chat_message(
    chat_id: int,
    message_id: int,
    message: ChatMessageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update message (only sender can update)"""
    db_message = (
        db.query(ChatMessage)
        .filter(ChatMessage.id == message_id, ChatMessage.chatId == chat_id)
        .first()
    )
    if not db_message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Only sender can update
    if db_message.userId != current_user.id:
        raise HTTPException(status_code=403, detail="Only message sender can update")
    
    db_message.message = message.message
    db.commit()
    db.refresh(db_message)
    return db_message


@router.delete("/{message_id}")
async def delete_chat_message(
    chat_id: int,
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete message (only sender can delete)"""
    db_message = (
        db.query(ChatMessage)
        .filter(ChatMessage.id == message_id, ChatMessage.chatId == chat_id)
        .first()
    )
    if not db_message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Only sender can delete
    if db_message.userId != current_user.id:
        raise HTTPException(status_code=403, detail="Only message sender can delete")
    
    db.delete(db_message)
    db.commit()
    return {"message": "Message deleted successfully"}
