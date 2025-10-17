from sqlalchemy import Integer, String, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base

class Response(Base):
    __tablename__ = "responses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    form_id: Mapped[int] = mapped_column(Integer, index=True)
    answers: Mapped[list["Answer"]] = relationship(back_populates="response", cascade="all, delete-orphan")

class Answer(Base):
    __tablename__ = "answers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("responses.id"))
    question_id: Mapped[int] = mapped_column(Integer, index=True)
    value: Mapped[str] = mapped_column(Text)
    response: Mapped["Response"] = relationship(back_populates="answers")
