import os
JWT_SECRET = os.getenv("JWT_SECRET","devsecret123")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS","*").split(",")]
DATABASE_URL = os.getenv("DATABASE_URL","sqlite:///./auth.db")
