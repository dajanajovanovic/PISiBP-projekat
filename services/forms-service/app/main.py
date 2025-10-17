import json
from typing import List

from fastapi import FastAPI, Depends, HTTPException, status, Query  # ← +Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_  # ← +or_

from .config import CORS_ORIGINS
from .db import Base, engine, SessionLocal
from .models import Form, Question, Collaborator
from .schemas import (
    FormCreate, FormOut, FormUpdate,
    QuestionIn, QuestionOut,
    CollaboratorIn, CollaboratorOut,
    FormMeta,
)
from .auth import get_user_email

app = FastAPI(
    title="Forms Service",
    version="0.2.2",
    servers=[{"url": "http://localhost:8002"}],
    swagger_ui_parameters={"persistAuthorization": True},
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

# -----------------------
# DB session
# -----------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -----------------------
# Helpers
# -----------------------
def _to_db_options(v):
    """DB kolona je TEXT -> upisujemo JSON string; prihvatamo i već-string."""
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    return v  # već string

@app.get("/health")
def health():
    return {"status": "ok"}

def is_owner(form: Form, email: str) -> bool:
    return form.owner_email == email

def can_edit(form: Form, email: str, db: Session) -> bool:
    if is_owner(form, email):
        return True
    coll = db.execute(select(Collaborator).where(
        Collaborator.form_id == form.id,
        Collaborator.email == email
    )).scalar_one_or_none()
    return bool(coll and coll.role == "editor")

def can_view(form: Form, email: str | None, db: Session) -> bool:
    if is_owner(form, email or ""):
        return True
    if email:
        coll = db.execute(select(Collaborator).where(
            Collaborator.form_id == form.id,
            Collaborator.email == email
        )).scalar_one_or_none()
        if coll:
            return True
    return form.allow_anonymous

def validate_question_payload(q: QuestionIn):
    # zajednička pravila
    if q.type == "single_choice":
        if not q.options_json or "choices" not in q.options_json:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "single_choice requires options_json.choices")
        if not isinstance(q.options_json["choices"], list) or not q.options_json["choices"]:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "choices must be non-empty list")

    if q.type == "multi_choice":
        if not q.options_json or "choices" not in q.options_json:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "multi_choice requires options_json.choices")
        if not isinstance(q.options_json["choices"], list) or not q.options_json["choices"]:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "choices must be non-empty list")
        rc = q.options_json.get("required_count")
        if rc is not None and (not isinstance(rc, int) or rc < 0):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "required_count must be >= 0")

    if q.type == "numeric":
        oj = q.options_json or {}
        if "list" not in oj and "range" not in oj:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "numeric requires options_json.list or options_json.range")
        if "list" in oj:
            if not isinstance(oj["list"], list) or not oj["list"]:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "numeric list must be non-empty list")
            if any(not isinstance(x, (int, float)) for x in oj["list"]):
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "numeric list must contain only numbers")
        if "range" in oj:
            r = oj["range"]
            if not isinstance(r, dict) or not all(k in r for k in ("start", "end", "step")):
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "range requires start,end,step")
            if not isinstance(r["step"], (int, float)) or r["step"] == 0:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "range.step must be non-zero number")

# -----------------------
# Forms
# -----------------------
@app.post("/forms", response_model=FormOut, status_code=201)
def create_form(
    payload: FormCreate,
    user_email: str = Depends(get_user_email),
    db: Session = Depends(get_db)
):
    f = Form(
        owner_email=user_email,
        name=payload.name,
        description=payload.description or "",
        allow_anonymous=payload.allow_anonymous,
        is_locked=payload.is_locked,
    )
    db.add(f)
    db.flush()

    order = 0
    for q in payload.questions:
        validate_question_payload(q)
        db.add(Question(
            form_id=f.id,
            text=q.text,
            type=q.type,
            required=q.required,
            order_index=q.order_index if q.order_index is not None else order,
            image_url=q.image_url,
            options_json=_to_db_options(q.options_json),
        ))
        order += 1

    db.commit()
    db.refresh(f)
    return f

@app.get("/forms", response_model=List[FormOut])
def list_forms(
    q: str | None = None,
    user_email: str = Depends(get_user_email),
    db: Session = Depends(get_db)
):
    stmt = select(Form).where(
        (Form.owner_email == user_email) |
        (Form.id.in_(select(Collaborator.form_id).where(Collaborator.email == user_email)))
    )
    if q:
        stmt = stmt.where(func.lower(Form.name).like(f"%{q.lower()}%"))
    return db.execute(stmt.order_by(Form.id.desc())).scalars().all()

# -----------------------
# Public forms listing (guest search by name)
# gosti vide samo ne-zaključane forme; pretraga po name (i po želji description)
# -----------------------
@app.get("/forms/public", response_model=List[FormOut])
def list_public_forms(
    q: str | None = Query(None, description="Search public forms by name or description"),
    db: Session = Depends(get_db),
):
    # Prikaži samo javne (nezaključane) forme
    stmt = select(Form).where(Form.is_locked == False)

    # Ako postoji upit, pretraži po imenu ili opisu
    if q:
        ql = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Form.name).like(ql),
                func.lower(func.coalesce(Form.description, '')).like(ql)  # sigurno i kad je NULL
            )
        )

    stmt = stmt.order_by(Form.id.desc())
    forms = db.execute(stmt).scalars().all()
    return forms
    
@app.get("/my/forms", response_model=List[FormOut])
def my_forms(
    user_email: str = Depends(get_user_email),
    db: Session = Depends(get_db)
):
    stmt = select(Form).where(
        (Form.owner_email == user_email) |
        (Form.id.in_(select(Collaborator.form_id).where(Collaborator.email == user_email)))
    )
    return db.execute(stmt.order_by(Form.id.desc())).scalars().all()

@app.get("/forms/{form_id}", response_model=FormOut)
def get_form(
    form_id: int,
    user_email: str | None = Depends(get_user_email),
    db: Session = Depends(get_db)
):
    f = db.get(Form, form_id)
    if not f:
        raise HTTPException(404, "Not found")
    if not can_view(f, user_email, db):
        raise HTTPException(403, "Forbidden")
    return f

@app.put("/forms/{form_id}", response_model=FormOut)
def update_form(
    form_id: int,
    payload: FormUpdate,
    user_email: str = Depends(get_user_email),
    db: Session = Depends(get_db)
):
    f = db.get(Form, form_id)
    if not f:
        raise HTTPException(404, "Not found")
    if not can_edit(f, user_email, db):
        raise HTTPException(403, "Forbidden")

    if payload.name is not None:
        f.name = payload.name
    if payload.description is not None:
        f.description = payload.description
    if payload.allow_anonymous is not None:
        f.allow_anonymous = payload.allow_anonymous
    if payload.is_locked is not None:
        f.is_locked = payload.is_locked

    db.add(f)
    db.commit()
    db.refresh(f)
    return f

@app.delete("/forms/{form_id}", status_code=204)
def delete_form(
    form_id: int,
    user_email: str = Depends(get_user_email),
    db: Session = Depends(get_db)
):
    f = db.get(Form, form_id)
    if not f:
        raise HTTPException(404, "Not found")

    # Samo vlasnik sme da briše celu formu
    if not is_owner(f, user_email):
        raise HTTPException(403, "Only owner can delete the form")

    # Obrisi povezana pitanja
    qs = db.execute(select(Question).where(Question.form_id == form_id)).scalars().all()
    for q in qs:
        db.delete(q)

    # Obrisi kolaboratore
    cs = db.execute(select(Collaborator).where(Collaborator.form_id == form_id)).scalars().all()
    for c in cs:
        db.delete(c)

    # Na kraju obriši i samu formu
    db.delete(f)
    db.commit()
    return None

# ======== DODATNO: DEMO FORMA SA SVIM TIPOVIMA & ZATVARANJE ========

def _q_payload(text, qtype, required=False, order_index=None, image_url=None, options_json=None):
    """Pomoćni konstruktor dict-a koji liči na QuestionIn."""
    return {
        "text": text,
        "type": qtype,              # 'short_text' | 'long_text' | 'single_choice' | 'multi_choice' | 'numeric' | 'date' | 'time'
        "required": required,
        "order_index": order_index,
        "image_url": image_url,
        "options_json": options_json or None
    }

@app.post("/forms/demo/all-types", response_model=FormOut, status_code=201)
def create_all_types_demo_form(
    user_email: str = Depends(get_user_email),
    db: Session = Depends(get_db),
):
    """
    Kreira formu sa svim tipovima pitanja radi testiranja API-ja.
    """
    # 1) Kreiraj praznu formu
    f = Form(
        owner_email=user_email,
        name="All Types Demo Form",
        description="Automatski generisan formular sa svim tipovima pitanja.",
        allow_anonymous=True,
        is_locked=False,
    )
    db.add(f)
    db.flush()

    # 2) Pripremi pitanja (po jedno po tipu)
    #   single_choice / multi_choice zahtevaju options_json.choices (lista)
    #   numeric zahtev: options_json.list (lista brojeva) ILI options_json.range {start,end,step}
    questions_payload = [
        _q_payload("Unesite ime i prezime", "short_text", required=True,  order_index=0),
        _q_payload("Napišite kratak bio",   "long_text",  required=False, order_index=1),

        _q_payload(
            "Primarni uređaj", "single_choice", required=True, order_index=2,
            options_json={"choices": ["Laptop", "Desktop", "Tablet", "Telefon"]}
        ),

        _q_payload(
            "Koje tehnologije koristite?", "multi_choice", required=False, order_index=3,
            options_json={"choices": ["Python", "Java", "C#", "JavaScript"], "required_count": 0}
        ),

        _q_payload(
            "Ocena zadovoljstva (1–5)", "numeric", required=False, order_index=4,
            options_json={"list": [1, 2, 3, 4, 5]}
        ),
        # ili alternativa sa opsegom:
        # _q_payload("Godine starosti", "numeric", True, 4, options_json={"range": {"start": 0, "end": 120, "step": 1}}),

        _q_payload("Izaberite datum", "date", required=False, order_index=5),
        _q_payload("Izaberite vreme", "time", required=False, order_index=6),
    ]

    # 3) Validacija i upis pitanja
    for qp in questions_payload:
        # Reuse postojeće Pydantic šeme i validatora
        q_model = QuestionIn(**qp)
        validate_question_payload(q_model)

        db.add(Question(
            form_id=f.id,
            text=q_model.text,
            type=q_model.type,
            required=q_model.required,
            order_index=q_model.order_index if q_model.order_index is not None else 0,
            image_url=q_model.image_url,
            options_json=_to_db_options(q_model.options_json),
        ))

    db.commit()
    db.refresh(f)
    return f


@app.post("/forms/{form_id}/close", response_model=FormOut)
def close_form(
    form_id: int,
    user_email: str = Depends(get_user_email),
    db: Session = Depends(get_db),
):
    """
    'Zatvara' formu -> postavlja is_locked=True (samo vlasnik ili editor).
    Napomena: Ako želiš da SAMO vlasnik sme da zatvara, zameni can_edit sa is_owner.
    """
    f = db.get(Form, form_id)
    if not f:
        raise HTTPException(404, "Not found")

    if not can_edit(f, user_email, db):
        raise HTTPException(403, "Forbidden")

    f.is_locked = True
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


# -----------------------
# Questions
# -----------------------
@app.post("/forms/{form_id}/questions", response_model=QuestionOut, status_code=201)
def add_question(
    form_id: int,
    q: QuestionIn,
    user_email: str = Depends(get_user_email),
    db: Session = Depends(get_db)
):
    f = db.get(Form, form_id)
    if not f:
        raise HTTPException(404, "Not found")
    if not can_edit(f, user_email, db):
        raise HTTPException(403, "Forbidden")

    validate_question_payload(q)

    max_order = max([qq.order_index for qq in f.questions], default=-1)
    qq = Question(
        form_id=form_id,
        text=q.text,
        type=q.type,
        required=q.required,
        order_index=q.order_index if q.order_index is not None else max_order + 1,
        image_url=q.image_url,
        options_json=_to_db_options(q.options_json),
    )
    db.add(qq)
    db.commit()
    db.refresh(qq)
    return qq

@app.put("/forms/{form_id}/questions/{question_id}", response_model=QuestionOut)
def update_question(
    form_id: int,
    question_id: int,
    q: QuestionIn,
    user_email: str = Depends(get_user_email),
    db: Session = Depends(get_db)
):
    f = db.get(Form, form_id)
    if not f:
        raise HTTPException(404, "Not found")
    if not can_edit(f, user_email, db):
        raise HTTPException(403, "Forbidden")

    validate_question_payload(q)

    qq = db.get(Question, question_id)
    if not qq or qq.form_id != form_id:
        raise HTTPException(404, "Question not found")

    qq.text = q.text
    qq.type = q.type
    qq.required = q.required
    if q.order_index is not None:
        qq.order_index = q.order_index
    qq.image_url = q.image_url
    qq.options_json = _to_db_options(q.options_json)
    db.add(qq)
    db.commit()
    db.refresh(qq)
    return qq

@app.delete("/forms/{form_id}/questions/{question_id}", status_code=204)
def delete_question(
    form_id: int,
    question_id: int,
    user_email: str = Depends(get_user_email),
    db: Session = Depends(get_db)
):
    f = db.get(Form, form_id)
    if not f:
        raise HTTPException(404, "Not found")
    if not can_edit(f, user_email, db):
        raise HTTPException(403, "Forbidden")

    qq = db.get(Question, question_id)
    if not qq or qq.form_id != form_id:
        raise HTTPException(404, "Question not found")

    db.delete(qq)
    db.commit()
    return None

@app.post("/forms/{form_id}/questions/{question_id}/clone", response_model=QuestionOut, status_code=201)
def clone_question(
    form_id: int,
    question_id: int,
    user_email: str = Depends(get_user_email),
    db: Session = Depends(get_db)
):
    f = db.get(Form, form_id)
    if not f:
        raise HTTPException(404, "Not found")
    if not can_edit(f, user_email, db):
        raise HTTPException(403, "Forbidden")

    src = db.get(Question, question_id)
    if not src or src.form_id != form_id:
        raise HTTPException(404, "Question not found")

    max_order = max([qq.order_index for qq in f.questions], default=-1)
    clone = Question(
        form_id=form_id,
        text=src.text,
        type=src.type,
        required=src.required,
        order_index=max_order + 1,
        image_url=src.image_url,
        options_json=_to_db_options(src.options_json),
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return clone

@app.post("/forms/{form_id}/reorder", response_model=FormOut)
def reorder(
    form_id: int,
    order: List[int],
    user_email: str = Depends(get_user_email),
    db: Session = Depends(get_db)
):
    f = db.get(Form, form_id)
    if not f:
        raise HTTPException(404, "Not found")
    if not can_edit(f, user_email, db):
        raise HTTPException(403, "Forbidden")

    qmap = {q.id: q for q in f.questions}
    for idx, qid in enumerate(order):
        if qid in qmap:
            qmap[qid].order_index = idx
    db.commit()
    db.refresh(f)
    return f

# -----------------------
# Collaborators
# -----------------------
@app.get("/forms/{form_id}/collaborators", response_model=List[CollaboratorOut])
def list_collaborators(
    form_id: int,
    user_email: str = Depends(get_user_email),
    db: Session = Depends(get_db)
):
    f = db.get(Form, form_id)
    if not f:
        raise HTTPException(404, "Not found")
    if not is_owner(f, user_email):
        raise HTTPException(403, "Only owner manages collaborators")
    return db.execute(select(Collaborator).where(Collaborator.form_id == form_id)).scalars().all()

@app.post("/forms/{form_id}/collaborators", response_model=CollaboratorOut, status_code=201)
def add_collaborator(
    form_id: int,
    body: CollaboratorIn,
    user_email: str = Depends(get_user_email),
    db: Session = Depends(get_db)
):
    f = db.get(Form, form_id)
    if not f:
        raise HTTPException(404, "Not found")
    if not is_owner(f, user_email):
        raise HTTPException(403, "Only owner manages collaborators")
    if body.email == f.owner_email:
        raise HTTPException(409, "Owner already has full access")

    c = Collaborator(form_id=form_id, email=body.email, role=body.role)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

@app.delete("/forms/{form_id}/collaborators/{collab_id}", status_code=204)
def delete_collaborator(
    form_id: int,
    collab_id: int,
    user_email: str = Depends(get_user_email),
    db: Session = Depends(get_db)
):
    f = db.get(Form, form_id)
    if not f:
        raise HTTPException(404, "Not found")
    if not is_owner(f, user_email):
        raise HTTPException(403, "Only owner manages collaborators")

    c = db.get(Collaborator, collab_id)
    if not c or c.form_id != form_id:
        raise HTTPException(404, "Collaborator not found")

    db.delete(c)
    db.commit()
    return None

# -----------------------
# Meta (public-ish)
# -----------------------
@app.get("/forms/{form_id}/meta", response_model=FormMeta)
def form_meta(
    form_id: int,
    db: Session = Depends(get_db)
):
    f = db.get(Form, form_id)
    if not f:
        raise HTTPException(404, "Not found")
    # zaključane forme ne izbacujemo javno
    if f.is_locked:
        raise HTTPException(404, "Not found")

    return FormMeta(
        id=f.id,
        allow_anonymous=f.allow_anonymous,
        is_locked=f.is_locked,
        questions=[
            QuestionOut(
                id=q.id,
                text=q.text,
                type=q.type,
                required=q.required,
                order_index=q.order_index,
                image_url=q.image_url,
                options_json=None if q.options_json is None else (
                    json.loads(q.options_json) if isinstance(q.options_json, str) else q.options_json
                ),
            )
            for q in sorted(f.questions, key=lambda x: x.order_index)
        ],
    )
