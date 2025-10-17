from app.main import get_choices, _safe_decode

def test_get_choices_supports_both_keys():
    assert get_choices({"choices":["A","B"]}) == ["A","B"]
    assert get_choices({"options":["A","B"]}) == ["A","B"]
    assert get_choices(None) == []

def test_safe_decode_json_and_list_to_csv():
    assert _safe_decode('["a","b"]') == "a, b"
    assert _safe_decode('"x"') == "x"
    assert _safe_decode(None) == ""
    # već string ostaje
    assert _safe_decode("plain") == "plain"
