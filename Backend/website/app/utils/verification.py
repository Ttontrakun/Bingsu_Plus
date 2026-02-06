"""
Email verification utilities
"""
import secrets


def generate_verification_token() -> str:
    """Generate a secure verification token"""
    return secrets.token_urlsafe(32)
