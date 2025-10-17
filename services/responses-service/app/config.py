import os
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS","*").split(",")]
DATABASE_URL = os.getenv("DATABASE_URL","sqlite:///./resp.db")
FORMS_API = "http://forms-service:8000"

