from app.schemas import QuestionIn

def test_options_json_str_is_parsed_to_dict():
    q = QuestionIn(
        text="Tech",
        type="multi_choice",
        options_json='{"choices": ["Python","Java"], "required_count": 0}'
    )
    assert isinstance(q.options_json, dict)
    assert q.options_json["choices"] == ["Python", "Java"]

