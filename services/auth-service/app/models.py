from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
import sqlalchemy as sa

from .db import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role = sa.Column(sa.String(20), nullable=False, server_default="user")  

