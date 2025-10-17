from fastapi.testclient import TestClient
from app.main import app
from jose import jwt

c = TestClient(app)
TOKEN = jwt.encode({"sub":"a@example.com"}, "devsecret123", algorithm="HS256")

def test_create_form():
    payload = {"name":"Test","description":"Desc","allow_anonymous":True,"questions":[{"text":"Ime?","type":"short_text","required":True}]}
    r = c.post("/forms", json=payload, headers={"Authorization":"Bearer "+TOKEN})
    assert r.status_code == 201
    fid = r.json()["id"]
    r2 = c.get(f"/forms/{fid}", headers={"Authorization":"Bearer "+TOKEN})
    assert r2.status_code == 200
