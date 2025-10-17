import json
import io
import traceback
import httpx

from fastapi import FastAPI, Depends, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select
from starlette.responses import StreamingResponse

from .config import CORS_ORIGINS, FORMS_API
from .db import Base, engine, SessionLocal
from .models import Response, Answer
from .schemas import SubmitIn, ResponseOut
import openpyxl
from httpx import RequestError

# ------------------------------------------------------
# FastAPI app + CORS
# ------------------------------------------------------
app = FastAPI(
    title="Responses Service",
    version="0.2.0",
    servers=[{"url": "http://localhost:8003"}],
    swagger_ui_parameters={"persistAuthorization": True},
)

allow_origins = (
    CORS_ORIGINS
    if CORS_ORIGINS and CORS_ORIGINS != ["*"]
    else ["http://localhost:5173", "http://127.0.0.1:5173"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ------------------------------------------------------
# Health
# ------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}

# ------------------------------------------------------
# Helpers
# ------------------------------------------------------
async def fetch_form_meta(form_id: int) -> dict:
    """
    Pokušaj /forms/{id}/meta; ako nije 200, fallback na /forms/{id}.
    Vraća JSON sa poljima: is_locked, allow_anonymous, questions, ...
    """
    url1 = f"{FORMS_API}/forms/{form_id}/meta"
    url2 = f"{FORMS_API}/forms/{form_id}"

    try:
        async with httpx.AsyncClient(timeout=5.0) as cx:
            r = await cx.get(url1)
            if r.status_code != 200:
                r = await cx.get(url2)
    except RequestError as e:
        raise HTTPException(status_code=502, detail=f"Forms service unreachable: {e}")

    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=(r.text or "Forms meta not available"))

    return r.json()

def get_choices(oj: dict | None) -> list:
    """Vrati listu izbora iz options_json (podržava 'choices' i 'options')."""
    if not isinstance(oj, dict):
        return []
    if isinstance(oj.get("choices"), list):
        return oj["choices"]
    if isinstance(oj.get("options"), list):
        return oj["options"]
    return []

def _safe_decode(val):
    """Pokušaj JSON decode; ako ne uspe, vrati originalni string.
       Liste pretvori u 'a, b, c' zbog Excela."""
    if val is None:
        return ""
    try:
        v = json.loads(val)
    except Exception:
        v = val
    if isinstance(v, list):
        return ", ".join(str(x) for x in v)
    return v

# ------------------------------------------------------
# Submit
# ------------------------------------------------------
@app.post("/submit", response_model=ResponseOut, status_code=201)
async def submit(
    body: SubmitIn,
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    try:
        # 1) meta (lock/anonymous i pitanja)
        meta = await fetch_form_meta(body.form_id)
        is_locked = bool(meta.get("is_locked"))
        allow_anonymous = bool(meta.get("allow_anonymous", True))
        questions = meta.get("questions") or []

        if is_locked:
            raise HTTPException(status.HTTP_423_LOCKED, detail="Form is locked")

        if not allow_anonymous:
            if not authorization or not authorization.lower().startswith("bearer "):
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Login required")

        # 2) mapa pitanja
        try:
            qmap = {int(q["id"]): q for q in questions}
        except Exception:
            raise HTTPException(422, detail="Malformed form meta: questions list")

        # 3) validacija odgovora
        for a in body.answers:
            q = qmap.get(a.question_id)
            if not q:
                raise HTTPException(422, detail=f"Unknown question {a.question_id}")

            v = a.value
            t = q.get("type")
            oj = q.get("options_json") or {}

            if t == "short_text":
                if not isinstance(v, str) or len(v) > 512:
                    raise HTTPException(422, detail="short_text max 512 chars")

            elif t == "long_text":
                if not isinstance(v, str) or len(v) > 4096:
                    raise HTTPException(422, detail="long_text max 4096 chars")

            elif t == "single_choice":
                choices = get_choices(oj)
                if v not in choices:
                    raise HTTPException(422, detail="single_choice invalid option")

            elif t == "multi_choice":
                choices = get_choices(oj)
                reqc = oj.get("required_count")
                if not isinstance(v, list) or any(x not in choices for x in v):
                    raise HTTPException(422, detail="multi_choice expects list of valid options")
                if isinstance(reqc, int) and len(v) < reqc:
                    raise HTTPException(422, detail=f"multi_choice requires at least {reqc} selections")

            elif t == "numeric":
                if "list" in oj and isinstance(oj["list"], list):
                    if v not in oj["list"]:
                        raise HTTPException(422, detail="numeric value not in list")
                elif "range" in oj and isinstance(oj["range"], dict):
                    st = int(oj["range"].get("start", 0))
                    en = int(oj["range"].get("end", 0))
                    step = int(oj["range"].get("step", 1) or 1)
                    try:
                        val = int(v)
                    except Exception:
                        raise HTTPException(422, detail="numeric expects integer")
                    ok = False
                    cur = st
                    if step == 0:
                        step = 1
                    while (step > 0 and cur <= en) or (step < 0 and cur >= en):
                        if val == cur:
                            ok = True
                            break
                        cur += step
                    if not ok:
                        raise HTTPException(422, detail="numeric value not in range/step")
                else:
                    # fallback: dozvoli broj
                    try:
                        int(v)
                    except Exception:
                        raise HTTPException(422, detail="numeric expects integer")

            elif t in ("date", "time"):
                if v in (None, ""):
                    raise HTTPException(422, detail=f"{t} required value")

            # required check
            if q.get("required") and (v is None or v == "" or v == []):
                raise HTTPException(422, detail=f"Question {q['id']} is required")

        # 4) upis u bazu
        r = Response(form_id=body.form_id)
        db.add(r)
        db.flush()
        for a in body.answers:
            db.add(Answer(response_id=r.id, question_id=a.question_id, value=json.dumps(a.value)))
        db.commit()
        db.refresh(r)

        return ResponseOut(
            id=r.id,
            form_id=r.form_id,
            answers=[{"question_id": a.question_id, "value": json.loads(a.value)} for a in r.answers],
        )

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, detail=f"Unhandled error in submit: {e}")

# ------------------------------------------------------
# Pregled odgovora / agregacije / export
# ------------------------------------------------------
@app.get("/forms/{form_id}/responses", response_model=list[ResponseOut])
def list_responses(form_id: int, db: Session = Depends(get_db)):
    rs = db.execute(select(Response).where(Response.form_id == form_id)).scalars().all()
    out = []
    for r in rs:
        out.append({
            "id": r.id,
            "form_id": r.form_id,
            "answers": [{"question_id": a.question_id, "value": json.loads(a.value)} for a in r.answers],
        })
    return out

@app.get("/forms/{form_id}/aggregate")
def aggregate(form_id: int, db: Session = Depends(get_db)):
    rs = db.execute(select(Response).where(Response.form_id == form_id)).scalars().all()
    agg: dict[int, dict] = {}
    for r in rs:
        for a in r.answers:
            try:
                val = json.loads(a.value)
            except Exception:
                val = a.value
            bucket = agg.setdefault(a.question_id, {})
            if isinstance(val, list):
                for v in val:
                    bucket[v] = bucket.get(v, 0) + 1
            else:
                bucket[val] = bucket.get(val, 0) + 1
    return agg
@app.get("/forms/{form_id}/export")
def export_xlsx(form_id: int, db: Session = Depends(get_db)):
    rs = db.execute(select(Response).where(Response.form_id == form_id)).scalars().all()

    import openpyxl

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"form_{form_id}"

    qids = sorted({a.question_id for r in rs for a in r.answers})
    ws.append(["response_id"] + [f"q{qid}" for qid in qids])

    for r in rs:
        amap = {a.question_id: a for a in r.answers}
        row = [r.id]
        for qid in qids:
            if qid not in amap:
                row.append("")
            else:
                row.append(_safe_decode(amap[qid].value))
        ws.append(row)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=form_{form_id}_responses.xlsx"},
    )