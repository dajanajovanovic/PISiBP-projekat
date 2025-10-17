from pydantic import BaseModel
from typing import Any

class AnswerIn(BaseModel):
    question_id: int
    value: Any

class SubmitIn(BaseModel):
    form_id: int
    answers: list[AnswerIn]

class AnswerOut(BaseModel):
    question_id: int
    value: Any

class ResponseOut(BaseModel):
    id: int
    form_id: int
    answers: list[AnswerOut]
    class Config: from_attributes = True
