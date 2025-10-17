import pytest
from pydantic import ValidationError
from app.schemas import UserCreate

def test_user_create_valid():
    u = UserCreate(email="a@example.com", full_name="A B", password="pass1234")
    assert u.email == "a@example.com"

def test_user_create_invalid_email():
    with pytest.raises(ValidationError):
        UserCreate(email="not-an-email", full_name="A", password="x")

