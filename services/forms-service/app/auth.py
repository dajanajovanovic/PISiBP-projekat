from fastapi import Header, HTTPException, status, Request
from jose import jwt, JWTError
from .config import JWT_SECRET

async def get_user_email(request: Request, authorization: str | None = Header(None)) -> str:
    token = authorization or request.headers.get("Authorization") or request.query_params.get("authorization")
    if not token: raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    token = token.strip()
    if token.lower().startswith("bearer "): token = token.split(" ",1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    sub = payload.get("sub")
    if not sub: raise HTTPException(401, "Invalid token payload")
    return sub
