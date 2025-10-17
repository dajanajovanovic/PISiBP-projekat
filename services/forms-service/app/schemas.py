from typing import Any, Literal
from pydantic import BaseModel, Field, field_validator

# ---- Tipovi ----
QuestionType = Literal[
    "short_text",
    "long_text",
    "single_choice",
    "multi_choice",
    "numeric",
    "date",
    "time",
]

# ---- Question In/Out ----
class QuestionIn(BaseModel):
    text: str = Field(min_length=1, max_length=512)
    type: QuestionType
    required: bool = False
    order_index: int | None = None
    image_url: str | None = None
    options_json: dict[str, Any] | None = None

    # Tolerantno: prihvati i JSON string pa ga pretvori u dict
    @field_validator("options_json", mode="before")
    @classmethod
    def _parse_options_in(cls, v: Any):
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except Exception:
                # ako je loš string, pošalji klijentu jasnu grešku
                raise ValueError("options_json must be a valid JSON object")
        return v


class QuestionOut(QuestionIn):
    id: int

    # Kada čitamo iz ORM-a gde je kolona TEXT, pretvori string -> dict
    @field_validator("options_json", mode="before")
    @classmethod
    def _parse_options_out(cls, v: Any):
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except Exception:
                return None
        return v

    class Config:
        from_attributes = True  # pydantic v2 (zamena za orm_mode)


# ---- Form modeli ----
class FormCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    allow_anonymous: bool = True
    is_locked: bool = False
    questions: list[QuestionIn] = Field(default_factory=list)


class FormUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    allow_anonymous: bool | None = None
    is_locked: bool | None = None


class FormOut(BaseModel):
    id: int
    owner_email: str
    name: str
    description: str
    allow_anonymous: bool
    is_locked: bool
    questions: list[QuestionOut] = Field(default_factory=list)

    class Config:
        from_attributes = True


class CollaboratorIn(BaseModel):
    email: str
    role: Literal["viewer", "editor"]


class CollaboratorOut(CollaboratorIn):
    id: int

    class Config:
        from_attributes = True


class FormMeta(BaseModel):
    id: int
    allow_anonymous: bool
    is_locked: bool
    questions: list[QuestionOut] = Field(default_factory=list)

    class Config:
        from_attributes = True
