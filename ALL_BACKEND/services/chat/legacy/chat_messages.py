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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all messages in a chat - requires user to be a member of the chat"""
    from sqlalchemy import exists
    from app.models import chat_users
    
    # Check if chat exists
    chat_exists = db.query(exists().where(Chat.id == chat_id)).scalar()
    if not chat_exists:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # SECURITY: Check if user is a member of the chat
    membership = db.query(
        exists().where(
            (chat_users.c.chatId == chat_id) & 
            (chat_users.c.userId == current_user.id)
        )
    ).scalar()
    
    if not membership:
        raise HTTPException(status_code=403, detail="User is not a member of this chat")
    
    # Optimized query with eager loading to prevent N+1 queries
    # SECURITY: Don't load credential data - it's sensitive and not needed for message display
    from sqlalchemy.orm import joinedload
    messages = (
        db.query(ChatMessage)
        .options(
            joinedload(ChatMessage.sender)  # Only load sender, not credential
        )
        .filter(ChatMessage.chatId == chat_id)
        .order_by(ChatMessage.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return messages


@router.get("/{message_id}", response_model=ChatMessageResponse)
async def get_chat_message(
    chat_id: int, 
    message_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get message by ID - requires user to be a member of the chat"""
    from sqlalchemy import exists
    from app.models import chat_users
    
    # Check if chat exists
    chat_exists = db.query(exists().where(Chat.id == chat_id)).scalar()
    if not chat_exists:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # SECURITY: Check if user is a member of the chat
    membership = db.query(
        exists().where(
            (chat_users.c.chatId == chat_id) & 
            (chat_users.c.userId == current_user.id)
        )
    ).scalar()
    
    if not membership:
        raise HTTPException(status_code=403, detail="User is not a member of this chat")
    
    # SECURITY: Don't load credential data - it's sensitive and not needed
    from sqlalchemy.orm import joinedload
    message = (
        db.query(ChatMessage)
        .options(
            joinedload(ChatMessage.sender)  # Only load sender, not credential
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
    
    from datetime import datetime, timedelta
    now = datetime.now()
    
    # ป้องกันการสร้างข้อความซ้ำ: ตรวจสอบว่ามีข้อความเดียวกันจาก user เดียวกันใน 1 วินาทีล่าสุดหรือไม่
    one_second_ago = now - timedelta(seconds=1)
    duplicate_check = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.chatId == chat_id,
            ChatMessage.userId == current_user.id,
            ChatMessage.message == message.message,
            ChatMessage.createdAt >= one_second_ago
        )
        .first()
    )
    
    if duplicate_check:
        # ถ้ามีข้อความซ้ำ ให้ return ข้อความเดิมแทนการสร้างใหม่
        return duplicate_check
    
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
    """Delete message - requires user to be a member of the chat and the message sender"""
    from sqlalchemy import exists
    from app.models import chat_users
    
    # SECURITY: Check if user is a member of the chat
    membership = db.query(
        exists().where(
            (chat_users.c.chatId == chat_id) & 
            (chat_users.c.userId == current_user.id)
        )
    ).scalar()
    
    if not membership:
        raise HTTPException(status_code=403, detail="User is not a member of this chat")
    
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


@router.post("/bot-response", response_model=ChatMessageResponse, status_code=201)
async def create_bot_response(
    chat_id: int,
    message: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a bot response message in chat"""
    import asyncio
    from sqlalchemy import exists
    from app.models import chat_users
    
    # Check if chat exists
    chat_exists = db.query(exists().where(Chat.id == chat_id)).scalar()
    if not chat_exists:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Check membership
    membership = db.query(
        exists().where(
            (chat_users.c.chatId == chat_id) & 
            (chat_users.c.userId == current_user.id)
        )
    ).scalar()
    
    if not membership:
        raise HTTPException(status_code=403, detail="User is not a member of this chat")
    
    # TODO: เรียกใช้ AI service เพื่อสร้าง bot response ที่แท้จริง
    # ตอนนี้ใช้ delay 3 วินาทีเพื่อจำลองการคิดของ AI
    # ถ้ามี AI service แล้ว ให้เรียกใช้ที่นี่และรอผลลัพธ์
    await asyncio.sleep(3)  # หน่วงเวลา 3 วินาที
    
    # Create bot message using current_user.id but mark as AI generated
    from datetime import datetime, timedelta
    now = datetime.now()
    
    # ป้องกันการสร้าง bot response ซ้ำ: ตรวจสอบว่ามี bot response เดียวกันใน 1 วินาทีล่าสุดหรือไม่
    one_second_ago = now - timedelta(seconds=1)
    duplicate_check = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.chatId == chat_id,
            ChatMessage.userId == current_user.id,
            ChatMessage.message == message.message,
            ChatMessage.isAiGenerated == True,
            ChatMessage.createdAt >= one_second_ago
        )
        .first()
    )
    
    if duplicate_check:
        # ถ้ามี bot response ซ้ำ ให้ return ข้อความเดิมแทนการสร้างใหม่
        return duplicate_check
    
    db_message = ChatMessage(
        chatId=chat_id,
        userId=current_user.id,  # Use current user's ID
        message=message.message,
        isAiGenerated=True,  # Mark as AI generated
        updatedAt=now
    )
    db.add(db_message)
    
    # Update chat's lastUsed timestamp
    db.execute(
        Chat.__table__.update()
        .where(Chat.id == chat_id)
        .values(lastUsed=now, updatedAt=now)
    )
    
    db.commit()
    db.refresh(db_message)
    return db_message
