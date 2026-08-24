from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Any, Dict, List, Optional
import uuid
import secrets
import re
from datetime import date, datetime, timedelta, timezone

import requests


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str


class MagicLinkRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    origin: str


class MagicVerifyRequest(BaseModel):
    token: str


class OAuthSessionRequest(BaseModel):
    session_id: str


class ChildCreate(BaseModel):
    first_name: str
    age: int
    grade: str
    school_id: Optional[str] = None
    interests: List[str] = []
    allergies: str = ""
    notes: str = ""
    photo_url: Optional[str] = None
    status: str = "active"


class ChildUpdate(BaseModel):
    first_name: Optional[str] = None
    age: Optional[int] = None
    grade: Optional[str] = None
    school_id: Optional[str] = None
    interests: Optional[List[str]] = None
    allergies: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    status: Optional[str] = None
    alumni_class_year: Optional[int] = None


class AvailabilityBlock(BaseModel):
    start: str
    end: str


class AvailabilityCreate(BaseModel):
    date: str
    blocks: List[AvailabilityBlock]
    recurrence: str = "once"
    visibility_mode: str = "everyone"
    visible_to_parent_ids: List[str] = []
    child_ids: List[str] = []
    recurring_end_date: Optional[str] = None


class CommunityCheckRequest(BaseModel):
    name: str
    city: Optional[str] = None
    type: str = "school"


class CommunityCreate(BaseModel):
    name: str
    type: str = "school"
    city: str = ""
    connection: Optional[str] = None
    scope: Optional[str] = None
    detail: Optional[str] = None
    master_community_id: Optional[str] = None


class JoinCommunityRequest(BaseModel):
    community_id: str
    class_or_teacher: Optional[str] = None


class AddSubCommunityRequest(BaseModel):
    name: str
    type: str = "grade"


class CommunityDeclineRequest(BaseModel):
    reason: Optional[str] = None


class AddFamilyChildInput(BaseModel):
    first_name: str
    age: Optional[int] = None
    grade: str
    grade_community_id: str


class AddFamilyRequest(BaseModel):
    parent_name: str
    parent_email: EmailStr
    community_id: str
    children: List[AddFamilyChildInput] = []


class TagSponsorRequest(BaseModel):
    sponsor_id: str


class PlaydateCreate(BaseModel):
    type: str = "1:1"
    invitee_parent_ids: List[str]
    child_ids: List[str] = []
    date: str
    start_time: str
    end_time: str
    location: str
    activity: str
    notes: str = ""
    min_confirmations: int = 1
    title: Optional[str] = None
    slot_id: Optional[str] = None


class PlaydateResponseAction(BaseModel):
    action: str
    counter_date: Optional[str] = None
    counter_start_time: Optional[str] = None
    counter_end_time: Optional[str] = None


class RescheduleRequest(BaseModel):
    date: str
    start_time: str
    end_time: str


class CancelRequest(BaseModel):
    reason: str


class ReactionRequest(BaseModel):
    reaction: str


class MemoryNoteRequest(BaseModel):
    note_text: str
    photo_url: Optional[str] = None


class ChatMessageCreate(BaseModel):
    content: str


class ContactShareRequest(BaseModel):
    method: str


class ParentProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    neighborhood: Optional[str] = None
    contact_preference: Optional[str] = None
    notification_preferences: Optional[Dict[str, bool]] = None
    needs_welcome: Optional[bool] = None


class SponsorResponse(BaseModel):
    action: str


class StepBackRequest(BaseModel):
    reason: str
    duration: Optional[str] = None


class VisibilityUpdate(BaseModel):
    visibility_mode: str
    visible_to_parent_ids: List[str] = []


class AvailabilityShareRequestCreate(BaseModel):
    target_parent_id: str
    community_id: Optional[str] = None


class AvailabilityShareResponse(BaseModel):
    action: str


class MatchDismissalCreate(BaseModel):
    target_parent_id: str
    dismissal_type: str


INTERESTS = ["Soccer", "Lego", "Art", "Reading", "Dance", "Swimming", "Gaming", "Nature", "Science", "Music", "Cooking", "Animals"]
GRADES = ["Pre-K", "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"]
CHILD_STATUSES = ["active", "graduate", "alumni", "on_a_break", "moved_on"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def clean_email(email: str) -> str:
    return email.strip().lower()


def parse_expiry(value: Any) -> datetime:
    if isinstance(value, str):
        parsed = datetime.fromisoformat(value)
    else:
        parsed = value
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def minutes(value: str) -> int:
    hour, minute = value.split(":")
    return int(hour) * 60 + int(minute)


def time_label(value: str) -> str:
    h, m = [int(part) for part in value.split(":")]
    suffix = "AM" if h < 12 else "PM"
    hour = h % 12 or 12
    return f"{hour}:{m:02d} {suffix}"


def date_label(value: str) -> str:
    dt = datetime.fromisoformat(value).date()
    return dt.strftime("%A, %B %-d") if os.name != "nt" else dt.strftime("%A, %B %#d")


def tier_for_credits(credits: int) -> Dict[str, Any]:
    if credits <= 10:
        return {"name": "Curious Pup", "badge": "🐶", "next": 11, "credits": credits}
    if credits <= 30:
        return {"name": "Playful Otter", "badge": "🦦", "next": 31, "credits": credits}
    if credits <= 75:
        return {"name": "Social Penguin", "badge": "🐧", "next": 76, "credits": credits}
    if credits <= 150:
        return {"name": "Proud Elephant", "badge": "🐘", "next": 151, "credits": credits}
    return {"name": "Mighty Lion", "badge": "🦁", "next": None, "credits": credits}


async def public_parent(parent_id: str) -> Optional[Dict[str, Any]]:
    parent = await db.users.find_one({"user_id": parent_id}, {"_id": 0})
    if not parent:
        return None
    total = await credit_total(parent_id)
    tier = tier_for_credits(total)
    return {
        "user_id": parent["user_id"],
        "name": parent.get("name", "Parent"),
        "picture": parent.get("picture", ""),
        "neighborhood": parent.get("neighborhood", ""),
        "tier": {"name": tier["name"], "badge": tier["badge"]},
    }


def grade_class_year(grade: str) -> int:
    current = date.today()
    school_year_end = current.year if current.month <= 6 else current.year + 1
    if grade == "Grade 7":
        return school_year_end
    return school_year_end


def status_from_step_back(reason: str) -> str:
    if reason == "moved_schools":
        return "moved_on"
    if reason == "taking_break":
        return "on_a_break"
    return "alumni"


def similarity(a: str, b: str) -> float:
    a_tokens = set(re.sub(r"[^a-z0-9 ]", "", a.lower()).split())
    b_tokens = set(re.sub(r"[^a-z0-9 ]", "", b.lower()).split())
    if not a_tokens or not b_tokens:
        return 0.0
    return len(a_tokens & b_tokens) / len(a_tokens | b_tokens)


# NOTE (UAT fix, Aug 16 2026): "onboarding@resend.dev" is Resend's shared
# sandbox sender. In sandbox mode Resend silently refuses to deliver to any
# address other than the Resend account owner's own verified email, which
# blocks every real user's magic-link signup/login. To fix in production:
#   1. In the Resend dashboard, add and verify a domain you own (e.g. playpals.app).
#   2. Set RESEND_FROM_EMAIL to an address on that domain, e.g.
#      "PlayPals <hello@playpals.app>".
# Until a domain is verified, this will keep failing for anyone but the
# account owner - that's a Resend account action, not something fixable in code.
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "PlayPals <onboarding@resend.dev>")


async def send_resend_email(to_email: str, subject: str, html: str) -> Dict[str, Any]:
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        logger.warning("RESEND_API_KEY missing; email not sent")
        return {"sent": False, "reason": "missing_key"}
    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "from": RESEND_FROM_EMAIL,
                "to": [to_email],
                "subject": subject,
                "html": html,
            },
            timeout=10,
        )
        if response.status_code >= 400:
            logger.warning("Resend failed: %s", response.text[:300])
            reason = response.text[:300]
            if "You can only send testing emails" in response.text:
                reason = "Resend is in testing mode and can only send to the Resend account owner's email until a sender domain is verified."
            return {"sent": False, "reason": reason}
        return {"sent": True, "provider_id": response.json().get("id")}
    except Exception as exc:  # pragma: no cover - network resilience
        logger.warning("Resend exception: %s", exc)
        return {"sent": False, "reason": str(exc)}


async def upsert_user(email: str, name: Optional[str] = None, picture: Optional[str] = None) -> Dict[str, Any]:
    normalized = clean_email(email)
    existing = await db.users.find_one({"email": normalized}, {"_id": 0})
    if existing:
        updates = {"updated_at": now_iso()}
        if existing.get("status") == "pre_added":
            updates["status"] = "active"
            await db.children.update_many({"parent_id": existing["user_id"]}, {"$set": {"claimed": True}})
        if name and not existing.get("name"):
            updates["name"] = name
        if picture:
            updates["picture"] = picture
        await db.users.update_one({"user_id": existing["user_id"]}, {"$set": updates})
        existing.update(updates)
        return existing

    user = {
        "user_id": new_id("user"),
        "email": normalized,
        "name": name or normalized.split("@")[0].replace(".", " ").title(),
        "picture": picture or "",
        "neighborhood": "",
        "contact_preference": "email",
        "notification_preferences": {"email": True, "push": True, "sms": False},
        "phone": "",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.users.insert_one(user.copy())
    await add_credit(user["user_id"], 0, "account_created", user["user_id"])
    return user


async def add_credit(parent_id: str, amount: int, action_type: str, reference_id: str) -> None:
    await db.credits.insert_one(
        {
            "credit_id": new_id("credit"),
            "parent_id": parent_id,
            "amount": amount,
            "action_type": action_type,
            "reference_id": reference_id,
            "created_at": now_iso(),
        }
    )


async def credit_total(parent_id: str) -> int:
    rows = await db.credits.find({"parent_id": parent_id}, {"_id": 0, "amount": 1}).to_list(1000)
    return int(sum(row.get("amount", 0) for row in rows))


async def children_for_parent(parent_id: str) -> List[Dict[str, Any]]:
    return await db.children.find({"parent_id": parent_id, "claimed": {"$ne": False}}, {"_id": 0}).to_list(20)


async def has_recent_playdate_between(parent_a: str, parent_b: str) -> bool:
    since = (date.today() - timedelta(days=14)).isoformat()
    rows_a = await db.playdate_participants.find({"parent_id": parent_a}, {"_id": 0, "playdate_id": 1}).to_list(500)
    ids_a = [row["playdate_id"] for row in rows_a]
    if not ids_a:
        return False
    rows_b = await db.playdate_participants.find({"parent_id": parent_b, "playdate_id": {"$in": ids_a}}, {"_id": 0, "playdate_id": 1}).to_list(500)
    ids = [row["playdate_id"] for row in rows_b]
    if not ids:
        return False
    count = await db.playdates.count_documents({"playdate_id": {"$in": ids}, "date": {"$gte": since}, "status": {"$in": ["proposed", "confirmed", "completed", "cancelled", "rescheduled", "countered"]}})
    return count > 0


async def dismissal_suppressed(dismisser: str, target: str) -> bool:
    dismissals = await db.match_dismissals.find({"dismisser_parent_id": dismisser, "target_parent_id": target}, {"_id": 0}).sort("created_at", -1).to_list(100)
    if len(dismissals) >= 3:
        return True
    for dismissal in dismissals:
        if dismissal.get("dismissal_type") == "dont_suggest_again":
            return True
        if dismissal.get("dismissal_type") == "not_this_week":
            created = parse_expiry(dismissal["created_at"])
            if created > datetime.now(timezone.utc) - timedelta(days=7):
                return True
    return False


async def negative_reaction_suppressed(parent_a: str, parent_b: str) -> bool:
    rows_a = await db.playdate_participants.find({"parent_id": parent_a}, {"_id": 0, "playdate_id": 1}).to_list(500)
    ids_a = [row["playdate_id"] for row in rows_a]
    if not ids_a:
        return False
    rows_b = await db.playdate_participants.find({"parent_id": parent_b, "playdate_id": {"$in": ids_a}}, {"_id": 0, "playdate_id": 1}).to_list(500)
    ids = [row["playdate_id"] for row in rows_b]
    if not ids:
        return False
    count = await db.emoji_reactions.count_documents({"playdate_id": {"$in": ids}, "parent_id": {"$in": [parent_a, parent_b]}, "reaction": "not_right"})
    return count >= 2


async def match_pair_suppressed(parent_id: str, peer_id: str) -> bool:
    if await has_recent_playdate_between(parent_id, peer_id):
        return True
    if await dismissal_suppressed(parent_id, peer_id):
        return True
    if await negative_reaction_suppressed(parent_id, peer_id):
        return True
    return False


async def families_are_sharing(parent_a: str, parent_b: str) -> bool:
    share = await db.availability_share_requests.find_one({
        "$or": [
            {"requester_parent_id": parent_a, "target_parent_id": parent_b, "status": "approved"},
            {"requester_parent_id": parent_b, "target_parent_id": parent_a, "status": "approved"},
        ]
    }, {"_id": 0})
    return bool(share)


async def share_status_between(viewer_id: str, other_id: str) -> str:
    share = await db.availability_share_requests.find_one({
        "$or": [
            {"requester_parent_id": viewer_id, "target_parent_id": other_id},
            {"requester_parent_id": other_id, "target_parent_id": viewer_id},
        ]
    }, {"_id": 0}, sort=[("created_at", -1)])
    if not share:
        return "none"
    if share["status"] == "approved":
        return "approved"
    if share["status"] == "pending":
        return "pending_sent" if share["requester_parent_id"] == viewer_id else "pending_received"
    return "none"


async def visible_slots_for_viewer(slots: List[Dict[str, Any]], viewer_id: str, owner_id: str) -> List[Dict[str, Any]]:
    visible = []
    sharing = None
    for slot in slots:
        mode = slot.get("visibility_mode", "everyone")
        if mode == "everyone":
            visible.append(slot)
        elif mode == "manual":
            if viewer_id in (slot.get("visible_to_parent_ids") or []):
                visible.append(slot)
        elif mode == "request_only":
            if sharing is None:
                sharing = await families_are_sharing(viewer_id, owner_id)
            if sharing:
                visible.append(slot)
    return visible


async def create_session(user_id: str, response: Response, session_token: Optional[str] = None) -> str:
    token = session_token or f"sess_{secrets.token_urlsafe(36)}"
    expires = datetime.now(timezone.utc) + timedelta(days=30)
    await db.user_sessions.insert_one(
        {
            "session_id": new_id("session"),
            "user_id": user_id,
            "session_token": token,
            "expires_at": expires.isoformat(),
            "created_at": now_iso(),
        }
    )
    response.set_cookie(
        "session_token",
        token,
        max_age=30 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    return token


async def current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("session_token")
    auth_header = request.headers.get("Authorization", "")
    if not token and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Session not found")
    if parse_expiry(session_doc["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return user_doc


def is_admin_email(email: str) -> bool:
    admin_emails = os.environ.get("ADMIN_EMAILS", "priti@ondek.co")
    allowed = {e.strip().lower() for e in admin_emails.split(",") if e.strip()}
    return (email or "").strip().lower() in allowed
    
async def require_admin(user: Dict[str, Any] = Depends(current_user)) -> Dict[str, Any]:
    if not is_admin_email(user.get("email", "")):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def notify_parent(parent_id: str, title: str, body: str, kind: str, reference_id: str = "") -> None:
    notification = {
        "notification_id": new_id("note"),
        "parent_id": parent_id,
        "title": title,
        "body": body,
        "kind": kind,
        "reference_id": reference_id,
        "read_at": None,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(notification)
    parent = await db.users.find_one({"user_id": parent_id}, {"_id": 0})
    if parent and parent.get("notification_preferences", {}).get("email", True):
        await send_resend_email(
            parent["email"],
            title,
            f"<div style='font-family:Arial,sans-serif;color:#2D2A27'><h2>{title}</h2><p>{body}</p><p style='color:#8C6E6E'>Playdates, sorted.</p></div>",
        )


async def ensure_global_seed() -> None:
    communities = [
        {"community_id": "comm_mulgrave", "name": "Mulgrave School", "type": "school", "city": "West Vancouver", "master_community_id": None},
        {"community_id": "comm_kits", "name": "Kitsilano North Families", "type": "neighborhood", "city": "Vancouver", "master_community_id": None},
    ] + [
        {"community_id": f"comm_mulgrave_{grade.lower().replace(' ', '_').replace('-', '')}", "name": f"Mulgrave {grade}", "type": "grade", "city": "West Vancouver", "master_community_id": "comm_mulgrave"}
        for grade in GRADES
    ]
    for community in communities:
        await db.communities.update_one(
            {"community_id": community["community_id"]},
            {"$setOnInsert": {**community, "created_by": "playpals", "status": "active", "created_at": now_iso()}},
            upsert=True,
        )

    sample_families = [
        ("sample_sarah", "Sarah Chen", "sarah.sample@playpals.local", "Riaan", 6, "Grade 1", ["Soccer", "Lego"]),
        ("sample_michelle", "Michelle Patel", "michelle.sample@playpals.local", "Emma", 8, "Grade 3", ["Art", "Animals"]),
        ("sample_david", "David Morgan", "david.sample@playpals.local", "Jake", 5, "Kindergarten", ["Nature", "Science"]),
        ("sample_priya", "Priya Shah", "priya.sample@playpals.local", "Anika", 7, "Grade 2", ["Dance", "Reading"]),
    ]
    today = date.today()
    upcoming = [(today + timedelta(days=i)).isoformat() for i in range(1, 15)]
    for idx, (user_id, name, email, child_name, age, grade, interests) in enumerate(sample_families):
        await db.users.update_one(
            {"user_id": user_id},
            {"$setOnInsert": {"user_id": user_id, "name": name, "email": email, "picture": "", "neighborhood": "West Vancouver", "contact_preference": "email", "notification_preferences": {"email": False, "push": True, "sms": False}, "phone": "", "created_at": now_iso(), "updated_at": now_iso()}},
            upsert=True,
        )
        await db.children.update_one(
            {"child_id": f"child_{user_id}"},
            {"$setOnInsert": {"child_id": f"child_{user_id}", "parent_id": user_id, "first_name": child_name, "age": age, "grade": grade, "school_id": "comm_mulgrave", "interests": interests, "allergies": "", "notes": "", "photo_url": "", "status": "active", "is_alumni": False, "created_at": now_iso()}},
            upsert=True,
        )
        grade_id = f"comm_mulgrave_{grade.lower().replace(' ', '_').replace('-', '')}"
        for community_id in ["comm_mulgrave", grade_id]:
            await db.community_members.update_one(
                {"community_id": community_id, "parent_id": user_id},
                {"$setOnInsert": {"membership_id": new_id("member"), "community_id": community_id, "parent_id": user_id, "status": "active", "sponsor_id": "playpals", "availability_visibility_mode": "everyone", "joined_at": now_iso(), "provisional_expires_at": None}},
                upsert=True,
            )
        slot_date = upcoming[(idx * 2 + 2) % len(upcoming)]
        await db.availability_slots.update_one(
            {"slot_id": f"slot_{user_id}_1"},
            {"$set": {"slot_id": f"slot_{user_id}_1", "parent_id": user_id, "date": slot_date, "blocks": [{"start": "15:00", "end": "17:30"}], "is_recurring": False, "recurrence_rule": "once", "source_date": slot_date, "is_paused": False, "visibility_mode": "everyone", "visible_to_parent_ids": [], "created_at": now_iso()}},
            upsert=True,
        )

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "PlayPals API ready", "version": "1.0"}


@api_router.post("/auth/magic-link")
async def request_magic_link(payload: MagicLinkRequest):
    email = clean_email(payload.email)
    token = f"magic_{secrets.token_urlsafe(32)}"
    await db.magic_links.insert_one(
        {
            "token": token,
            "email": email,
            "name": payload.name,
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=20)).isoformat(),
            "used_at": None,
            "created_at": now_iso(),
        }
    )
    link = f"{payload.origin}/auth/magic#token={token}"
    result = await send_resend_email(
        email,
        "Your PlayPals magic link",
        f"""
        <div style='font-family:Arial,sans-serif;background:#F5F0E8;padding:24px;color:#2D2A27'>
          <h1 style='margin:0 0 12px'>Less organizing. More playing.</h1>
          <p>Tap below to sign in to PlayPals. This link expires in 20 minutes.</p>
          <a href='{link}' style='display:inline-block;background:#C17A5A;color:white;padding:14px 18px;border-radius:16px;text-decoration:none;font-weight:700'>Open PlayPals →</a>
          <p style='color:#8C6E6E;font-size:13px;margin-top:18px'>If you did not request this, you can ignore this email.</p>
        </div>
        """,
    )
    return {"sent": result["sent"], "message": "Magic link requested", "email_status": result}


@api_router.post("/auth/magic/verify")
async def verify_magic_link(payload: MagicVerifyRequest, response: Response):
    link = await db.magic_links.find_one({"token": payload.token}, {"_id": 0})
    if not link or link.get("used_at"):
        raise HTTPException(status_code=401, detail="Magic link is invalid or already used")
    if parse_expiry(link["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Magic link expired")
    user = await upsert_user(link["email"], link.get("name"))
    await db.magic_links.update_one({"token": payload.token}, {"$set": {"used_at": now_iso()}})
    await create_session(user["user_id"], response)
    return {"user": await enrich_user(user)}


@api_router.post("/auth/oauth/session")
async def oauth_session(payload: OAuthSessionRequest, response: Response):
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    supabase_response = requests.get(
        f"{supabase_url}/auth/v1/user",
        headers={"Authorization": f"Bearer {payload.session_id}"},
        timeout=12,
    )
    if supabase_response.status_code >= 400:
        raise HTTPException(status_code=401, detail="Google session could not be verified")
    data = supabase_response.json()
    user_meta = data.get("user_metadata", {})
    user = await upsert_user(
        data["email"],
        user_meta.get("full_name") or user_meta.get("name"),
        user_meta.get("avatar_url") or user_meta.get("picture"),
    )
    await create_session(user["user_id"], response, payload.session_id)
    return {"user": await enrich_user(user)}


async def enrich_user(user: Dict[str, Any]) -> Dict[str, Any]:
    total = await credit_total(user["user_id"])
    enriched = {
        **user,
        "credits": total,
        "tier": tier_for_credits(total),
        "is_admin": is_admin_email(user.get("email", "")),
    }
    return enriched


@api_router.get("/auth/me")
async def auth_me(user: Dict[str, Any] = Depends(current_user)):
    return {"user": await enrich_user(user)}


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
    return {"ok": True}


@api_router.put("/profile")
async def update_parent_profile(payload: ParentProfileUpdate, user: Dict[str, Any] = Depends(current_user)):
    updates = {key: value for key, value in payload.model_dump().items() if value is not None}
    if updates.get("contact_preference") and updates["contact_preference"] not in ["email", "sms", "in_app"]:
        raise HTTPException(status_code=400, detail="Contact preference must be email, sms, or in_app")
    if updates:
        updates["updated_at"] = now_iso()
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"user": await enrich_user(updated)}


@api_router.get("/meta")
async def meta():
    return {"interests": INTERESTS, "grades": GRADES}


async def auto_pause_stale_slots(parent_id: str) -> bool:
    cutoff = (datetime.now(timezone.utc) - timedelta(weeks=4)).isoformat()
    stale = await db.availability_slots.find(
        {"parent_id": parent_id, "is_recurring": True, "is_paused": False, "last_confirmed_at": {"$lt": cutoff}},
        {"_id": 0, "slot_id": 1},
    ).to_list(500)
    if stale:
        await db.availability_slots.update_many({"slot_id": {"$in": [s["slot_id"] for s in stale]}}, {"$set": {"is_paused": True}})
    return bool(stale) or await db.availability_slots.count_documents({"parent_id": parent_id, "is_paused": True}) > 0


@api_router.get("/dashboard")
async def dashboard(user: Dict[str, Any] = Depends(current_user)):
    parent_id = user["user_id"]
    has_paused_availability = await auto_pause_stale_slots(parent_id)
    children = await db.children.find({"parent_id": parent_id}, {"_id": 0}).to_list(50)
    memberships = await db.community_members.find({"parent_id": parent_id}, {"_id": 0}).to_list(100)
    community_ids = [member["community_id"] for member in memberships]
    communities = await db.communities.find({"community_id": {"$in": community_ids}}, {"_id": 0}).to_list(100) if community_ids else []
    playdates = await get_playdates_for_parent(parent_id)
    notifications = await db.notifications.find({"parent_id": parent_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    availability = await db.availability_slots.find({"parent_id": parent_id}, {"_id": 0}).to_list(500)
    matches = await find_matches(parent_id)
    profile = await enrich_user(user)
    completed_count = await db.playdates.count_documents({"playdate_id": {"$in": [p["playdate_id"] for p in playdates]}, "status": "completed"}) if playdates else 0
    sharing_count = await db.availability_share_requests.count_documents({"$or": [{"requester_parent_id": parent_id, "status": "approved"}, {"target_parent_id": parent_id, "status": "approved"}]})
    return {
        "parent": profile,
        "children": children,
        "memberships": memberships,
        "communities": communities,
        "playdates": playdates,
        "notifications": notifications,
        "availability": availability,
        "matches": matches,
        "has_paused_availability": has_paused_availability,
        "stats": {"playdates_completed": completed_count, "credits_earned": profile["credits"], "families_sharing_with_me": sharing_count, "availability_slots": len([s for s in availability if not s.get("is_paused")])},
        "onboarding": {
            "has_child": len(children) > 0,
            "has_availability": len(availability) > 0,
            "has_community": len(memberships) > 0,
            "complete": bool(children and availability and memberships),
        },
    }


@api_router.post("/children")
async def create_child(payload: ChildCreate, user: Dict[str, Any] = Depends(current_user)):
    if payload.age < 3 or payload.age > 13:
        raise HTTPException(status_code=400, detail="PlayPals supports children ages 3–13")
    if payload.grade not in GRADES:
        raise HTTPException(status_code=400, detail="Grade must be Pre-K through Grade 7")
    if payload.status not in CHILD_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid child status")
    child = {
        "child_id": new_id("child"),
        "parent_id": user["user_id"],
        **payload.model_dump(),
        "is_alumni": False,
        "alumni_class_year": grade_class_year(payload.grade),
        "created_at": now_iso(),
    }
    await db.children.insert_one(child.copy())
    await add_credit(user["user_id"], 1, "completed_child_profile", child["child_id"])
    return child


@api_router.get("/children")
async def list_children(user: Dict[str, Any] = Depends(current_user)):
    return await db.children.find({"parent_id": user["user_id"]}, {"_id": 0}).to_list(50)


@api_router.put("/children/{child_id}")
async def update_child(child_id: str, payload: ChildUpdate, user: Dict[str, Any] = Depends(current_user)):
    child = await db.children.find_one({"child_id": child_id, "parent_id": user["user_id"]}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Child profile not found")
    updates = {key: value for key, value in payload.model_dump().items() if value is not None}
    if "age" in updates and (updates["age"] < 3 or updates["age"] > 13):
        raise HTTPException(status_code=400, detail="PlayPals supports children ages 3–13")
    if "grade" in updates and updates["grade"] not in GRADES:
        raise HTTPException(status_code=400, detail="Grade must be Pre-K through Grade 7")
    if "status" in updates and updates["status"] not in CHILD_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid child status")
    if updates:
        updates["updated_at"] = now_iso()
        await db.children.update_one({"child_id": child_id, "parent_id": user["user_id"]}, {"$set": updates})
    updated = await db.children.find_one({"child_id": child_id, "parent_id": user["user_id"]}, {"_id": 0})
    return updated


def validate_blocks(blocks: List[AvailabilityBlock]) -> List[Dict[str, str]]:
    normalized = sorted([{"start": block.start, "end": block.end} for block in blocks], key=lambda row: minutes(row["start"]))
    for idx, block in enumerate(normalized):
        if minutes(block["end"]) - minutes(block["start"]) < 15:
            raise HTTPException(status_code=400, detail="Please select at least a 15-minute window")
        if minutes(block["start"]) < 360 or minutes(block["end"]) > 1260:
            raise HTTPException(status_code=400, detail="Availability must be between 6:00 AM and 9:00 PM")
        if idx and minutes(block["start"]) < minutes(normalized[idx - 1]["end"]):
            raise HTTPException(status_code=400, detail="Time blocks cannot overlap")
    if len(normalized) > 4:
        raise HTTPException(status_code=400, detail="Maximum 4 time blocks per day")
    return normalized


def default_recurring_end_date(from_date: date) -> date:
    june_30_this_year = date(from_date.year, 6, 30)
    return june_30_this_year if june_30_this_year >= from_date else date(from_date.year + 1, 6, 30)


@api_router.post("/availability")
async def save_availability(payload: AvailabilityCreate, user: Dict[str, Any] = Depends(current_user)):
    selected_date = datetime.fromisoformat(payload.date).date()
    if selected_date < date.today():
        raise HTTPException(status_code=400, detail="Past dates are view only")
    blocks = validate_blocks(payload.blocks)
    if payload.visibility_mode not in ["everyone", "manual", "request_only"]:
        raise HTTPException(status_code=400, detail="Invalid visibility mode")

    if payload.recurring_end_date:
        end_boundary = datetime.fromisoformat(payload.recurring_end_date).date()
    else:
        end_boundary = default_recurring_end_date(selected_date)

    dates = [selected_date]
    if payload.recurrence == "weekly":
        dates = []
        cursor = selected_date
        while cursor <= end_boundary and len(dates) < 60:
            dates.append(cursor)
            cursor += timedelta(days=7)

    child_scopes = [[]] if not payload.child_ids else [[child_id] for child_id in payload.child_ids]

    saved = []
    for slot_date in dates:
        await db.availability_slots.delete_many({"parent_id": user["user_id"], "date": slot_date.isoformat()})
        for scope in child_scopes:
            doc = {
                "slot_id": new_id("slot"),
                "parent_id": user["user_id"],
                "date": slot_date.isoformat(),
                "blocks": blocks,
                "is_recurring": payload.recurrence == "weekly",
                "recurrence_rule": f"weekly:{selected_date.weekday()}" if payload.recurrence == "weekly" else "once",
                "recurring_end_date": end_boundary.isoformat() if payload.recurrence == "weekly" else None,
                "source_date": selected_date.isoformat(),
                "is_paused": False,
                "status": "open",
                "proposal_id": None,
                "ever_held": False,
                "visibility_mode": payload.visibility_mode,
                "visible_to_parent_ids": payload.visible_to_parent_ids if payload.visibility_mode == "manual" else [],
                "child_ids": scope,
                "created_at": now_iso(),
                "last_confirmed_at": now_iso(),
            }
            await db.availability_slots.insert_one(doc.copy())
            saved.append(doc)
    return {"saved": saved[:60], "count": len(saved)}


@api_router.get("/availability")
async def list_availability(user: Dict[str, Any] = Depends(current_user)):
    return await db.availability_slots.find({"parent_id": user["user_id"]}, {"_id": 0}).sort("date", 1).to_list(700)


@api_router.delete("/availability/{date_value}")
async def remove_availability(date_value: str, user: Dict[str, Any] = Depends(current_user)):
    await db.availability_slots.delete_many({"parent_id": user["user_id"], "date": date_value})
    return {"ok": True}


@api_router.get("/communities/by-slug/{slug}")
async def get_community_by_slug(slug: str, user: Dict[str, Any] = Depends(current_user)):
    community = await db.communities.find_one({"join_slug": slug, "status": "active"}, {"_id": 0})
    if not community:
        raise HTTPException(status_code=404, detail="Invalid or expired join link")
    return {"community": community}


@api_router.get("/communities")
async def list_communities(user: Dict[str, Any] = Depends(current_user)):
    memberships = await db.community_members.find({"parent_id": user["user_id"]}, {"_id": 0}).to_list(200)
    member_map = {member["community_id"]: member for member in memberships}
    community_ids = list(member_map.keys())
    communities = await db.communities.find({"community_id": {"$in": community_ids}, "status": "active"}, {"_id": 0}).sort("name", 1).to_list(200) if community_ids else []
    for community in communities:
        community["member_count"] = await db.community_members.count_documents({"community_id": community["community_id"], "status": {"$in": ["active", "provisional", "pending_sponsor", "alumni", "on_a_break", "moved_on", "graduate"]}})
        community["membership"] = member_map.get(community["community_id"])
    return communities


@api_router.get("/communities/search")
async def search_communities(q: str = "", user: Dict[str, Any] = Depends(current_user)):
    q = q.strip()
    if len(q) < 2:
        return []
    memberships = await db.community_members.find({"parent_id": user["user_id"]}, {"_id": 0}).to_list(200)
    joined_ids = [m["community_id"] for m in memberships]
    if not joined_ids:
        return []
    joined_masters = await db.communities.find({"community_id": {"$in": joined_ids}}, {"_id": 0}).to_list(200)
    master_ids = [c["community_id"] for c in joined_masters if not c.get("master_community_id")] + [c.get("master_community_id") for c in joined_masters if c.get("master_community_id")]
    master_ids = list(set(master_ids))
    if not master_ids:
        return []
    results = await db.communities.find(
        {"master_community_id": {"$in": master_ids}, "status": "active", "name": {"$regex": re.escape(q), "$options": "i"}},
        {"_id": 0, "community_id": 1, "name": 1, "city": 1, "master_community_id": 1}
    ).limit(20).to_list(20)
    for r in results:
        r["member_count"] = await db.community_members.count_documents({"community_id": r["community_id"], "status": {"$in": ["active", "provisional", "pending_sponsor", "alumni", "on_a_break", "moved_on", "graduate"]}})
    return results


@api_router.get("/communities/{community_id}")
async def community_detail(community_id: str, user: Dict[str, Any] = Depends(current_user)):
    community = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    membership = await db.community_members.find_one({"community_id": community_id, "parent_id": user["user_id"]}, {"_id": 0})
    master_id = community_id if not community.get("master_community_id") else community["master_community_id"]
    grade_rows = await db.communities.find({"master_community_id": master_id, "type": "grade", "status": "active"}, {"_id": 0}).sort("name", 1).to_list(20)
    for row in grade_rows:
        row["member_count"] = await db.community_members.count_documents({"community_id": row["community_id"], "status": "active"})
        row["membership"] = await db.community_members.find_one({"community_id": row["community_id"], "parent_id": user["user_id"]}, {"_id": 0})
    other_rows = await db.communities.find({"master_community_id": master_id, "type": {"$nin": ["grade", "school"]}}, {"_id": 0}).to_list(100)
    members = []
    if membership and membership.get("status") == "active":
        member_rows = await db.community_members.find({"community_id": community_id, "status": "active"}, {"_id": 0}).to_list(200)
        for row in member_rows:
            parent = await public_parent(row["parent_id"])
            children = await children_for_parent(row["parent_id"])
            if parent:
                parent["children"] = children
                parent["share_status"] = await share_status_between(user["user_id"], row["parent_id"])
                members.append(parent)
    community["member_count"] = await db.community_members.count_documents({"community_id": community_id})
    return {"community": community, "membership": membership, "grades": grade_rows, "other": other_rows, "members": members}


@api_router.post("/communities/check-duplicate")
async def check_community_duplicate(payload: CommunityCheckRequest, user: Dict[str, Any] = Depends(current_user)):
    existing = await db.communities.find({"status": {"$in": ["active", "pending_approval"]}}, {"_id": 0}).to_list(500)
    scored = []
    target = f"{payload.name} {payload.city or ''} {payload.type}"
    for community in existing:
        score = similarity(target, f"{community.get('name', '')} {community.get('city', '')} {community.get('type', '')}")
        if score >= 0.35:
            scored.append({"community": community, "score": round(score, 2), "status": "duplicate" if score >= 0.78 else "similar"})
    scored.sort(key=lambda row: row["score"], reverse=True)
    result = "unique"
    if scored and scored[0]["status"] == "duplicate":
        result = "duplicate"
    elif scored:
        result = "similar"
    return {"result": result, "matches": scored[:5]}


@api_router.post("/communities/{community_id}/add-sub")
async def add_sub_community(community_id: str, payload: AddSubCommunityRequest, user: Dict[str, Any] = Depends(current_user)):
    parent = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    if not parent:
        raise HTTPException(status_code=404, detail="Community not found")
    is_admin = is_admin_email(user.get("email", ""))
    membership = await db.community_members.find_one({"community_id": community_id, "parent_id": user["user_id"], "status": "active"}, {"_id": 0})
    if not membership and not is_admin:
        raise HTTPException(status_code=403, detail="You must be an active member of this community to request a sub-community")
    sub = {
        "community_id": new_id("comm"),
        "name": payload.name,
        "type": payload.type,
        "city": parent.get("city", ""),
        "master_community_id": community_id,
        "created_by": user["user_id"],
        "status": "active" if is_admin else "pending_approval",
        "join_slug": secrets.token_urlsafe(6),
        "created_at": now_iso(),
    }
    await db.communities.insert_one(sub.copy())
    return {"created": True, "community": sub}


@api_router.post("/communities")
async def create_community(payload: CommunityCreate, user: Dict[str, Any] = Depends(current_user)):
    duplicate = await check_community_duplicate(CommunityCheckRequest(name=payload.name, city=payload.city, type=payload.type), user)
    if duplicate["result"] == "duplicate":
        return {"created": False, "duplicate": duplicate["matches"][0]["community"]}
    is_admin = is_admin_email(user.get("email", ""))
    status = "active" if is_admin else "pending_approval"
    community = {
        "community_id": new_id("comm"),
        **payload.model_dump(),
        "created_by": user["user_id"],
        "status": status,
        "join_slug": secrets.token_urlsafe(6),
        "created_at": now_iso(),
    }
    await db.communities.insert_one(community.copy())
    if payload.type == "school":
        for grade in GRADES:
            await db.communities.insert_one({
                "community_id": new_id("comm"),
                "name": f"{payload.name} {grade}",
                "type": "grade",
                "city": payload.city,
                "master_community_id": community["community_id"],
                "created_by": user["user_id"],
                "status": status,
                "join_slug": secrets.token_urlsafe(6),
                "created_at": now_iso(),
            })
    if is_admin:
        await db.community_members.insert_one({"membership_id": new_id("member"), "community_id": community["community_id"], "parent_id": user["user_id"], "status": "active", "sponsor_id": None, "availability_visibility_mode": "everyone" if payload.type in ["school", "grade", "extracurricular"] else "request_only", "joined_at": now_iso(), "provisional_expires_at": None})
        await add_credit(user["user_id"], 5, "community_creator", community["community_id"])
    return {"created": True, "community": community, "duplicate_check": duplicate}


@api_router.post("/communities/{community_id}/approve")
async def approve_community(community_id: str, admin: Dict[str, Any] = Depends(require_admin)):
    community = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    if community["status"] == "active":
        return {"approved": True, "community": community}
    approved_at = now_iso()
    await db.communities.update_one({"community_id": community_id}, {"$set": {"status": "active", "approved_at": approved_at, "approved_by": admin["user_id"]}})
    await db.communities.update_many({"master_community_id": community_id, "status": "pending_approval"}, {"$set": {"status": "active", "approved_at": approved_at, "approved_by": admin["user_id"]}})
    creator_id = community.get("created_by")
    if creator_id:
        existing_membership = await db.community_members.find_one({"community_id": community_id, "parent_id": creator_id}, {"_id": 0})
        if not existing_membership:
            await db.community_members.insert_one({"membership_id": new_id("member"), "community_id": community_id, "parent_id": creator_id, "status": "active", "sponsor_id": None, "availability_visibility_mode": "everyone" if community.get("type") in ["school", "grade", "extracurricular"] else "request_only", "joined_at": now_iso(), "provisional_expires_at": None})
            await add_credit(creator_id, 5, "community_creator", community_id)
        await notify_parent(creator_id, "Community approved", f"{community['name']} is now live!", "community", community_id)
    updated = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    return {"approved": True, "community": updated}


@api_router.post("/communities/{community_id}/decline")
async def decline_community(community_id: str, payload: CommunityDeclineRequest, admin: Dict[str, Any] = Depends(require_admin)):
    community = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    if community["status"] == "declined":
        return {"declined": True, "community": community}
    reason = (payload.reason or "").strip() or None
    await db.communities.update_one({"community_id": community_id}, {"$set": {
        "status": "declined",
        "decline_reason": reason,
        "declined_at": now_iso(),
        "declined_by": admin["user_id"],
    }})
    await db.communities.update_many({"master_community_id": community_id, "status": "pending_approval"}, {"$set": {
        "status": "declined",
        "decline_reason": reason,
        "declined_at": now_iso(),
        "declined_by": admin["user_id"],
    }})
    creator_id = community.get("created_by")
    if creator_id:
        body = f"Your request to create \"{community['name']}\" wasn't approved."
        if reason:
            body += f" Reason: {reason}"
        await notify_parent(creator_id, "Community request declined", body, "community_declined", community_id)
    updated = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    return {"declined": True, "community": updated}


@api_router.get("/admin/communities/pending")
async def list_pending_communities(admin: Dict[str, Any] = Depends(require_admin)):
    pending = await db.communities.find({"status": "pending_approval"}, {"_id": 0}).sort("created_at", 1).to_list(200)
    # A pending sub-community whose master is also still pending will be
    # cascade-approved automatically the moment its master is (see
    # approve_community). Don't surface it here as its own item — that's what
    # was making every school request look like 1 school + 9 grade requests.
    # A sub-community whose master is already active (a club/group requested
    # independently, after the school exists) still needs its own decision,
    # so it stays visible.
    pending_ids = {c["community_id"] for c in pending}
    visible = [c for c in pending if c.get("master_community_id") not in pending_ids]
    return {"communities": visible}


@api_router.get("/admin/communities/approved")
async def list_approved_communities(admin: Dict[str, Any] = Depends(require_admin)):
    masters = await db.communities.find({"status": "active", "master_community_id": None}, {"_id": 0}).sort("name", 1).to_list(200)
    approver_names = {}

    async def approver_name(user_id):
        if not user_id:
            return None
        if user_id not in approver_names:
            approver = await db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1})
            approver_names[user_id] = approver["name"] if approver else None
        return approver_names[user_id]

    async def enrich(community):
        community["member_count"] = await db.community_members.count_documents({"community_id": community["community_id"], "status": "active"})
        community["approved_by_name"] = await approver_name(community.get("approved_by"))
        return community

    result = []
    for master in masters:
        master = await enrich(master)
        subs = await db.communities.find({"master_community_id": master["community_id"], "status": "active"}, {"_id": 0}).sort("name", 1).to_list(100)
        master["subs"] = [await enrich(sub) for sub in subs]
        result.append(master)
    return result


@api_router.post("/admin/add-family")
async def add_family(payload: AddFamilyRequest, admin: Dict[str, Any] = Depends(require_admin)):
    normalized = clean_email(payload.parent_email)
    existing = await db.users.find_one({"email": normalized}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="This parent already has an account")

    user = {
        "user_id": new_id("user"),
        "email": normalized,
        "name": payload.parent_name,
        "picture": "",
        "neighborhood": "",
        "contact_preference": "email",
        "notification_preferences": {"email": True, "push": True, "sms": False},
        "phone": "",
        "status": "pre_added",
        "needs_welcome": True,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.users.insert_one(user.copy())
    await add_credit(user["user_id"], 0, "account_created", user["user_id"])

    community_ids = {payload.community_id} | {child.grade_community_id for child in payload.children}
    for cid in community_ids:
        community = await db.communities.find_one({"community_id": cid}, {"_id": 0})
        if not community:
            continue
        await db.community_members.insert_one({
            "membership_id": new_id("member"),
            "community_id": cid,
            "parent_id": user["user_id"],
            "status": "active",
            "sponsor_id": None,
            "availability_visibility_mode": "everyone" if community.get("type") in ["school", "grade", "extracurricular"] else "request_only",
            "joined_at": now_iso(),
            "provisional_expires_at": None,
        })

    child_ids = []
    for child_input in payload.children:
        if not child_input.first_name:
            continue
        child = {
            "child_id": new_id("child"),
            "parent_id": user["user_id"],
            "first_name": child_input.first_name,
            "age": child_input.age or 0,
            "grade": child_input.grade,
            "school_id": None,
            "interests": [],
            "allergies": "",
            "notes": "",
            "photo_url": None,
            "status": "active",
            "is_alumni": False,
            "alumni_class_year": grade_class_year(child_input.grade),
            "claimed": False,
            "created_at": now_iso(),
        }
        await db.children.insert_one(child.copy())
        child_ids.append(child["child_id"])

    return {"parent_id": user["user_id"], "child_ids": child_ids, "status": "added"}


async def ensure_master_membership(community: Dict[str, Any], parent_id: str) -> None:
    # Silent bookkeeping only: a grade member should also hold an active
    # membership in the grade's master (school) community, even though there's
    # no school-wide feed yet to surface it in. This means we won't need to
    # backfill/migrate existing grade members when that feature ships.
    master_id = community.get("master_community_id")
    if not master_id:
        return
    if await db.community_members.find_one({"community_id": master_id, "parent_id": parent_id}, {"_id": 0}):
        return
    master = await db.communities.find_one({"community_id": master_id}, {"_id": 0})
    if not master:
        return
    await db.community_members.insert_one({
        "membership_id": new_id("member"),
        "community_id": master_id,
        "parent_id": parent_id,
        "status": "active",
        "sponsor_id": None,
        "class_or_teacher": None,
        "availability_visibility_mode": "everyone" if master.get("type") in ["school", "grade", "extracurricular"] else "request_only",
        "joined_at": now_iso(),
        "provisional_expires_at": None,
    })


@api_router.post("/communities/join")
async def join_community(payload: JoinCommunityRequest, user: Dict[str, Any] = Depends(current_user)):
    community = await db.communities.find_one({"community_id": payload.community_id}, {"_id": 0})
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    existing = await db.community_members.find_one({"community_id": payload.community_id, "parent_id": user["user_id"]}, {"_id": 0})
    if existing:
        await ensure_master_membership(community, user["user_id"])
        return {"membership": existing, "community": community, "already_member": True}
    membership = {
        "membership_id": new_id("member"),
        "community_id": payload.community_id,
        "parent_id": user["user_id"],
        "status": "active",
        "sponsor_id": None,
        "class_or_teacher": payload.class_or_teacher,
        "availability_visibility_mode": "everyone" if community.get("type") in ["school", "grade", "extracurricular"] else "request_only",
        "joined_at": now_iso(),
        "provisional_expires_at": None,
    }
    await db.community_members.insert_one(membership.copy())
    await ensure_master_membership(community, user["user_id"])
    await notify_parent(user["user_id"], "Community joined", f"You're now a member of {community['name']}.", "community", payload.community_id)
    return {"membership": membership, "community": community, "already_member": False}


@api_router.post("/communities/{community_id}/tag-sponsor")
async def tag_sponsor(community_id: str, payload: TagSponsorRequest, user: Dict[str, Any] = Depends(current_user)):
    membership = await db.community_members.find_one({"community_id": community_id, "parent_id": user["user_id"]}, {"_id": 0})
    if not membership:
        raise HTTPException(status_code=404, detail="You are not a member of this community")
    sponsor = await db.users.find_one({"user_id": payload.sponsor_id}, {"_id": 0})
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    sponsor_membership = await db.community_members.find_one({"community_id": community_id, "parent_id": payload.sponsor_id}, {"_id": 0})
    if not sponsor_membership:
        raise HTTPException(status_code=400, detail="Sponsor is not a member of this community")
    await db.community_members.update_one({"community_id": community_id, "parent_id": user["user_id"]}, {"$set": {"sponsor_id": payload.sponsor_id}})
    community = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    community_name = community["name"] if community else "your community"
    await notify_parent(payload.sponsor_id, "Someone knows you!", f"{user['name']} said they know you in {community_name}.", "sponsor_tag", community_id)
    await add_credit(payload.sponsor_id, 2, "sponsored_join", community_id)
    await add_credit(user["user_id"], 1, "tagged_sponsor", community_id)
    return {"tagged": True}


@api_router.post("/communities/{community_id}/step-back")
async def step_back_community(community_id: str, payload: StepBackRequest, user: Dict[str, Any] = Depends(current_user)):
    status = status_from_step_back(payload.reason)
    updates = {"status": status, "stepped_back_at": now_iso(), "step_back_reason": payload.reason}
    if status == "on_a_break":
        days = {"2_weeks": 14, "1_month": 30, "3_months": 90}.get(payload.duration or "2_weeks", 14)
        updates["reactivates_at"] = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    result = await db.community_members.update_one({"community_id": community_id, "parent_id": user["user_id"]}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Membership not found")
    community = await db.communities.find_one({"community_id": community_id}, {"_id": 0})
    return {"status": status, "message": f"You've stepped back from {community['name']}. Your history and credits are safe. 💛"}


@api_router.put("/communities/{community_id}/visibility")
async def update_community_visibility(community_id: str, payload: VisibilityUpdate, user: Dict[str, Any] = Depends(current_user)):
    if payload.visibility_mode not in ["everyone", "manual", "request_only"]:
        raise HTTPException(status_code=400, detail="Invalid visibility mode")
    result = await db.community_members.update_one({"community_id": community_id, "parent_id": user["user_id"]}, {"$set": {"availability_visibility_mode": payload.visibility_mode, "visible_to_parent_ids": payload.visible_to_parent_ids, "updated_at": now_iso()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Membership not found")
    return {"ok": True}


@api_router.post("/availability-share-requests")
async def request_availability_share(payload: AvailabilityShareRequestCreate, user: Dict[str, Any] = Depends(current_user)):
    if payload.target_parent_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot request yourself")
    existing = await db.availability_share_requests.find_one({"requester_parent_id": user["user_id"], "target_parent_id": payload.target_parent_id, "status": {"$in": ["pending", "approved"]}}, {"_id": 0})
    if existing:
        return existing
    target_membership = await db.community_members.find_one({"parent_id": payload.target_parent_id, "availability_visibility_mode": "everyone"}, {"_id": 0})
    status = "approved" if target_membership else "pending"
    request_doc = {"request_id": new_id("share"), "requester_parent_id": user["user_id"], "target_parent_id": payload.target_parent_id, "community_id": payload.community_id, "status": status, "created_at": now_iso(), "responded_at": now_iso() if status == "approved" else None}
    await db.availability_share_requests.insert_one(request_doc.copy())
    if status == "approved":
        await add_credit(user["user_id"], 1, "availability_share", payload.target_parent_id)
        await add_credit(payload.target_parent_id, 1, "availability_share", user["user_id"])
    else:
        await notify_parent(payload.target_parent_id, "Availability share request", f"{user['name']} wants to share availability with you", "availability_share", request_doc["request_id"])
    return request_doc


@api_router.get("/availability-share-requests/pending")
async def pending_availability_share_requests(user: Dict[str, Any] = Depends(current_user)):
    requests_list = await db.availability_share_requests.find({"target_parent_id": user["user_id"], "status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for row in requests_list:
        row["requester"] = await public_parent(row["requester_parent_id"])
    return [row for row in requests_list if row["requester"]]


@api_router.post("/availability-share-requests/{request_id}/respond")
async def respond_availability_share(request_id: str, payload: AvailabilityShareResponse, user: Dict[str, Any] = Depends(current_user)):
    share = await db.availability_share_requests.find_one({"request_id": request_id, "target_parent_id": user["user_id"], "status": "pending"}, {"_id": 0})
    if not share:
        raise HTTPException(status_code=404, detail="Share request not found")
    status = "approved" if payload.action == "approve" else "declined"
    await db.availability_share_requests.update_one({"request_id": request_id}, {"$set": {"status": status, "responded_at": now_iso()}})
    if status == "approved":
        await add_credit(user["user_id"], 1, "availability_share", share["requester_parent_id"])
        await add_credit(share["requester_parent_id"], 1, "availability_share", user["user_id"])
        await notify_parent(share["requester_parent_id"], "Availability sharing approved", f"You're now sharing availability with {user['name']} 🎉", "availability_share", request_id)
    return {"status": status}


@api_router.post("/matches/dismiss")
async def dismiss_match(payload: MatchDismissalCreate, user: Dict[str, Any] = Depends(current_user)):
    if payload.dismissal_type not in ["not_this_week", "dont_suggest_again"]:
        raise HTTPException(status_code=400, detail="Invalid dismissal type")
    doc = {"dismissal_id": new_id("dismiss"), "dismisser_parent_id": user["user_id"], "target_parent_id": payload.target_parent_id, "dismissal_type": payload.dismissal_type, "created_at": now_iso()}
    await db.match_dismissals.insert_one(doc.copy())
    return doc


@api_router.get("/sponsor-requests")
async def sponsor_requests(user: Dict[str, Any] = Depends(current_user)):
    requests_list = await db.community_members.find({"sponsor_id": user["user_id"], "status": "pending_sponsor"}, {"_id": 0}).to_list(100)
    for row in requests_list:
        row["community"] = await db.communities.find_one({"community_id": row["community_id"]}, {"_id": 0})
        row["parent"] = await db.users.find_one({"user_id": row["parent_id"]}, {"_id": 0})
        row["children"] = await db.children.find({"parent_id": row["parent_id"], "claimed": {"$ne": False}}, {"_id": 0}).to_list(10)
    return requests_list


@api_router.post("/sponsor-requests/{membership_id}/respond")
async def respond_sponsor_request(membership_id: str, payload: SponsorResponse, user: Dict[str, Any] = Depends(current_user)):
    membership = await db.community_members.find_one({"membership_id": membership_id, "sponsor_id": user["user_id"], "status": "pending_sponsor"}, {"_id": 0})
    if not membership:
        raise HTTPException(status_code=404, detail="Sponsor request not found")
    community = await db.communities.find_one({"community_id": membership["community_id"]}, {"_id": 0})
    if payload.action == "approve":
        await db.community_members.update_one({"membership_id": membership_id}, {"$set": {"status": "active", "approved_at": now_iso()}})
        await add_credit(user["user_id"], 2, "sponsored_member", membership["parent_id"])
        await add_credit(membership["parent_id"], 1, "joined_with_sponsor", membership["community_id"])
        await notify_parent(membership["parent_id"], "Sponsor approved", f"You're active in {community['name']}.", "community", membership["community_id"])
        return {"status": "active"}
    if payload.action == "decline":
        await db.community_members.update_one({"membership_id": membership_id}, {"$set": {"status": "declined", "declined_at": now_iso()}})
        await notify_parent(membership["parent_id"], "Sponsor declined", f"You can name a different sponsor for {community['name']}.", "community", membership["community_id"])
        return {"status": "declined"}
    raise HTTPException(status_code=400, detail="Action must be approve or decline")


async def common_community_parent_ids(parent_id: str) -> List[str]:
    memberships = await db.community_members.find({"parent_id": parent_id, "status": {"$in": ["active", "provisional", "pending_sponsor"]}}, {"_id": 0}).to_list(100)
    community_ids = [m["community_id"] for m in memberships]
    if not community_ids:
        return []
    peer_members = await db.community_members.find({"community_id": {"$in": community_ids}, "status": {"$in": ["active", "provisional", "pending_sponsor"]}}, {"_id": 0}).to_list(500)
    return list({m["parent_id"] for m in peer_members if m["parent_id"] != parent_id})


async def availability_feed(parent_id: str) -> List[Dict[str, Any]]:
    peers = await common_community_parent_ids(parent_id)
    start = date.today().isoformat()
    end = (date.today() + timedelta(days=21)).isoformat()
    rows = []
    for peer_id in peers:
        parent = await public_parent(peer_id)
        if not parent:
            continue
        children = await db.children.find({"parent_id": peer_id, "claimed": {"$ne": False}}, {"_id": 0, "allergies": 0}).to_list(10)
        raw_slots = await db.availability_slots.find({"parent_id": peer_id, "date": {"$gte": start, "$lte": end}, "is_paused": False}, {"_id": 0}).sort("date", 1).to_list(30)
        slots = await visible_slots_for_viewer(raw_slots, parent_id, peer_id)
        family_rows = []
        for slot in slots:
            scoped_ids = slot.get("child_ids") or []
            target_children = [c for c in children if c["child_id"] in scoped_ids] if scoped_ids else children
            for child in target_children:
                family_rows.append({
                    "family_id": peer_id,
                    "parent_name": parent["name"],
                    "parent_picture": parent.get("picture", ""),
                    "child_id": child["child_id"],
                    "child_name": child["first_name"],
                    "grade": child.get("grade"),
                    "slot_id": slot["slot_id"],
                    "date": slot["date"],
                    "slot_time": slot.get("blocks", []),
                    "status": slot.get("status", "open"),
                })
        for row in family_rows:
            row["family_total_slots"] = len(family_rows)
        rows.extend(family_rows)
    return rows


@api_router.get("/community-feed")
async def community_feed(user: Dict[str, Any] = Depends(current_user)):
    return {"rows": await availability_feed(user["user_id"]), "matches": await find_matches(user["user_id"])}


@api_router.get("/community-members")
async def community_members(user: Dict[str, Any] = Depends(current_user)):
    peer_ids = await common_community_parent_ids(user["user_id"])
    members = [m for m in [await public_parent(pid) for pid in peer_ids] if m]
    members.sort(key=lambda m: m["name"])
    return members


async def find_matches(parent_id: str) -> List[Dict[str, Any]]:
    own_slots = await db.availability_slots.find({"parent_id": parent_id, "date": {"$gte": date.today().isoformat()}, "is_paused": False}, {"_id": 0}).to_list(500)
    if not own_slots:
        return []
    peers = await common_community_parent_ids(parent_id)
    matches = []
    own_by_date = {}
    for slot in own_slots:
        own_by_date.setdefault(slot["date"], []).extend(slot.get("blocks", []))
    for peer_id in peers:
        if await match_pair_suppressed(parent_id, peer_id):
            continue
        raw_peer_slots = await db.availability_slots.find({"parent_id": peer_id, "date": {"$in": list(own_by_date.keys())}, "is_paused": False}, {"_id": 0}).to_list(100)
        peer_slots = await visible_slots_for_viewer(raw_peer_slots, parent_id, peer_id)
        for slot in peer_slots:
            for own_block in own_by_date.get(slot["date"], []):
                for peer_block in slot.get("blocks", []):
                    start = max(minutes(own_block["start"]), minutes(peer_block["start"]))
                    end = min(minutes(own_block["end"]), minutes(peer_block["end"]))
                    if end - start >= 90:
                        parent = await public_parent(peer_id)
                        peer_children = await db.children.find({"parent_id": peer_id, "claimed": {"$ne": False}}, {"_id": 0, "allergies": 0}).to_list(10)
                        own_children = await db.children.find({"parent_id": parent_id}, {"_id": 0}).to_list(10)
                        interest_overlap = len(set((peer_children[0].get("interests", []) if peer_children else [])) & set((own_children[0].get("interests", []) if own_children else [])))
                        score = min(96, 55 + min(25, int((end - start - 90) / 3)) + interest_overlap * 6)
                        matches.append({
                            "match_id": f"match_{peer_id}_{slot['date']}_{start}",
                            "parent": parent,
                            "children": peer_children,
                            "own_children": own_children,
                            "date": slot["date"],
                            "start_time": f"{start // 60:02d}:{start % 60:02d}",
                            "end_time": f"{end // 60:02d}:{end % 60:02d}",
                            "duration_minutes": end - start,
                            "score": score,
                            "score_label": "Great match" if score >= 80 else "Good overlap",
                        })
    matches.sort(key=lambda row: row["duration_minutes"], reverse=True)
    return matches[:8]


async def get_playdates_for_parent(parent_id: str) -> List[Dict[str, Any]]:
    participant_rows = await db.playdate_participants.find({"parent_id": parent_id}, {"_id": 0}).to_list(500)
    ids = [row["playdate_id"] for row in participant_rows]
    organized = await db.playdates.find({"organizer_id": parent_id}, {"_id": 0}).to_list(500)
    all_ids = list({*ids, *[row["playdate_id"] for row in organized]})
    if not all_ids:
        return []
    playdates = await db.playdates.find({"playdate_id": {"$in": all_ids}}, {"_id": 0}).sort("date", 1).to_list(500)
    for playdate in playdates:
        participants = await db.playdate_participants.find({"playdate_id": playdate["playdate_id"]}, {"_id": 0}).to_list(20)
        for participant in participants:
            participant["parent"] = await public_parent(participant["parent_id"])
            participant["children"] = await db.children.find({"child_id": {"$in": participant.get("child_ids", [])}, "claimed": {"$ne": False}}, {"_id": 0}).to_list(10)
        playdate["participants"] = participants
    return playdates


@api_router.get("/playdates")
async def list_playdates(user: Dict[str, Any] = Depends(current_user)):
    return await get_playdates_for_parent(user["user_id"])


@api_router.post("/playdates")
async def create_playdate(payload: PlaydateCreate, user: Dict[str, Any] = Depends(current_user)):
    playdate_id = new_id("playdate")
    title = payload.title or ("Group Playdate" if payload.type == "group" else "1:1 Playdate")
    playdate = {
        "playdate_id": playdate_id,
        "type": payload.type,
        "organizer_id": user["user_id"],
        "title": title,
        "date": payload.date,
        "start_time": payload.start_time,
        "end_time": payload.end_time,
        "location": payload.location,
        "activity": payload.activity,
        "notes": payload.notes,
        "status": "proposed",
        "min_confirmations": payload.min_confirmations,
        "cancellation_reason": None,
        "reschedule_rounds": 0,
        "created_at": now_iso(),
    }
    await db.playdates.insert_one(playdate.copy())
    if payload.slot_id:
        slot = await db.availability_slots.find_one({"slot_id": payload.slot_id}, {"_id": 0})
        if slot and slot["parent_id"] in payload.invitee_parent_ids:
            await db.availability_slots.update_one({"slot_id": payload.slot_id}, {"$set": {"status": "held", "proposal_id": playdate_id, "ever_held": True}})
    for invitee in payload.invitee_parent_ids:
        await db.match_dismissals.delete_many({"dismisser_parent_id": user["user_id"], "target_parent_id": invitee, "dismissal_type": "dont_suggest_again"})
    await db.playdate_participants.insert_one({"participant_id": new_id("part"), "playdate_id": playdate_id, "parent_id": user["user_id"], "child_ids": payload.child_ids, "rsvp_status": "accepted", "responded_at": now_iso(), "shared_contact": None})
    for invitee in payload.invitee_parent_ids[:6]:
        await db.playdate_participants.insert_one({"participant_id": new_id("part"), "playdate_id": playdate_id, "parent_id": invitee, "child_ids": [], "rsvp_status": "invited", "responded_at": None, "shared_contact": None})
        await notify_parent(invitee, "Playdate proposal received", f"{user['name']} proposed {payload.activity} on {date_label(payload.date)} from {time_label(payload.start_time)}–{time_label(payload.end_time)}.", "playdate", playdate_id)
    return {"playdate": playdate}


@api_router.post("/playdates/{playdate_id}/respond")
async def respond_playdate(playdate_id: str, payload: PlaydateResponseAction, user: Dict[str, Any] = Depends(current_user)):
    playdate = await db.playdates.find_one({"playdate_id": playdate_id}, {"_id": 0})
    if not playdate:
        raise HTTPException(status_code=404, detail="Playdate not found")
    participant = await db.playdate_participants.find_one({"playdate_id": playdate_id, "parent_id": user["user_id"]}, {"_id": 0})
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant")
    if payload.action == "accept":
        if playdate.get("status") == "countered" and playdate.get("counter"):
            counter = playdate["counter"]
            await db.playdate_participants.update_one({"participant_id": participant["participant_id"]}, {"$set": {"rsvp_status": "accepted", "responded_at": now_iso()}})
            await db.playdate_participants.update_one({"playdate_id": playdate_id, "parent_id": counter["from_parent_id"]}, {"$set": {"rsvp_status": "accepted", "responded_at": now_iso()}})
            await db.playdates.update_one({"playdate_id": playdate_id}, {"$set": {
                "status": "confirmed",
                "date": counter["date"],
                "start_time": counter["start_time"],
                "end_time": counter["end_time"],
            }})
            await notify_parent(counter["from_parent_id"], "Playdate confirmed!", f"{user['name']} accepted your suggested time. {playdate['activity']} is confirmed.", "playdate", playdate_id)
        else:
            await db.playdate_participants.update_one({"participant_id": participant["participant_id"]}, {"$set": {"rsvp_status": "accepted", "responded_at": now_iso()}})
            accepted = await db.playdate_participants.count_documents({"playdate_id": playdate_id, "rsvp_status": "accepted"})
            if accepted >= max(2, playdate.get("min_confirmations", 1)):
                await db.playdates.update_one({"playdate_id": playdate_id}, {"$set": {"status": "confirmed"}})
                await notify_parent(playdate["organizer_id"], "Playdate confirmed!", f"{user['name']} accepted. {playdate['activity']} is confirmed.", "playdate", playdate_id)
    elif payload.action == "decline":
        await db.playdate_participants.update_one({"participant_id": participant["participant_id"]}, {"$set": {"rsvp_status": "declined", "responded_at": now_iso()}})
        await db.playdates.update_one({"playdate_id": playdate_id}, {"$set": {"status": "cancelled"}})
        await db.availability_slots.update_many({"proposal_id": playdate_id}, {"$set": {"status": "open", "proposal_id": None}})
        others = await db.playdate_participants.find({"playdate_id": playdate_id, "parent_id": {"$ne": user["user_id"]}}, {"_id": 0}).to_list(20)
        for other in others:
            await notify_parent(other["parent_id"], "Playdate declined", f"{user['name']} can't make this one.", "playdate", playdate_id)
    elif payload.action == "counter":
        await db.playdates.update_one({"playdate_id": playdate_id}, {"$set": {"status": "countered", "counter": {"date": payload.counter_date, "start_time": payload.counter_start_time, "end_time": payload.counter_end_time, "from_parent_id": user["user_id"], "created_at": now_iso()}}})
        others = await db.playdate_participants.find({"playdate_id": playdate_id, "parent_id": {"$ne": user["user_id"]}}, {"_id": 0}).to_list(20)
        for other in others:
            await notify_parent(other["parent_id"], "Counter-proposal received", f"{user['name']} suggested another time.", "playdate", playdate_id)
    return {"playdate": await db.playdates.find_one({"playdate_id": playdate_id}, {"_id": 0})}


@api_router.post("/playdates/{playdate_id}/reschedule")
async def reschedule_playdate(playdate_id: str, payload: RescheduleRequest, user: Dict[str, Any] = Depends(current_user)):
    playdate = await db.playdates.find_one({"playdate_id": playdate_id}, {"_id": 0})
    if not playdate:
        raise HTTPException(status_code=404, detail="Playdate not found")
    participant = await db.playdate_participants.find_one({"playdate_id": playdate_id, "parent_id": user["user_id"]}, {"_id": 0})
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant")
    if playdate.get("reschedule_rounds", 0) >= 3:
        raise HTTPException(status_code=400, detail="This one seems tricky — want to cancel and try a fresh date?")
    await db.playdates.update_one({"playdate_id": playdate_id}, {"$set": {
        "status": "countered",
        "counter": {"date": payload.date, "start_time": payload.start_time, "end_time": payload.end_time, "from_parent_id": user["user_id"], "created_at": now_iso()},
    }, "$inc": {"reschedule_rounds": 1}})
    others = await db.playdate_participants.find({"playdate_id": playdate_id, "parent_id": {"$ne": user["user_id"]}}, {"_id": 0}).to_list(20)
    for other in others:
        await notify_parent(other["parent_id"], "Reschedule request", f"{user['name']} suggested a new time for {playdate['activity']}.", "playdate", playdate_id)
    return {"ok": True}


@api_router.post("/playdates/{playdate_id}/cancel")
async def cancel_playdate(playdate_id: str, payload: CancelRequest, user: Dict[str, Any] = Depends(current_user)):
    playdate = await db.playdates.find_one({"playdate_id": playdate_id}, {"_id": 0})
    if not playdate:
        raise HTTPException(status_code=404, detail="Playdate not found")
    await db.playdates.update_one({"playdate_id": playdate_id}, {"$set": {"status": "cancelled", "cancellation_reason": payload.reason, "cancelled_by": user["user_id"], "cancelled_at": now_iso()}})
    await db.availability_slots.update_many({"proposal_id": playdate_id}, {"$set": {"status": "open", "proposal_id": None}})
    participants = await db.playdate_participants.find({"playdate_id": playdate_id, "parent_id": {"$ne": user["user_id"]}}, {"_id": 0}).to_list(20)
    for participant in participants:
        await notify_parent(participant["parent_id"], "Playdate cancelled", f"{user['name']} cancelled: {payload.reason}.", "playdate", playdate_id)
    return {"ok": True}


@api_router.post("/playdates/{playdate_id}/complete")
async def complete_playdate(playdate_id: str, user: Dict[str, Any] = Depends(current_user)):
    playdate = await db.playdates.find_one({"playdate_id": playdate_id}, {"_id": 0})
    if not playdate:
        raise HTTPException(status_code=404, detail="Playdate not found")
    await db.playdates.update_one({"playdate_id": playdate_id}, {"$set": {"status": "completed", "completed_at": now_iso()}})
    participants = await db.playdate_participants.find({"playdate_id": playdate_id}, {"_id": 0}).to_list(20)
    for participant in participants:
        amount = 2 if participant["parent_id"] == playdate["organizer_id"] else 1
        await add_credit(participant["parent_id"], amount, "completed_playdate", playdate_id)
        await notify_parent(participant["parent_id"], "Hope it was a blast! 🎉", "Your PlayPals credits have been added.", "credits", playdate_id)
    return {"ok": True}


@api_router.post("/playdates/{playdate_id}/reaction")
async def add_reaction(playdate_id: str, payload: ReactionRequest, user: Dict[str, Any] = Depends(current_user)):
    await db.emoji_reactions.update_one({"playdate_id": playdate_id, "parent_id": user["user_id"]}, {"$set": {"reaction_id": new_id("react"), "playdate_id": playdate_id, "parent_id": user["user_id"], "reaction": payload.reaction, "created_at": now_iso()}}, upsert=True)
    return {"ok": True}


@api_router.post("/playdates/{playdate_id}/memory")
async def add_memory(playdate_id: str, payload: MemoryNoteRequest, user: Dict[str, Any] = Depends(current_user)):
    memory = {"memory_id": new_id("memory"), "playdate_id": playdate_id, "parent_id": user["user_id"], **payload.model_dump(), "created_at": now_iso()}
    await db.memory_notes.insert_one(memory.copy())
    return memory


@api_router.get("/playdates/{playdate_id}/messages")
async def list_messages(playdate_id: str, user: Dict[str, Any] = Depends(current_user)):
    participant = await db.playdate_participants.find_one({"playdate_id": playdate_id, "parent_id": user["user_id"]}, {"_id": 0})
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant")
    return await db.messages.find({"playdate_id": playdate_id}, {"_id": 0}).sort("created_at", 1).to_list(500)


@api_router.post("/playdates/{playdate_id}/messages")
async def send_message(playdate_id: str, payload: ChatMessageCreate, user: Dict[str, Any] = Depends(current_user)):
    playdate = await db.playdates.find_one({"playdate_id": playdate_id}, {"_id": 0})
    participant = await db.playdate_participants.find_one({"playdate_id": playdate_id, "parent_id": user["user_id"]}, {"_id": 0})
    if not playdate or not participant:
        raise HTTPException(status_code=403, detail="Chat unavailable")
    if playdate["status"] in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="This playdate has ended. Start a new one?")
    # Chat is available as soon as a proposal exists (sender + receiver), not just
    # after Accept/Confirm — matches the frontend's chatAvailable logic in App.js
    # (PlaydateCard). See Playdate_Card_Actions_Spec_2026-08-23.md for the decision.
    if playdate["status"] not in ["proposed", "confirmed", "rescheduled", "countered"]:
        raise HTTPException(status_code=400, detail="Chat is not available for this playdate")
    message = {"message_id": new_id("msg"), "playdate_id": playdate_id, "sender_id": user["user_id"], "sender_name": user["name"], "content": payload.content, "created_at": now_iso(), "read_at": None}
    await db.messages.insert_one(message.copy())
    # Notify every other participant regardless of RSVP status (invited/accepted/etc) —
    # chat is open on proposed/countered playdates too, so a not-yet-accepted parent
    # still needs to be alerted to a new message. Only exclude parents who declined.
    participants = await db.playdate_participants.find({"playdate_id": playdate_id, "parent_id": {"$ne": user["user_id"]}, "rsvp_status": {"$ne": "declined"}}, {"_id": 0}).to_list(20)
    for participant_row in participants:
        await notify_parent(participant_row["parent_id"], "New playdate chat message", f"{user['name']}: {payload.content[:80]}", "chat", playdate_id)
    return message


@api_router.post("/playdates/{playdate_id}/share-contact")
async def share_contact(playdate_id: str, payload: ContactShareRequest, user: Dict[str, Any] = Depends(current_user)):
    value = user.get("phone") if payload.method == "phone" else user.get("email")
    await db.playdate_participants.update_one({"playdate_id": playdate_id, "parent_id": user["user_id"]}, {"$set": {"shared_contact": {"method": payload.method, "value": value, "shared_at": now_iso()}}})
    return {"ok": True}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the router in the main app
app.include_router(api_router)

cors_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
cors_kwargs = {"allow_credentials": True, "allow_methods": ["*"], "allow_headers": ["*"]}
if "*" in cors_origins:
    cors_kwargs["allow_origins"] = [
        "https://pals-availability.preview.emergentagent.com",
        "https://c959650a-19c2-4536-8433-f2d6f78d1686.preview.emergentagent.com",
    ]
    cors_kwargs["allow_origin_regex"] = r"https://(.*\.)?(preview\.emergentagent\.com|vercel\.app|playpals\.ondek\.co)$"
else:
    cors_kwargs["allow_origins"] = cors_origins
app.add_middleware(CORSMiddleware, **cors_kwargs)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_seed():
    pass  # Demo seed data disabled for production testing

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
