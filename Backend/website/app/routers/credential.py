"""
Credential routes - Authentication credentials management (separated for security)
"""
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models import User, Credential
from app.schemas.credential import (
    CredentialCreate, 
    CredentialUpdate, 
    CredentialResponse,
    ChangePasswordRequest,
    ChangePasswordResponse
)
from app.dependencies import get_current_user
from app.utils.password import hash_password, verify_password

router = APIRouter(prefix="/credentials", tags=["credentials"])


@router.get("/me", response_model=CredentialResponse)
async def get_my_credential(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's credential"""
    credential = db.query(Credential).filter(Credential.userId == current_user.id).first()
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found"
        )
    return credential


@router.put("/me", response_model=CredentialResponse)
async def update_my_credential(
    credential: CredentialUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's credential"""
    db_credential = db.query(Credential).filter(Credential.userId == current_user.id).first()
    
    if not db_credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found"
        )
    
    # Update username
    if credential.username is not None:
        # Check if username already exists (excluding current user)
        existing_credential = db.query(Credential).filter(
            Credential.username == credential.username,
            Credential.userId != current_user.id
        ).first()
        if existing_credential:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        db_credential.username = credential.username
    
    # Update password
    if credential.password is not None:
        # Hash new password (async, non-blocking)
        db_credential.password = await hash_password(credential.password)
    
    db_credential.updatedAt = datetime.now()
    db.commit()
    db.refresh(db_credential)
    return db_credential


@router.post("/change-password", response_model=ChangePasswordResponse)
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change password - requires old password verification
    
    This endpoint requires:
    - Authentication (Bearer token)
    - Old password verification
    - New password (minimum 6 characters)
    """
    # Get current user's credential
    db_credential = db.query(Credential).filter(Credential.userId == current_user.id).first()
    
    if not db_credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found"
        )
    
    # Verify old password
    is_valid = await verify_password(password_data.old_password, db_credential.password)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    # Check if new password is different from old password
    if password_data.old_password == password_data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password"
        )
    
    # Hash new password (async, non-blocking)
    hashed_new_password = await hash_password(password_data.new_password)
    
    # Update password
    db_credential.password = hashed_new_password
    db_credential.updatedAt = datetime.now()
    db.commit()
    
    return ChangePasswordResponse(
        message="Password changed successfully",
        success=True
    )


@router.delete("/me")
async def delete_my_credential(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete current user's credential (this will prevent login)"""
    db_credential = db.query(Credential).filter(Credential.userId == current_user.id).first()
    if not db_credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found"
        )
    
    db.delete(db_credential)
    db.commit()
    return {"message": "Credential deleted successfully"}
