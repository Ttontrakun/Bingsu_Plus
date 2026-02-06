"""
Chat routes
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.database import get_db
from app.models import Chat, User, chat_users
from app.schemas.chat import ChatCreate, ChatUpdate, ChatResponse, ChatUserCreate, ChatUserUpdate
from app.dependencies import get_current_user

router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("", response_model=List[ChatResponse])
async def get_chats(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all chats for current user"""
    # Optimized query with eager loading to prevent N+1 queries
    # Use distinct() to avoid duplicate rows from join
    chats = (
        db.query(Chat)
        .join(chat_users)
        .filter(chat_users.c.userId == current_user.id)
        .options(joinedload(Chat.users))  # Eager load users to prevent N+1 queries
        .order_by(Chat.lastUsed.desc())
        .offset(skip)
        .limit(limit)
        .distinct()
        .all()
    )
    return chats


@router.get("/{chat_id}", response_model=ChatResponse)
async def get_chat(chat_id: int, db: Session = Depends(get_db)):
    """Get chat by ID"""
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@router.post("", response_model=ChatResponse, status_code=201)
async def create_chat(
    chat: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new chat"""
    from datetime import datetime
    now = datetime.now()
    db_chat = Chat(name=chat.name, createdAt=now, updatedAt=now, lastUsed=now)
    db.add(db_chat)
    db.flush()  # Get the chat ID
    
    # Add current user to chat
    db_chat.users.append(current_user)
    
    # Add other users to chat - optimized: bulk query instead of loop
    if chat.user_ids:
        # Filter out current user and get all users in one query
        user_ids_to_add = [uid for uid in chat.user_ids if uid != current_user.id]
        if user_ids_to_add:
            users_to_add = db.query(User).filter(User.id.in_(user_ids_to_add)).all()
            if len(users_to_add) != len(user_ids_to_add):
                found_ids = {u.id for u in users_to_add}
                missing_ids = set(user_ids_to_add) - found_ids
                raise HTTPException(status_code=404, detail=f"Users not found: {list(missing_ids)}")
            db_chat.users.extend(users_to_add)
    
    db.commit()
    db.refresh(db_chat)
    return db_chat


@router.put("/{chat_id}", response_model=ChatResponse)
async def update_chat(chat_id: int, chat: ChatUpdate, db: Session = Depends(get_db)):
    """Update chat"""
    db_chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not db_chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if chat.name is not None:
        db_chat.name = chat.name
    
    db.commit()
    db.refresh(db_chat)
    return db_chat


@router.delete("/{chat_id}")
async def delete_chat(chat_id: int, db: Session = Depends(get_db)):
    """Delete chat"""
    db_chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not db_chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    db.delete(db_chat)
    db.commit()
    return {"message": "Chat deleted successfully"}


@router.post("/{chat_id}/users", response_model=ChatResponse)
async def add_user_to_chat(chat_id: int, chat_user: ChatUserCreate, db: Session = Depends(get_db)):
    """Add user to chat"""
    db_chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not db_chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    user = db.query(User).filter(User.id == chat_user.userId).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user already in chat
    if user in db_chat.users:
        raise HTTPException(status_code=400, detail="User already in chat")
    
    # Add user to chat with role
    db_chat.users.append(user)
    
    # Update role in junction table
    stmt = chat_users.update().where(
        (chat_users.c.chatId == chat_id) & (chat_users.c.userId == chat_user.userId)
    ).values(role=chat_user.role)
    db.execute(stmt)
    
    db.commit()
    db.refresh(db_chat)
    return db_chat


@router.put("/{chat_id}/users/{user_id}", response_model=ChatResponse)
async def update_user_role_in_chat(
    chat_id: int, 
    user_id: int, 
    chat_user: ChatUserUpdate, 
    db: Session = Depends(get_db)
):
    """Update user role in chat"""
    db_chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not db_chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user not in db_chat.users:
        raise HTTPException(status_code=404, detail="User not in chat")
    
    # Update role in junction table
    stmt = chat_users.update().where(
        (chat_users.c.chatId == chat_id) & (chat_users.c.userId == user_id)
    ).values(role=chat_user.role)
    db.execute(stmt)
    
    db.commit()
    db.refresh(db_chat)
    return db_chat


@router.delete("/{chat_id}/users/{user_id}", response_model=ChatResponse)
async def remove_user_from_chat(chat_id: int, user_id: int, db: Session = Depends(get_db)):
    """Remove user from chat"""
    db_chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not db_chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user not in db_chat.users:
        raise HTTPException(status_code=404, detail="User not in chat")
    
    db_chat.users.remove(user)
    db.commit()
    db.refresh(db_chat)
    return db_chat


@router.get("/{chat_id}/users", response_model=List[dict])
async def get_chat_users(chat_id: int, db: Session = Depends(get_db)):
    """Get all users in a chat"""
    db_chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not db_chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Optimized: Use single query with join instead of N+1 queries
    from sqlalchemy import select
    result = db.execute(
        select(
            User.id,
            User.username,
            User.email,
            chat_users.c.role,
            chat_users.c.joinedAt
        )
        .select_from(chat_users)
        .join(User, chat_users.c.userId == User.id)
        .where(chat_users.c.chatId == chat_id)
    ).fetchall()
    
    # Convert to list of dicts
    users_data = [
        {
            "userId": row.id,
            "username": row.username,
            "email": row.email,
            "role": row.role,
            "joinedAt": row.joinedAt
        }
        for row in result
    ]
    
    return users_data
