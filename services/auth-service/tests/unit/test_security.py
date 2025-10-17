from app.security import hash_password, verify_password

def test_hash_and_verify_password_ok():
    h = hash_password("pass1234")
    assert h != "pass1234"
    assert verify_password("pass1234", h) is True

def test_verify_password_wrong():
    h = hash_password("pass1234")
    assert verify_password("wrong", h) is False
