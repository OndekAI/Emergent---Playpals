import os
from datetime import date, timedelta

import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")


@pytest.fixture(scope="session", autouse=True)
def validate_base_url():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL not provided")


@pytest.fixture(scope="session")
def session_token() -> str:
    token = os.environ.get("TEST_SESSION_TOKEN", "").strip()
    if not token:
        pytest.skip("TEST_SESSION_TOKEN not provided; skipping authenticated tests")
    return token


@pytest.fixture(scope="session")
def api_client(session_token: str):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {session_token}"})
    return s


# branding/metadata + root endpoint sanity
def test_api_root_branding_message():
    response = requests.get(f"{BASE_URL}/api/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "PlayPals API ready"
    assert "version" in data


# child profile supports age and grades boundaries
def test_children_grade_and_age_boundaries(api_client):
    low_payload = {
        "first_name": "TEST_LOW",
        "age": 3,
        "grade": "Pre-K",
        "interests": ["Art"],
        "allergies": "",
        "notes": "",
    }
    low = api_client.post(f"{BASE_URL}/api/children", json=low_payload)
    assert low.status_code == 200
    low_data = low.json()
    assert low_data["age"] == 3
    assert low_data["grade"] == "Pre-K"
    assert "_id" not in low_data

    high_payload = {
        "first_name": "TEST_HIGH",
        "age": 13,
        "grade": "Grade 7",
        "interests": ["Science"],
        "allergies": "",
        "notes": "",
    }
    high = api_client.post(f"{BASE_URL}/api/children", json=high_payload)
    assert high.status_code == 200
    high_data = high.json()
    assert high_data["age"] == 13
    assert high_data["grade"] == "Grade 7"
    assert "_id" not in high_data


# availability visibility mode persistence
def test_availability_visibility_mode_saved(api_client):
    target_date = (date.today() + timedelta(days=2)).isoformat()
    payload = {
        "date": target_date,
        "blocks": [{"start": "15:00", "end": "17:00"}],
        "recurrence": "once",
        "visibility_mode": "manual",
        "visible_to_parent_ids": ["sample_sarah"],
    }
    save = api_client.post(f"{BASE_URL}/api/availability", json=payload)
    assert save.status_code == 200
    save_data = save.json()
    assert save_data["count"] >= 1

    read = api_client.get(f"{BASE_URL}/api/availability")
    assert read.status_code == 200
    rows = read.json()
    target = next((r for r in rows if r["date"] == target_date), None)
    assert target is not None
    assert target["visibility_mode"] == "manual"
    assert target["visible_to_parent_ids"] == ["sample_sarah"]
    assert "_id" not in target


# dismissal endpoint creates suppression records
def test_match_dismiss_creates_record(api_client):
    dismiss = api_client.post(
        f"{BASE_URL}/api/matches/dismiss",
        json={"target_parent_id": "sample_sarah", "dismissal_type": "not_this_week"},
    )
    assert dismiss.status_code == 200
    data = dismiss.json()
    assert data["dismissal_type"] == "not_this_week"
    assert data["target_parent_id"] == "sample_sarah"
    assert "dismissal_id" in data
    assert "_id" not in data


# privacy checks for parent objects (no credits leakage / no mongo objectid)
def test_community_detail_parent_privacy_and_no_objectid(api_client):
    join = api_client.post(
        f"{BASE_URL}/api/communities/join",
        json={"community_id": "comm_mulgrave", "teacher_name": "Ms. Test", "child_grade": "Grade 1"},
    )
    assert join.status_code in (200, 201)

    detail = api_client.get(f"{BASE_URL}/api/communities/comm_mulgrave")
    assert detail.status_code == 200
    data = detail.json()
    assert "_id" not in data["community"]

    members = data.get("members", [])
    if members:
        parent = members[0]
        assert "credits" not in parent
        assert "_id" not in parent
        assert "tier" in parent


# chat opens on confirmed playdate and locks after completion
def test_chat_lock_after_playdate_completion(api_client):
    invitee_token = os.environ.get("TEST_INVITEE_SESSION_TOKEN", "").strip()
    if not invitee_token:
        pytest.skip("TEST_INVITEE_SESSION_TOKEN not provided")

    invitee = requests.Session()
    invitee.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {invitee_token}"})

    create_payload = {
        "type": "1:1",
        "invitee_parent_ids": ["sample_sarah"],
        "child_ids": [],
        "date": (date.today() + timedelta(days=5)).isoformat(),
        "start_time": "15:00",
        "end_time": "17:00",
        "location": "Neighborhood Park",
        "activity": "Free play",
        "notes": "",
        "min_confirmations": 1,
        "title": "TEST Chat Lock",
    }
    created = api_client.post(f"{BASE_URL}/api/playdates", json=create_payload)
    assert created.status_code == 200
    playdate_id = created.json()["playdate"]["playdate_id"]

    accepted = invitee.post(
        f"{BASE_URL}/api/playdates/{playdate_id}/respond",
        json={"action": "accept"},
    )
    assert accepted.status_code == 200
    assert accepted.json()["playdate"]["status"] == "confirmed"

    complete = api_client.post(f"{BASE_URL}/api/playdates/{playdate_id}/complete")
    assert complete.status_code == 200
    assert complete.json()["ok"] is True

    blocked_message = api_client.post(
        f"{BASE_URL}/api/playdates/{playdate_id}/messages",
        json={"content": "Should be blocked"},
    )
    assert blocked_message.status_code == 400
    assert "ended" in blocked_message.json()["detail"].lower()
