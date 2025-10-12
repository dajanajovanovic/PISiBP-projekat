from fastapi import FastAPI, HTTPException, Depends, status, Header, Query, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from .config import JWT_SECRET, CORS_ORIGINS
from .db import Base, engine, SessionLocal
from .models import User
from .schemas import UserCreate, UserOut, UserUpdate, Token
from .security import hash_password, verify_password

app = FastAPI(
    title="Auth Service",
    version="0.3.0",
    servers=[{"url": "http://localhost:8001"}],                 # Swagger neka koristi tačan http URL
    swagger_ui_parameters={"persistAuthorization": True},        # zadrži token u UI
)

# CORS – za dev ok ovako; ako ti trebaju cookies, stavi eksplicitne origene i allow_credentials=True
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if CORS_ORIGINS == ["*"] else CORS_ORIGINS,
    allow_credentials=False,     # IMPORTANT: ne mešati "*" sa True
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

# --------------------------
# DB session
# --------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --------------------------
# Auth helpers (Bearer security) + admin guard
# --------------------------
security = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
) -> User:
    # Uzmi token ili iz Swagger "Authorize" (HTTPBearer) ili direktno iz Authorization header-a
    token = None
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials
    elif authorization and authorization.lower().startswith("bearer "):
        token = authorization.split()[1]

    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    u = db.execute(select(User).where(User.email == payload.get("sub"))).scalar_one_or_none()
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return u

def require_admin(u: User = Depends(get_current_user)) -> User:
    if getattr(u, "role", "user") != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return u

# --------------------------
# Health
# --------------------------
@app.get("/health")
def health():
    return {"status": "ok"}

# --------------------------
# Auth
# --------------------------
@app.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserOut)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.execute(select(User).where(User.email == user_in.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email is already registered")
    u = User(email=user_in.email, full_name=user_in.full_name, hashed_password=hash_password(user_in.password))
    db.add(u)
    db.commit()
    db.refresh(u)
    return u

@app.post("/login", response_model=Token)
def login(email: str = Query(...), password: str = Query(...), db: Session = Depends(get_db)):
    u = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if not u or not verify_password(password, u.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    token = jwt.encode({"sub": u.email, "uid": u.id, "name": u.full_name}, JWT_SECRET, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer"}

@app.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)):
    return current

# Self update (bez admin prava)
@app.put("/me", response_model=UserOut)
def update_me(me_in: UserUpdate, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    if me_in.email and me_in.email != me.email:
        if db.execute(select(User).where(User.email == me_in.email)).scalar_one_or_none():
            raise HTTPException(status.HTTP_409_CONFLICT, "Email is already registered")
        me.email = me_in.email
    if me_in.full_name is not None:
        me.full_name = me_in.full_name
    if me_in.password is not None:
        me.hashed_password = hash_password(me_in.password)
    db.add(me); db.commit(); db.refresh(me)
    return me

# --------------------------
# CRUD korisnika (samo admin)
# --------------------------
@app.get("/users", response_model=list[UserOut])
def list_users(skip: int = 0, limit: int = 50, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    users = db.execute(select(User).offset(skip).limit(limit)).scalars().all()
    return users

@app.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return u

@app.post("/users", status_code=status.HTTP_201_CREATED, response_model=UserOut)
def create_user(user_in: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.execute(select(User).where(User.email == user_in.email)).scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email is already registered")
    u = User(email=user_in.email, full_name=user_in.full_name, hashed_password=hash_password(user_in.password))
    db.add(u); db.commit(); db.refresh(u)
    return u

@app.put("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, user_in: UserUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user_in.email and user_in.email != u.email:
        if db.execute(select(User).where(User.email == user_in.email)).scalar_one_or_none():
            raise HTTPException(status.HTTP_409_CONFLICT, "Email is already registered")
        u.email = user_in.email
    if user_in.full_name is not None:
        u.full_name = user_in.full_name
    if user_in.password is not None:
        u.hashed_password = hash_password(user_in.password)
    db.add(u); db.commit(); db.refresh(u)
    return u

@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    db.delete(u); db.commit()
    return None
