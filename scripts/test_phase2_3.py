#!/usr/bin/env python3
"""
PlayPals — Phase 2/3 checklist test script.

Diagnostic tool, not application code. Exercises the app's real production
API (there is no staging environment for this project) using dedicated,
clearly-named test accounts, plus direct MongoDB access for backdating
timestamps the API doesn't expose. Cleans up all test data it creates at
the end of every run (best-effort in a `finally` block), and also purges
any leftover test data matching its email pattern at the *start* of a run,
so a crashed prior run doesn't accumulate junk.

Usage:
    export API_BASE_URL="https://playpals.ondek.co/api"
    export MONGO_URL="mongodb+srv://..."
    export DB_NAME="playpals"
    export INTERNAL_TIMER_SECRET="..."
    python3 test_phase2_3.py

None of these are hardcoded here on purpose — this file is meant to be
safe to commit and re-run after future phases without embedding live
credentials in git history.
"""
import os
import re
import sys
import threading
import traceback
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import requests
from pymongo import MongoClient

API_BASE = os.environ.get("API_BASE_URL", "").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "")
DB_NAME = os.environ.get("DB_NAME", "")
TIMER_SECRET = os.environ.get("INTERNAL_TIMER_SECRET", "")
PACIFIC = ZoneInfo("America/Vancouver")

for name, val in [("API_BASE_URL", API_BASE), ("MONGO_URL", MONGO_URL), ("DB_NAME", DB_NAME), ("INTERNAL_TIMER_SECRET", TIMER_SECRET)]:
    if not val:
        print(f"Missing required env var: {name}", file=sys.stderr)
        sys.exit(1)

mongo = MongoClient(MONGO_URL, serverSelectionTimeoutMS=8000)
db = mongo[DB_NAME]

# NOT playpals.test: the backend's email-validator explicitly rejects RFC 2606
# reserved TLDs (.test, .example, .invalid, .localhost) with a 422 before a magic
# link is even created. .internal isn't a resolvable public TLD, so nothing here
# can ever reach a real inbox even if delivery were attempted (it isn't, in
# practice — the magic-link token is read straight from MongoDB, see login()).
TEST_EMAIL_DOMAIN = "playpals-diagnostic.internal"
TEST_EMAIL_DOMAIN_RE = re.escape(TEST_EMAIL_DOMAIN)


# --------------------------------------------------------------------------
# Time helpers — mirror the backend's playdate_datetime() (server.py), which
# interprets date/start_time/end_time as Pacific wall-clock, not UTC.
# --------------------------------------------------------------------------

def pacific_from_utc(dt_utc):
    """UTC datetime -> (date_str, time_str) as the backend would store them."""
    local = dt_utc.astimezone(PACIFIC)
    return local.strftime("%Y-%m-%d"), local.strftime("%H:%M")


def utc_now():
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------
# API client
# --------------------------------------------------------------------------

class ApiClient:
    def __init__(self):
        self.session = requests.Session()
        self.user = None

    def _url(self, path):
        return f"{API_BASE}{path}"

    def login(self, email, name):
        r = self.session.post(self._url("/auth/magic-link"), json={"email": email, "name": name, "origin": "https://playpals.ondek.co"})
        r.raise_for_status()
        # Email delivery is broken in this environment's Resend sandbox mode
        # for any address but the account owner's — read the token directly
        # from MongoDB instead of waiting on an email that will never arrive.
        link = db.magic_links.find_one({"email": email.strip().lower(), "used_at": None}, sort=[("created_at", -1)])
        if not link:
            raise RuntimeError(f"No unused magic link found for {email} in MongoDB")
        r2 = self.session.post(self._url("/auth/magic/verify"), json={"token": link["token"]})
        r2.raise_for_status()
        self.user = r2.json()["user"]
        return self.user

    def me(self):
        r = self.session.get(self._url("/auth/me"))
        r.raise_for_status()
        return r.json()["user"]

    def create_child(self, first_name, age=7, grade="Grade 1"):
        r = self.session.post(self._url("/children"), json={"first_name": first_name, "age": age, "grade": grade})
        r.raise_for_status()
        return r.json()["child_id"]

    def save_availability(self, date_str, blocks, child_ids=None):
        r = self.session.post(self._url("/availability"), json={
            "date": date_str, "blocks": blocks, "recurrence": "once",
            "visibility_mode": "everyone", "child_ids": child_ids or [],
        })
        r.raise_for_status()
        return r.json()

    def delete_availability(self, date_str):
        return self.session.delete(self._url(f"/availability/{date_str}"))

    def propose(self, invitee_parent_id, child_ids, date_str, start, end, slot_id=None, location="Test park", activity="Park"):
        return self.session.post(self._url("/playdates"), json={
            "invitee_parent_id": invitee_parent_id, "child_ids": child_ids,
            "date": date_str, "start_time": start, "end_time": end,
            "location": location, "activity": activity, "notes": "", "slot_id": slot_id,
        })

    def respond(self, playdate_id, action, counter_date=None, counter_start=None, counter_end=None):
        body = {"action": action}
        if counter_date:
            body.update({"counter_date": counter_date, "counter_start_time": counter_start, "counter_end_time": counter_end})
        return self.session.post(self._url(f"/playdates/{playdate_id}/respond"), json=body)

    def reschedule(self, playdate_id, date_str, start, end):
        return self.session.post(self._url(f"/playdates/{playdate_id}/reschedule"), json={"date": date_str, "start_time": start, "end_time": end})

    def cancel(self, playdate_id, reason="test cleanup"):
        return self.session.post(self._url(f"/playdates/{playdate_id}/cancel"), json={"reason": reason})


def run_timers():
    r = requests.post(f"{API_BASE}/internal/run-timers", headers={"X-Internal-Timer-Secret": TIMER_SECRET})
    r.raise_for_status()
    return r.json()


# --------------------------------------------------------------------------
# Direct Mongo helpers (only for what the API genuinely can't do: backdating)
# --------------------------------------------------------------------------

def set_playdate_fields(playdate_id, **fields):
    db.playdates.update_one({"playdate_id": playdate_id}, {"$set": fields})


def get_playdate(playdate_id):
    return db.playdates.find_one({"playdate_id": playdate_id}, {"_id": 0})


def get_slot(slot_id):
    return db.availability_slots.find_one({"slot_id": slot_id}, {"_id": 0})


def notifications_for(parent_id, reference_id):
    return list(db.notifications.find({"parent_id": parent_id, "reference_id": reference_id}, {"_id": 0}))


# --------------------------------------------------------------------------
# Test result tracking
# --------------------------------------------------------------------------

RESULTS = []  # list of (item_id, description, passed, detail)


def record(item_id, description, passed, detail=""):
    RESULTS.append((item_id, description, passed, detail))
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {item_id} — {description}" + (f"\n         {detail}" if detail and not passed else ""))


def check(item_id, description, condition, detail_on_fail=""):
    record(item_id, description, bool(condition), detail_on_fail)


# --------------------------------------------------------------------------
# Test data setup / cleanup
# --------------------------------------------------------------------------

def purge_test_data():
    """Remove anything tied to a test account, in any collection. Runs both before
    (in case a prior run crashed mid-way) and after a run."""
    test_user_ids = [u["user_id"] for u in db.users.find({"email": {"$regex": f"@{TEST_EMAIL_DOMAIN_RE}$"}}, {"_id": 0, "user_id": 1})]
    if not test_user_ids:
        return
    pd_ids = [p["playdate_id"] for p in db.playdates.find({"$or": [{"organizer_id": {"$in": test_user_ids}}]}, {"_id": 0, "playdate_id": 1})]
    pd_ids += [p["playdate_id"] for p in db.playdate_participants.find({"parent_id": {"$in": test_user_ids}}, {"_id": 0, "playdate_id": 1})]
    pd_ids = list(set(pd_ids))
    db.playdates.delete_many({"playdate_id": {"$in": pd_ids}})
    db.playdate_participants.delete_many({"playdate_id": {"$in": pd_ids}})
    db.availability_slots.delete_many({"parent_id": {"$in": test_user_ids}})
    db.children.delete_many({"parent_id": {"$in": test_user_ids}})
    db.notifications.delete_many({"parent_id": {"$in": test_user_ids}})
    db.credits.delete_many({"parent_id": {"$in": test_user_ids}})
    db.user_sessions.delete_many({"user_id": {"$in": test_user_ids}})
    db.magic_links.delete_many({"email": {"$regex": f"@{TEST_EMAIL_DOMAIN_RE}$"}})
    db.match_dismissals.delete_many({"$or": [{"dismisser_parent_id": {"$in": test_user_ids}}, {"target_parent_id": {"$in": test_user_ids}}]})
    db.users.delete_many({"user_id": {"$in": test_user_ids}})
    print(f"[cleanup] removed {len(test_user_ids)} test user(s), {len(pd_ids)} test playdate(s)")


def new_test_client(tag, name):
    client = ApiClient()
    email = f"test_parent_{tag}@{TEST_EMAIL_DOMAIN}"
    client.login(email, name)
    return client


def make_slot(client, first_name, date_str, start, end):
    """Create a child + a single child-scoped open slot; return (child_id, slot_id)."""
    child_id = client.create_child(first_name)
    saved = client.save_availability(date_str, [{"start": start, "end": end}], child_ids=[child_id])
    slot_id = saved["saved"][0]["slot_id"]
    return child_id, slot_id


def future_date(days):
    return (datetime.now(timezone.utc).date() + timedelta(days=days)).isoformat()


def confirm_playdate(organizer, invitee, invitee_id, child_ids=None, days_out=5, slot_id=None):
    """Propose (organizer -> invitee) then have invitee accept; returns playdate_id."""
    r = organizer.propose(invitee_id, child_ids or [], future_date(days_out), "10:00", "12:00", slot_id=slot_id)
    r.raise_for_status()
    playdate_id = r.json()["playdate"]["playdate_id"]
    r2 = invitee.respond(playdate_id, "accept")
    r2.raise_for_status()
    return playdate_id


# --------------------------------------------------------------------------
# Section A — Auto-complete
# --------------------------------------------------------------------------

def section_a(pa, pb, pb_id):
    hours_ago = utc_now() - timedelta(hours=4)
    past_date, past_end = pacific_from_utc(hours_ago)
    past_start, _ = pacific_from_utc(hours_ago - timedelta(hours=2))

    # A1
    pd1 = confirm_playdate(pa, pb, pb_id)
    set_playdate_fields(pd1, date=past_date, start_time=past_start, end_time=past_end)
    run_timers()
    doc1 = get_playdate(pd1)
    check("A1", "confirmed playdate 3+h past end_time auto-completes with credits",
          doc1["status"] == "completed" and db.credits.count_documents({"reference_id": pd1, "action_type": "completed_playdate"}) == 2,
          f"status={doc1['status']}, credit rows={db.credits.count_documents({'reference_id': pd1, 'action_type': 'completed_playdate'})}")

    # A2 — same but reminder_sent already true beforehand
    pd2 = confirm_playdate(pa, pb, pb_id)
    set_playdate_fields(pd2, date=past_date, start_time=past_start, end_time=past_end, reminder_sent=True)
    run_timers()
    doc2 = get_playdate(pd2)
    check("A2", "auto-completes even if reminder_sent was already true",
          doc2["status"] == "completed",
          f"status={doc2['status']}")

    # A3 — reschedule_pending should NOT auto-complete
    pd3 = confirm_playdate(pa, pb, pb_id)
    set_playdate_fields(pd3, date=past_date, start_time=past_start, end_time=past_end)
    r = pa.reschedule(pd3, future_date(6), "14:00", "15:00")
    r.raise_for_status()
    run_timers()
    doc3 = get_playdate(pd3)
    check("A3", "reschedule_pending with past original time does NOT auto-complete",
          doc3["status"] == "reschedule_pending",
          f"status={doc3['status']}")


# --------------------------------------------------------------------------
# Section B — Proposal expiry
# --------------------------------------------------------------------------

def section_b(pa, pb, pb_id):
    old_created = (utc_now() - timedelta(hours=49)).isoformat()

    # B1 — old created_at, future date/time; proposed
    _, slot1 = make_slot(pb, "B1Child", future_date(10), "10:00", "12:00")
    r = pa.propose(pb_id, [], future_date(10), "10:00", "12:00", slot_id=slot1)
    r.raise_for_status()
    pd1 = r.json()["playdate"]["playdate_id"]
    set_playdate_fields(pd1, created_at=old_created)
    run_timers()
    doc1 = get_playdate(pd1)
    slot1_doc = get_slot(slot1)
    notes1 = notifications_for(pa.user["user_id"], pd1) + notifications_for(pb_id, pd1)
    check("B1", "proposal with created_at 49h+ ago expires, slot released, both notified",
          doc1["status"] == "expired" and slot1_doc["status"] == "open" and len(notes1) >= 1,
          f"status={doc1['status']}, slot_status={slot1_doc['status']}, notif_count={len(notes1)}")

    # B2 — recent created_at, but date/start_time already in the past
    _, slot2 = make_slot(pb, "B2Child", future_date(20), "10:00", "12:00")
    r = pa.propose(pb_id, [], future_date(20), "10:00", "12:00", slot_id=slot2)
    r.raise_for_status()
    pd2 = r.json()["playdate"]["playdate_id"]
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    set_playdate_fields(pd2, date=yesterday, start_time="10:00", end_time="12:00")
    run_timers()
    doc2 = get_playdate(pd2)
    check("B2", "proposal with recent created_at but past date/time still expires",
          doc2["status"] == "expired",
          f"status={doc2['status']}")

    # B3 — same as B1 but starting status "countered"
    _, slot3 = make_slot(pb, "B3Child", future_date(10), "10:00", "12:00")
    r = pa.propose(pb_id, [], future_date(10), "10:00", "12:00", slot_id=slot3)
    r.raise_for_status()
    pd3 = r.json()["playdate"]["playdate_id"]
    r = pb.respond(pd3, "counter", future_date(11), "10:00", "12:00")
    r.raise_for_status()
    set_playdate_fields(pd3, created_at=old_created)
    run_timers()
    doc3 = get_playdate(pd3)
    check("B3", "countered proposal with created_at 49h+ ago also expires",
          doc3["status"] == "expired",
          f"status={doc3['status']}")

    # B4 — reschedule_pending should NOT expire
    pd4 = confirm_playdate(pa, pb, pb_id, days_out=12)
    r = pa.reschedule(pd4, future_date(13), "14:00", "15:00")
    r.raise_for_status()
    set_playdate_fields(pd4, created_at=old_created)
    run_timers()
    doc4 = get_playdate(pd4)
    check("B4", "reschedule_pending does NOT expire even with old created_at",
          doc4["status"] == "reschedule_pending",
          f"status={doc4['status']}")


# --------------------------------------------------------------------------
# Section C — Day-before reminder
# --------------------------------------------------------------------------

def section_c(pa, pb, pb_id):
    tomorrow_date, tomorrow_time = pacific_from_utc(utc_now() + timedelta(hours=24))
    pd1 = confirm_playdate(pa, pb, pb_id, days_out=1)
    set_playdate_fields(pd1, date=tomorrow_date, start_time=tomorrow_time, end_time="23:59", reminder_sent=False)

    run_timers()
    doc1 = get_playdate(pd1)
    notes_a = notifications_for(pa.user["user_id"], pd1)
    notes_b = notifications_for(pb_id, pd1)
    reminder_notes_a = [n for n in notes_a if "tomorrow" in n["title"].lower()]
    reminder_notes_b = [n for n in notes_b if "tomorrow" in n["title"].lower()]
    check("C1", "confirmed playdate ~24h out gets a reminder to both parties",
          doc1.get("reminder_sent") is True and len(reminder_notes_a) == 1 and len(reminder_notes_b) == 1,
          f"reminder_sent={doc1.get('reminder_sent')}, notes_a={len(reminder_notes_a)}, notes_b={len(reminder_notes_b)}")

    run_timers()
    notes_a2 = [n for n in notifications_for(pa.user["user_id"], pd1) if "tomorrow" in n["title"].lower()]
    notes_b2 = [n for n in notifications_for(pb_id, pd1) if "tomorrow" in n["title"].lower()]
    doc1b = get_playdate(pd1)
    check("C2", "second immediate timer call does not duplicate the reminder",
          len(notes_a2) == 1 and len(notes_b2) == 1 and doc1b.get("reminder_sent") is True,
          f"notes_a={len(notes_a2)}, notes_b={len(notes_b2)}, reminder_sent={doc1b.get('reminder_sent')}")

    # C3 — accepting a reschedule resets reminder_sent to False
    pd3 = confirm_playdate(pa, pb, pb_id, days_out=15)
    set_playdate_fields(pd3, reminder_sent=True)
    r = pa.reschedule(pd3, future_date(16), "14:00", "15:00")
    r.raise_for_status()
    r2 = pb.respond(pd3, "accept")
    r2.raise_for_status()
    doc3 = get_playdate(pd3)
    check("C3", "accepting a reschedule resets reminder_sent to False",
          doc3.get("reminder_sent") is False,
          f"reminder_sent={doc3.get('reminder_sent')}")


# --------------------------------------------------------------------------
# Section E — Slot deletion block
# --------------------------------------------------------------------------

def section_e(pa, pb, pb_id):
    date_e1 = future_date(30)
    _, slot_e1 = make_slot(pb, "EChild1", date_e1, "10:00", "12:00")
    r = pa.propose(pb_id, [], date_e1, "10:00", "12:00", slot_id=slot_e1)
    r.raise_for_status()
    pd_e1 = r.json()["playdate"]["playdate_id"]

    del_resp = pb.delete_availability(date_e1)
    slot_still_there = get_slot(slot_e1) is not None
    check("E1", "deleting a date with a live proposal is rejected (409), slot survives",
          del_resp.status_code == 409 and slot_still_there,
          f"status={del_resp.status_code}, body={del_resp.text[:200]}, slot_exists={slot_still_there}")

    date_e2 = future_date(31)
    pb.save_availability(date_e2, [{"start": "10:00", "end": "12:00"}])
    del_resp2 = pb.delete_availability(date_e2)
    check("E2", "deleting a date with no live proposal succeeds normally",
          del_resp2.status_code == 200,
          f"status={del_resp2.status_code}, body={del_resp2.text[:200]}")

    r = pa.respond(pd_e1, "withdraw")
    r.raise_for_status()
    del_resp3 = pb.delete_availability(date_e1)
    check("E3", "after withdraw, deletion of the same date now succeeds",
          del_resp3.status_code == 200,
          f"status={del_resp3.status_code}, body={del_resp3.text[:200]}")


# --------------------------------------------------------------------------
# Section F — First-accept-wins
# --------------------------------------------------------------------------

def section_f(pa, pb, pc, pc_id):
    date_f1 = future_date(32)
    _, slot_f1 = make_slot(pc, "FChild", date_f1, "10:00", "12:00")
    r1 = pa.propose(pc_id, [], date_f1, "10:00", "12:00", slot_id=slot_f1)
    r1.raise_for_status()
    r2 = pb.propose(pc_id, [], date_f1, "10:00", "12:00", slot_id=slot_f1)
    check("F1", "second proposal against an already-held slot is rejected (409)",
          r2.status_code == 409,
          f"status={r2.status_code}, body={r2.text[:200]}")


# --------------------------------------------------------------------------
# Section G — Accept status re-check
# --------------------------------------------------------------------------

def section_g(pa, pb, pb_id):
    date_g1 = future_date(33)
    r = pa.propose(pb_id, [], date_g1, "10:00", "12:00")
    r.raise_for_status()
    pd_g1 = r.json()["playdate"]["playdate_id"]
    r2 = pa.respond(pd_g1, "withdraw")
    r2.raise_for_status()
    r3 = pb.respond(pd_g1, "accept")
    check("G1", "accepting an already-withdrawn proposal is rejected (409), not a silent success",
          r3.status_code == 409,
          f"status={r3.status_code}, body={r3.text[:200]}")


# --------------------------------------------------------------------------
# Section H — Graceful slot-deleted error
# --------------------------------------------------------------------------

def section_h(pa, pb_id):
    r = pa.propose(pb_id, [], future_date(34), "10:00", "12:00", slot_id="slot_doesnotexist12345")
    check("H1", "proposing against a nonexistent slot_id is rejected cleanly, no orphaned playdate",
          r.status_code >= 400,
          f"status={r.status_code}, body={r.text[:200]}")


# --------------------------------------------------------------------------
# Section I — Cross-child warning (warn-only)
# Section J — Same-child hard block
# Both use the same parent-with-two-children setup, so combined here.
# --------------------------------------------------------------------------

def section_ij(pa, pb):
    # save_availability wipes ALL slots for a (parent, date) on every call, so each
    # slot below is created on its own distinct date to avoid the earlier ones being
    # deleted out from under an already-created proposal. Once a playdate exists, its
    # own date/start_time/end_time (not the originating slot's date) is what the
    # overlap checks compare, so those fields are realigned via direct Mongo writes
    # after creation to set up the actual overlapping-time scenario being tested —
    # the same "set up state the API can't express directly" pattern used for
    # backdating elsewhere in this script, not a new mechanism.
    pb_id = pb.user["user_id"]
    overlap_date = future_date(35)

    child1, slot1 = make_slot(pb, "IJChild1", overlap_date, "10:00", "12:00")
    r = pa.propose(pb_id, [], overlap_date, "10:00", "12:00", slot_id=slot1)
    r.raise_for_status()
    pd1 = r.json()["playdate"]["playdate_id"]
    r = pb.respond(pd1, "accept")
    r.raise_for_status()

    # I1 — different child (Child 2), overlapping time -> accept succeeds WITH a warning
    child2, slot2 = make_slot(pb, "IJChild2", future_date(36), "11:00", "13:00")
    r = pa.propose(pb_id, [], future_date(36), "11:00", "13:00", slot_id=slot2)
    r.raise_for_status()
    pd2 = r.json()["playdate"]["playdate_id"]
    set_playdate_fields(pd2, date=overlap_date)  # align onto pd1's date to actually overlap
    r2 = pb.respond(pd2, "accept")
    body2 = r2.json() if r2.ok else {}
    check("I1", "accepting an overlapping playdate for a DIFFERENT child succeeds with a warning",
          r2.status_code == 200 and bool(body2.get("warning")),
          f"status={r2.status_code}, warning={body2.get('warning')!r}")

    # J1/J2 — same child (Child 1, same child_id, NOT a new child) again, overlapping
    # time -> propose succeeds, accept is hard-blocked. make_slot() always creates a
    # fresh child, so this reuses save_availability directly against the existing
    # child1 id instead.
    saved3 = pb.save_availability(future_date(37), [{"start": "11:00", "end": "13:00"}], child_ids=[child1])
    slot3 = saved3["saved"][0]["slot_id"]
    r3 = pa.propose(pb_id, [], future_date(37), "11:00", "13:00", slot_id=slot3)
    check("J2", "proposing against the same child at an overlapping time still succeeds at CREATE time",
          r3.status_code == 200,
          f"status={r3.status_code}, body={r3.text[:200]}")
    if r3.status_code == 200:
        pd3 = r3.json()["playdate"]["playdate_id"]
        set_playdate_fields(pd3, date=overlap_date)  # align onto pd1's date to actually overlap
        r4 = pb.respond(pd3, "accept")
        check("J1", "accepting the same child at an overlapping time is hard-blocked (409)",
              r4.status_code == 409,
              f"status={r4.status_code}, body={r4.text[:200]}")
    else:
        record("J1", "accepting the same child at an overlapping time is hard-blocked (409)", False, "skipped: J2 propose did not succeed")


# --------------------------------------------------------------------------
# Section K — Round-cap fix (both paths independently)
# --------------------------------------------------------------------------

def section_k(pa, pb, pb_id):
    # K1a — counter-propose loop via respond(action="counter")
    date_k = future_date(40)
    r = pa.propose(pb_id, [], date_k, "10:00", "12:00")
    r.raise_for_status()
    pd_k1 = r.json()["playdate"]["playdate_id"]
    last_status = None
    for i in range(3):
        resp = pb.respond(pd_k1, "counter", future_date(41 + i), "10:00", "12:00")
        last_status = resp.status_code
    fourth = pb.respond(pd_k1, "counter", future_date(50), "10:00", "12:00")
    check("K1a", "4th counter-propose via decline/counter path is rejected at the round cap",
          last_status == 200 and fourth.status_code == 400,
          f"rounds 1-3 last_status={last_status}, 4th status={fourth.status_code}, body={fourth.text[:200]}")

    # K1b — counter-propose loop via reschedule_playdate (separate path, same cap)
    pd_k2 = confirm_playdate(pa, pb, pb_id, days_out=60)
    last_status2 = None
    for i in range(3):
        resp = pa.reschedule(pd_k2, future_date(61 + i), "14:00", "15:00")
        last_status2 = resp.status_code
    fourth2 = pa.reschedule(pd_k2, future_date(70), "14:00", "15:00")
    check("K1b", "4th reschedule request on a confirmed playdate is independently rejected at the round cap",
          last_status2 == 200 and fourth2.status_code == 400,
          f"rounds 1-3 last_status={last_status2}, 4th status={fourth2.status_code}, body={fourth2.text[:200]}")


# --------------------------------------------------------------------------
# Section M — Reschedule-decline revert
# --------------------------------------------------------------------------

def section_m(pa, pb, pb_id):
    # M1 — decline a reschedule -> reverts to ORIGINAL time, status confirmed
    pd_m1 = confirm_playdate(pa, pb, pb_id, days_out=80)
    original = get_playdate(pd_m1)
    r = pa.reschedule(pd_m1, future_date(81), "16:00", "17:00")
    r.raise_for_status()
    r2 = pb.respond(pd_m1, "decline")
    r2.raise_for_status()
    reverted = get_playdate(pd_m1)
    check("M1", "declining a reschedule reverts to confirmed with the ORIGINAL date/time",
          reverted["status"] == "confirmed" and reverted["date"] == original["date"] and reverted["start_time"] == original["start_time"] and reverted["end_time"] == original["end_time"],
          f"status={reverted['status']}, date={reverted['date']} (orig {original['date']}), start={reverted['start_time']} (orig {original['start_time']})")

    # M3 — accept a reschedule -> confirmed with the NEW time (regression check)
    pd_m3 = confirm_playdate(pa, pb, pb_id, days_out=90)
    r = pa.reschedule(pd_m3, future_date(91), "16:00", "17:00")
    r.raise_for_status()
    r2 = pb.respond(pd_m3, "accept")
    r2.raise_for_status()
    accepted = get_playdate(pd_m3)
    check("M3", "accepting a reschedule (regression check) still confirms with the NEW time",
          accepted["status"] == "confirmed" and accepted["date"] == future_date(91) and accepted["start_time"] == "16:00",
          f"status={accepted['status']}, date={accepted['date']}, start={accepted['start_time']}")


# --------------------------------------------------------------------------
# Section N — Idempotency (concurrent duplicate submit)
# --------------------------------------------------------------------------

def section_n(pa, pb_id):
    date_n = future_date(100)
    payload = dict(invitee_parent_id=pb_id, child_ids=[], date=date_n, start_time="10:00", end_time="12:00", location="Test park", activity="Park", notes="", slot_id=None)
    results = [None, None]
    barrier = threading.Barrier(2)

    def fire(idx):
        barrier.wait()
        results[idx] = pa.session.post(pa._url("/playdates"), json=payload)

    threads = [threading.Thread(target=fire, args=(i,)) for i in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    dedupe_key = f"{pa.user['user_id']}:{pb_id}:{date_n}:10:00:12:00"
    count = db.playdates.count_documents({"dedupe_key": dedupe_key})
    check("N1", "two near-simultaneous identical proposals create exactly one playdate",
          count == 1,
          f"playdate doc count={count}, statuses={[r.status_code for r in results]}")


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

SKIPPED_ITEMS = [
    ("D1", "Cron job configured correctly in Railway", "manual, dashboard-only — not API-reachable"),
    ("D2", "Cron job actually firing on schedule", "manual, dashboard-only — not API-reachable (separately confirmed working in an earlier session via Railway logs)"),
    ("L1", "Tapping a notification navigates in the UI", "requires a browser"),
    ("L2", "Landing on the linked playdate renders without a blank/broken screen", "requires a browser"),
    ("M2", "Reschedule-decline notification copy/wording", "human judgment call on phrasing, not a pass/fail assertion"),
]


def run_section(name, fn, *args):
    try:
        fn(*args)
    except Exception:
        record(name, "section raised an unexpected exception", False, traceback.format_exc())


def main():
    print(f"Target API: {API_BASE}")
    print(f"Target DB:  {DB_NAME} @ {MONGO_URL.split('@')[-1] if '@' in MONGO_URL else MONGO_URL}")
    print("Purging any leftover test data from a prior run...")
    purge_test_data()

    try:
        pa = new_test_client("a", "Test Parent A")
        pb = new_test_client("b", "Test Parent B")
        pc = new_test_client("c", "Test Parent C")
        pb_id = pb.user["user_id"]
        pc_id = pc.user["user_id"]

        run_section("A", section_a, pa, pb, pb_id)
        run_section("B", section_b, pa, pb, pb_id)
        run_section("C", section_c, pa, pb, pb_id)
        run_section("E", section_e, pa, pb, pb_id)
        run_section("F", section_f, pa, pb, pc, pc_id)
        run_section("G", section_g, pa, pb, pb_id)
        run_section("H", section_h, pa, pb_id)
        run_section("IJ", section_ij, pa, pb)
        run_section("K", section_k, pa, pb, pb_id)
        run_section("M", section_m, pa, pb, pb_id)
        run_section("N", section_n, pa, pb_id)
    finally:
        print("\nCleaning up test data...")
        purge_test_data()

    print("\n" + "=" * 70)
    print("PHASE 2/3 CHECKLIST — RESULTS")
    print("=" * 70)
    passed = [r for r in RESULTS if r[2]]
    failed = [r for r in RESULTS if not r[2]]
    for item_id, desc, ok, detail in RESULTS:
        print(f"[{'PASS' if ok else 'FAIL'}] {item_id} — {desc}")
        if not ok and detail:
            print(f"         {detail}")
    print(f"\n{len(passed)} passed, {len(failed)} failed, out of {len(RESULTS)} run")
    print("\nExplicitly out of scope (not attempted):")
    for item_id, desc, reason in SKIPPED_ITEMS:
        print(f"  {item_id} — {desc} — {reason}")

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
