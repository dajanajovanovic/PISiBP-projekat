from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)

def test_register_and_login():
    r = c.post("/register", json={"email":"a@example.com","full_name":"A B","password":"pass1234"})
    assert r.status_code in (201,409)  # may run twice
    r = c.post("/login?email=a@example.com&password=pass123")
    assert r.status_code == 200
    token = r.json()["access_token"]
    r = c.get("/me", headers={"Authorization": "Bearer " + token})
    assert r.status_code == 200
    assert r.json()["email"] == "a@example.com"
