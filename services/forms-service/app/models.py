from sqlalchemy import Integer, String, Boolean, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base

class Form(Base):
    __tablename__ = "forms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_email: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    allow_anonymous: Mapped[bool] = mapped_column(Boolean, default=True)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    questions: Mapped[list["Question"]] = relationship(back_populates="form", cascade="all, delete-orphan")
    collaborators: Mapped[list["Collaborator"]] = relationship(back_populates="form", cascade="all, delete-orphan")

class Question(Base):
    __tablename__ = "questions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id"))
    text: Mapped[str] = mapped_column(String(512))
    type: Mapped[str] = mapped_column(String(32))
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, index=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    options_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    form: Mapped["Form"] = relationship(back_populates="questions")

class Collaborator(Base):
    __tablename__ = "collaborators"
    __table_args__ = (UniqueConstraint("form_id", "email", name="uq_form_collab"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    form_id: Mapped[int] = mapped_column(ForeignKey("forms.id"))
    email: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16), default="viewer")  # viewer/editor
    form: Mapped["Form"] = relationship(back_populates="collaborators")
