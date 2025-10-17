from app.main import _to_db_options

def test_to_db_options_dict_list_to_json_string():
    assert _to_db_options({"a": 1}) == '{"a": 1}'
    assert _to_db_options(["x","y"]) == '["x", "y"]'
    assert _to_db_options(None) is None
    assert _to_db_options('{"keep":"as-is"}') == '{"keep":"as-is"}'

