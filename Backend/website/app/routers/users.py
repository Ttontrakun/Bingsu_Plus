"""
User routes - User information and profile
"""
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime

from app.database import get_db
from app.models import User, Credential
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserRegister, RegisterResponse
from app.utils.password import hash_password
from app.dependencies import get_current_user, get_current_admin_user
import secrets
import string

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=List[UserResponse])
async def get_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all users"""
    # Eager load credential to avoid N+1 queries
    users = (
        db.query(User)
        .options(joinedload(User.credential))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return users


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get user by ID"""
    # Eager load credential
    user = (
        db.query(User)
        .options(joinedload(User.credential))
        .filter(User.id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def generate_username_from_email(email: str, db: Session) -> str:
    """Generate a unique username from email"""
    base_username = email.split('@')[0].lower()
    # Remove special characters, keep only alphanumeric
    base_username = ''.join(c for c in base_username if c.isalnum() or c in ['_', '-'])
    
    # Check if username exists, if so append numbers
    username = base_username
    counter = 1
    while db.query(Credential).filter(Credential.username == username).first():
        username = f"{base_username}{counter}"
        counter += 1
    
    return username


def generate_temp_password() -> str:
    """Generate a temporary password"""
    # Default password for registration
    return "123456"


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """Create a new user with credential and profile"""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    
    # Check if username already exists
    existing_credential = db.query(Credential).filter(Credential.username == user.username).first()
    if existing_credential:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")
    
    # Hash password (async, non-blocking)
    hashed_password = await hash_password(user.password)
    
    now = datetime.now()
    # Create user (profile info)
    db_user = User(
        email=user.email,
        firstName=user.firstName,
        lastName=user.lastName,
        createdAt=now,
        updatedAt=now
    )
    db.add(db_user)
    db.flush()  # Get user ID
    
    # Create credential (authentication info)
    db_credential = Credential(
        userId=db_user.id,
        username=user.username,
        password=hashed_password,
        createdAt=now,
        updatedAt=now
    )
    db.add(db_credential)
    
    db.commit()
    db.refresh(db_user)
    # Eager load credential for response
    db_user = (
        db.query(User)
        .options(joinedload(User.credential))
        .filter(User.id == db_user.id)
        .first()
    )
    return db_user


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user: UserRegister, db: Session = Depends(get_db)):
    """
    Register a new user with email and full name only
    Email verification required before setting password
    Returns verification token in response for development/testing
    In production, token should only be sent via email
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    
    # Split full name into first and last name
    firstName = None
    lastName = None
    if user.fullName:
        name_parts = user.fullName.strip().split(' ', 1)
        firstName = name_parts[0] if name_parts else None
        lastName = name_parts[1] if len(name_parts) > 1 else None
    
    # Generate verification token
    from app.utils.verification import generate_verification_token
    verification_token = generate_verification_token()
    
    now = datetime.now()
    # Create user (profile info) - email not verified yet, no credential
    db_user = User(
        email=user.email,
        firstName=firstName,
        lastName=lastName,
        emailVerified=False,
        verificationToken=verification_token,
        createdAt=now,
        updatedAt=now
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # TODO: Send verification email here
    # In production, integrate with email service (SendGrid, AWS SES, etc.)
    # For now, verification token is returned in response (for testing)
    
    # Eager load credential for response (will be None initially)
    db_user = (
        db.query(User)
        .options(joinedload(User.credential))
        .filter(User.id == db_user.id)
        .first()
    )
    
    # Return user with verification token (for development/testing only)
    # In production, token should only be sent via email
    # We need to manually construct the response since verificationToken is not in the model
    from app.schemas.user import RegisterResponse
    from app.schemas.credential import CredentialResponse
    
    response_data = RegisterResponse(
        id=db_user.id,
        email=db_user.email,
        firstName=db_user.firstName,
        lastName=db_user.lastName,
        emailVerified=db_user.emailVerified,
        createdAt=db_user.createdAt,
        updatedAt=db_user.updatedAt,
        verificationToken=verification_token,
        credential=None
    )
    
    return response_data


@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    user: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's profile (convenience endpoint)
    Accepts firstName, lastName, and email (all optional)
    IMPORTANT: This route must be defined BEFORE /{user_id} to avoid route matching conflicts
    """
    db_user = (
        db.query(User)
        .options(joinedload(User.credential))
        .filter(User.id == current_user.id)
        .first()
    )
    
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if user.email:
        # Check if email already exists (excluding current user)
        existing_user = db.query(User).filter(User.email == user.email, User.id != current_user.id).first()
        if existing_user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        db_user.email = user.email
    
    # Update profile fields
    if user.firstName is not None:
        db_user.firstName = user.firstName
    if user.lastName is not None:
        db_user.lastName = user.lastName
    
    db_user.updatedAt = datetime.now()
    db.commit()
    db.refresh(db_user)
    
    # Eager load credential for response
    db_user = (
        db.query(User)
        .options(joinedload(User.credential))
        .filter(User.id == current_user.id)
        .first()
    )
    return db_user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int, 
    user: UserUpdate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user (profile info only) - Users can only update their own profile"""
    # Check if user is updating their own profile
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You can only update your own profile"
        )
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    if user.email:
        # Check if email already exists (excluding current user)
        existing_user = db.query(User).filter(User.email == user.email, User.id != user_id).first()
        if existing_user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        db_user.email = user.email
    
    # Update profile fields
    if user.firstName is not None:
        db_user.firstName = user.firstName
    if user.lastName is not None:
        db_user.lastName = user.lastName
    
    db_user.updatedAt = datetime.now()
    db.commit()
    db.refresh(db_user)
    # Eager load credential for response
    db_user = (
        db.query(User)
        .options(joinedload(User.credential))
        .filter(User.id == user_id)
        .first()
    )
    return db_user


@router.put("/{user_id}/approve", response_model=UserResponse)
async def approve_user(
    user_id: int,
    admin_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Approve a user (admin only)"""
    user = (
        db.query(User)
        .options(joinedload(User.credential))
        .filter(User.id == user_id)
        .first()
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user.isApproved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already approved"
        )
    
    # Approve the user
    user.isApproved = True
    db.commit()
    db.refresh(user)
    
    return user


@router.put("/{user_id}/reject", response_model=UserResponse)
async def reject_user(
    user_id: int,
    admin_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Reject/unapprove a user (admin only)"""
    user = (
        db.query(User)
        .options(joinedload(User.credential))
        .filter(User.id == user_id)
        .first()
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Reject the user
    user.isApproved = False
    db.commit()
    db.refresh(user)
    
    return user


@router.get("/pending", response_model=List[UserResponse])
async def get_pending_users(
    admin_user: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all pending approval users (admin only)"""
    users = (
        db.query(User)
        .options(joinedload(User.credential))
        .filter(User.isApproved == False)
        .filter(User.emailVerified == True)  # Only show verified users
        .offset(skip)
        .limit(limit)
        .all()
    )
    return users


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete user (credential and related data will be cascade deleted)"""
    # Check if user is deleting their own account or has admin rights
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own account"
        )
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Delete user - cascade will automatically delete:
    # - Credential (via ondelete="CASCADE")
    # - ChatUser entries (via ondelete="CASCADE")
    # - ChatMessage entries (via ondelete="CASCADE")
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully"}
