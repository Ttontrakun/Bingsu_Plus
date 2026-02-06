"""
SQLAlchemy models based on Prisma schema
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

# Junction table for many-to-many relationship between User and Chat
chat_users = Table(
    'ChatUser',
    Base.metadata,
    Column('chatId', Integer, ForeignKey('Chat.id', ondelete='CASCADE'), primary_key=True),
    Column('userId', Integer, ForeignKey('User.id', ondelete='CASCADE'), primary_key=True),
    Column('joinedAt', DateTime(timezone=True), server_default=func.now()),
    Column('role', String, default='member')  # 'member', 'admin', 'owner'
)


class User(Base):
    """User model - User information and profile"""
    __tablename__ = "User"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    firstName = Column(String, nullable=True)
    lastName = Column(String, nullable=True)
    emailVerified = Column(Boolean, default=False, nullable=False)
    isApproved = Column(Boolean, default=False, nullable=False)  # Admin approval required
    role = Column(String, default='user', nullable=False)  # 'user' or 'admin'
    verificationToken = Column(String, unique=True, nullable=True, index=True)
    passwordResetToken = Column(String, unique=True, nullable=True, index=True)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    credential = relationship("Credential", back_populates="user", uselist=False, cascade="all, delete-orphan")
    chats = relationship("Chat", secondary=chat_users, back_populates="users")
    messages = relationship("ChatMessage", back_populates="sender")


class Credential(Base):
    """Credential model - Authentication credentials (separated for security)"""
    __tablename__ = "Credential"

    id = Column(Integer, primary_key=True, index=True)
    userId = Column(Integer, ForeignKey("User.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)  # Hashed password
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="credential")


class Chat(Base):
    """Chat room model - supports multi-user"""
    __tablename__ = "Chat"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)  # Optional chat room name
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    lastUsed = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    users = relationship("User", secondary=chat_users, back_populates="chats")
    messages = relationship("ChatMessage", back_populates="chat", cascade="all, delete-orphan")


class ChatMessage(Base):
    """Message in a chat room"""
    __tablename__ = "ChatMessage"

    id = Column(Integer, primary_key=True, index=True)
    chatId = Column(Integer, ForeignKey("Chat.id", ondelete="CASCADE"), nullable=False, index=True)
    userId = Column(Integer, ForeignKey("User.id", ondelete="CASCADE"), nullable=False, index=True)  # Sender
    message = Column(String, nullable=False)
    createdAt = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    chat = relationship("Chat", back_populates="messages")
    sender = relationship("User", back_populates="messages")
