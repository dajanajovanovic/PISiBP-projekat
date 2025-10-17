import pytest
from app.main import fetch_form_meta
import app.main as m

class DummyResp:
    def __init__(self, status_code=200, json_data=None, text=""):
        self.status_code = status_code
        self._json = json_data or {}
        self.text = text
    def json(self):
        return self._json

class DummyAsyncClient:
    def __init__(self, seq, *args, **kwargs):
        self._seq = iter(seq)
    async def __aenter__(self):
        return self
    async def __aexit__(self, exc_type, exc, tb):
        pass
    async def get(self, url):
        return next(self._seq)

@pytest.mark.asyncio
async def test_fetch_form_meta_ok(monkeypatch):
    seq = [
        DummyResp(status_code=404, json_data={}, text="not found"),
        DummyResp(status_code=200, json_data={"id": 1, "is_locked": False, "allow_anonymous": True, "questions": []}),
    ]

    def _factory(*args, **kwargs):
        return DummyAsyncClient(seq, *args, **kwargs)

    monkeypatch.setattr(m.httpx, "AsyncClient", _factory)

    data = await fetch_form_meta(1)
    assert data["id"] == 1
    assert data["is_locked"] is False
    assert data["allow_anonymous"] is True
    assert data["questions"] == []
