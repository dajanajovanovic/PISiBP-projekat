import pytest
from fastapi import HTTPException
from app.main import validate_question_payload
from app.schemas import QuestionIn

def test_validate_single_choice_ok():
    q = QuestionIn(text="Device", type="single_choice", required=True,
                   options_json={"choices": ["Laptop","Phone"]})
    # ne diže izuzetak
    validate_question_payload(q)

def test_validate_single_choice_missing_choices():
    q = QuestionIn(text="Device", type="single_choice", required=True,
                   options_json={})
    with pytest.raises(HTTPException):
        validate_question_payload(q)

def test_validate_numeric_list_ok():
    q = QuestionIn(text="Rate", type="numeric", options_json={"list":[1,2,3]})
    validate_question_payload(q)

def test_validate_numeric_range_invalid_step():
    q = QuestionIn(text="Age", type="numeric", options_json={"range":{"start":0,"end":10,"step":0}})
    with pytest.raises(HTTPException):
        validate_question_payload(q)

