from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timedelta
from .settings import settings

security = HTTPBearer()

SECRET_KEY = settings.SECRET_KEY if hasattr(settings, 'SECRET_KEY') else "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    # First, try decoding tokens issued by our backend
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if username:
            return username
    except JWTError:
        pass

    # Next, try decoding Supabase tokens if configured
    supabase_secret = getattr(settings, "SUPABASE_JWT_SECRET", "")
    if supabase_secret:
        try:
            payload = jwt.decode(token, supabase_secret, algorithms=[ALGORITHM])
            # Supabase includes 'email' claim; fall back to 'sub' (user id)
            email = payload.get("email")
            identity = email or payload.get("sub")
            if not identity:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

            # Allowlist check if configured
            allowed = getattr(settings, "ALLOWED_EMAILS", "")
            if allowed:
                allowed_set = {e.strip().lower() for e in allowed.split(",") if e.strip()}
                if not email or email.lower() not in allowed_set:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not authorized")

            return identity
        except JWTError:
            pass

    # If neither decoding succeeded
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")

def verify_credentials(username: str, password: str) -> bool:
    """Verify username and password against environment variables"""
    correct_username = settings.AUTH_USERNAME if hasattr(settings, 'AUTH_USERNAME') else "admin"
    correct_password = settings.AUTH_PASSWORD if hasattr(settings, 'AUTH_PASSWORD') else "admin"
    return username == correct_username and password == correct_password
