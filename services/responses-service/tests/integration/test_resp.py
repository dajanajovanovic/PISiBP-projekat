from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)

def test_submit_and_list():
    sub = {"form_id": 1, "answers":[{"question_id":10,"value":"A"},{"question_id":11,"value":["X","Y"]}]}
    r = c.post("/submit", json=sub)
    assert r.status_code == 201
    rid = r.json()["id"]
    r2 = c.get("/forms/1/responses")
    assert r2.status_code == 200
    assert any(x["id"]==rid for x in r2.json())
