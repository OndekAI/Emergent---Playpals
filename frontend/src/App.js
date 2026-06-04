import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/App.css";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Baby,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Home,
  Mail,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
  UserRound,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const fmtDate = (value, options = {}) => {
  const date = typeof value === "string" ? new Date(`${value}T12:00:00`) : value;
  return date.toLocaleDateString(undefined, options);
};

const isoDate = (date) => {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
};

const timeLabel = (value) => {
  const [h, m] = value.split(":").map(Number);
  return new Date(2026, 4, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const timeOptions = Array.from({ length: 61 }, (_, i) => {
  const total = 6 * 60 + i * 15;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
});

const minutes = (value) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};

const api = async (path, options = {}) => {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.detail || "Something went wrong");
  return data;
};

function LogoMark({ testId = "logo-mark" }) {
  return (
    <div className="logo-mark" data-testid={testId} aria-label="PlayPals logo">
      <span /><span /><span />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="app-shell loading-screen" data-testid="loading-screen">
      <div className="stack" style={{ alignItems: "center" }}>
        <LogoMark testId="loading-logo" />
        <div className="spinner" data-testid="loading-spinner" />
        <p className="muted" data-testid="loading-text">Sorting playdates…</p>
      </div>
    </div>
  );
}

function AuthCallback({ refresh }) {
  const processed = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = new URLSearchParams(window.location.hash.replace("#", ""));
    const sessionId = hash.get("session_id");
    const magicToken = hash.get("token");
    const run = async () => {
      try {
        if (sessionId) await api("/auth/oauth/session", { method: "POST", body: JSON.stringify({ session_id: sessionId }) });
        if (magicToken) await api("/auth/magic/verify", { method: "POST", body: JSON.stringify({ token: magicToken }) });
        window.history.replaceState({}, "", "/home");
        await refresh();
        navigate("/home", { replace: true });
      } catch (error) {
        toast.error(error.message);
        navigate("/login", { replace: true });
      }
    };
    run();
  }, [navigate, refresh]);

  return <LoadingScreen />;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/home";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const requestMagic = async (event) => {
    event.preventDefault();
    if (!emailOpen) {
      setEmailOpen(true);
      return;
    }
    if (!email) return toast.error("Add your email first");
    setBusy(true);
    try {
      const result = await api("/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email, origin: window.location.origin }),
      });
      setSent(true);
      toast.success(result.sent ? "Magic link sent" : "Magic link created");
      if (!result.sent) toast.info(result.email_status?.reason || "Email provider did not send this message");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app-shell login-screen" data-testid="login-screen">
      <section className="login-top-section" data-testid="login-top-section">
        <div className="phone-status-bar" data-testid="login-status-bar">
          <span>9:43</span><span>⌁ ◔ ▰</span>
        </div>
        <div className="brand-row" data-testid="login-brand-row">
          <LogoMark />
          <div className="brand-name" data-testid="login-brand-name">PlayPals</div>
        </div>
        <div className="hero-copy" data-testid="login-hero-copy">
          <div className="eyebrow" data-testid="login-tagline">Playdates, sorted.</div>
          <h1 data-testid="login-hero-title">Less organizing. More playing.</h1>
          <p data-testid="login-hero-subtitle">The dedicated home for playdate coordination within trusted school communities.</p>
        </div>
      </section>
      <form className="auth-card stack login-actions" onSubmit={requestMagic} data-testid="login-auth-card">
        <button type="button" className="button primary" onClick={googleLogin} data-testid="google-login-button">
          <UserRound size={17} /> Continue with Google
        </button>
        <div className="or-divider" data-testid="magic-link-divider"><span>or</span></div>
        {emailOpen && <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@email.com" data-testid="magic-email-input" autoFocus />}
        <button className="button secondary" disabled={busy} data-testid="magic-link-submit-button">
          <Mail size={17} /> {busy ? "Sending…" : emailOpen ? "Send magic link" : "Email magic link"}
        </button>
        {sent && <p className="helper-text" data-testid="magic-link-sent-message">Check your inbox for a one-tap sign-in link.</p>}
        <p className="privacy-note" data-testid="login-privacy-note">⌂ No password. No spam. Children’s data always private.</p>
      </form>
    </main>
  );
}

function Header({ title, user }) {
  const initial = user?.name?.[0]?.toUpperCase() || "P";
  return (
    <header className="top-header" data-testid="app-top-header">
      <LogoMark testId="header-logo" />
      <div className="screen-title" data-testid="header-screen-title">{title}</div>
      <div className="avatar-circle" data-testid="header-parent-avatar">
        {user?.picture ? <img src={user.picture} alt="" /> : initial}
      </div>
    </header>
  );
}

const navItems = [
  ["/home", "Home", Home, false],
  ["/playdates", "Playdates", CalendarDays, false],
  ["/community", "Community", Users, false],
  ["/messages", "Messages", MessageCircle, true],
  ["/profile", "Profile", UserRound, false],
];

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <nav className="bottom-nav" data-testid="bottom-navigation">
      {navItems.map(([path, label, Icon, disabled]) => (
        <button
          key={path}
          className={`nav-item ${location.pathname.startsWith(path) ? "active" : ""} ${disabled ? "disabled" : ""}`}
          onClick={() => (disabled ? toast.info("Messages inbox is planned for Phase 2") : navigate(path))}
          data-testid={`nav-${label.toLowerCase()}-button`}
        >
          <Icon size={24} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function AppLayout({ title, user, children }) {
  return (
    <div className="app-shell" data-testid="app-shell">
      <Header title={title} user={user} />
      <main className="main-content page-enter" data-testid="main-content">{children}</main>
      <BottomNav />
    </div>
  );
}

function Protected({ authed, loading, children }) {
  if (loading) return <LoadingScreen />;
  if (!authed) return <Navigate to="/login" replace />;
  return children;
}

function OnboardingCard({ dashboard, navigate }) {
  const steps = [
    ["Child profile", dashboard?.onboarding?.has_child, "/profile"],
    ["Availability", dashboard?.onboarding?.has_availability, "/playdates"],
    ["Community", dashboard?.onboarding?.has_community, "/community"],
  ];
  if (dashboard?.onboarding?.complete) return null;
  return (
    <section className="card stack" data-testid="onboarding-card">
      <div>
        <h2 className="card-title" data-testid="onboarding-title">Finish your PlayPals setup</h2>
        <p className="muted" data-testid="onboarding-subtitle">Three quick pieces unlock scheduling.</p>
      </div>
      {steps.map(([label, done, path]) => (
        <button key={label} className="slot-button" onClick={() => navigate(path)} data-testid={`onboarding-${label.toLowerCase().replaceAll(" ", "-")}-button`}>
          <span>{done ? "✓" : "○"} {label}</span>
        </button>
      ))}
    </section>
  );
}

function HomePage({ user, dashboard, refresh }) {
  const navigate = useNavigate();
  const upcoming = (dashboard?.playdates || []).filter((p) => ["proposed", "confirmed", "rescheduled", "countered"].includes(p.status)).slice(0, 3);
  const match = dashboard?.matches?.[0];

  const proposeMatch = () => {
    navigate("/community", { state: { match } });
  };

  return (
    <AppLayout title="Home" user={user}>
      <div className="stack stagger">
        <section className="card stack" data-testid="home-welcome-card">
          <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
            <div>
              <h1 className="section-title" data-testid="home-greeting">Hi, {user?.name?.split(" ")[0] || "there"}</h1>
              <p className="muted" data-testid="home-subtitle">Your family’s social calendar, gently sorted.</p>
            </div>
            <span className="badge amber" data-testid="home-tier-badge">{user?.tier?.badge} {user?.tier?.name}</span>
          </div>
          <div className="progress-track" data-testid="home-credit-progress"><div className="progress-fill" style={{ width: `${Math.min(100, ((user?.credits || 0) / (user?.tier?.next || 160)) * 100)}%` }} /></div>
          <div className="metric-row" style={{ justifyContent: "space-between" }}>
            <span className="muted" data-testid="home-credit-count">{user?.credits || 0} credits</span>
            <span className="muted" data-testid="home-next-tier">{user?.tier?.next ? `${user.tier.next - (user.credits || 0)} to next tier` : "Top tier"}</span>
          </div>
        </section>

        <OnboardingCard dashboard={dashboard} navigate={navigate} />

        {match && (
          <section className="card stack" data-testid="auto-match-card">
            <span className="badge amber" data-testid="auto-match-badge">Playdate Match Found</span>
            <div>
              <h2 className="card-title" data-testid="auto-match-title">{match.own_children?.[0]?.first_name || "Your child"} + {match.children?.[0]?.first_name || "a friend"}</h2>
              <p className="muted" data-testid="auto-match-detail">Both free {fmtDate(match.date, { weekday: "long", month: "short", day: "numeric" })}, {timeLabel(match.start_time)}–{timeLabel(match.end_time)}</p>
            </div>
            <div className="proposal-actions">
              <button className="button primary" onClick={proposeMatch} data-testid="auto-match-propose-button">Propose Playdate →</button>
              <button className="button ghost" data-testid="auto-match-dismiss-button">Not this week</button>
            </div>
          </section>
        )}

        <section className="stack" data-testid="home-upcoming-section">
          <h2 className="section-title" data-testid="home-upcoming-title">Upcoming</h2>
          {upcoming.length ? upcoming.map((playdate) => (
            <PlaydateCard key={playdate.playdate_id} playdate={playdate} user={user} refresh={refresh} />
          )) : <div className="empty-state card" data-testid="home-empty-upcoming">No playdates yet. Community availability is ready when you are.</div>}
        </section>

        <section className="stack" data-testid="home-activity-section">
          <h2 className="section-title" data-testid="home-activity-title">Activity</h2>
          {(dashboard?.notifications || []).slice(0, 4).map((note) => (
            <div className="mini-card" key={note.notification_id} data-testid={`activity-${note.notification_id}`}>
              <div className="row" style={{ gap: 10 }}><Bell size={18} /><strong data-testid={`activity-title-${note.notification_id}`}>{note.title}</strong></div>
              <p className="muted" data-testid={`activity-body-${note.notification_id}`}>{note.body}</p>
            </div>
          ))}
          {!dashboard?.notifications?.length && <div className="empty-state card" data-testid="home-empty-activity">Helpful nudges will show here.</div>}
        </section>
      </div>
    </AppLayout>
  );
}

function AvailabilitySheet({ selectedDate, availability, onClose, onSaved }) {
  const existing = availability.find((slot) => slot.date === isoDate(selectedDate));
  const [blocks, setBlocks] = useState(existing?.blocks?.length ? existing.blocks : [{ start: "15:00", end: "17:00" }]);
  const [recurrence, setRecurrence] = useState("weekly");
  const dateText = selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const dayName = selectedDate.toLocaleDateString(undefined, { weekday: "long" });
  const isPast = isoDate(selectedDate) < isoDate(new Date());

  const updateBlock = (index, field, value) => {
    setBlocks((prev) => prev.map((block, i) => {
      if (i !== index) return block;
      const next = { ...block, [field]: value };
      if (field === "start" && minutes(next.end) <= minutes(value)) {
        const nextEnd = timeOptions.find((t) => minutes(t) >= minutes(value) + 15) || "21:00";
        next.end = nextEnd;
      }
      return next;
    }));
  };

  const save = async () => {
    try {
      await api("/availability", { method: "POST", body: JSON.stringify({ date: isoDate(selectedDate), blocks, recurrence }) });
      toast.success("Availability saved");
      await onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const remove = async () => {
    try {
      await api(`/availability/${isoDate(selectedDate)}`, { method: "DELETE" });
      toast.success("Availability removed");
      await onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="sheet-overlay" data-testid="availability-sheet-overlay">
      <section className="bottom-sheet" data-testid="availability-day-sheet">
        <div className="drag-handle" data-testid="availability-drag-handle" />
        <div className="sheet-title-row">
          <h3 data-testid="availability-sheet-title">{dateText}</h3>
          <button className="icon-button" onClick={onClose} data-testid="availability-sheet-close-button"><X size={20} /></button>
        </div>
        {isPast ? (
          <div className="empty-state" data-testid="past-date-message">Past dates are view only.</div>
        ) : (
          <div className="stack">
            <div className="time-bar" data-testid="availability-time-bar">
              {blocks.map((block, index) => {
                const left = ((minutes(block.start) - 360) / 900) * 100;
                const width = ((minutes(block.end) - minutes(block.start)) / 900) * 100;
                return <span key={`${block.start}-${block.end}-${index}`} className="time-segment" style={{ left: `${left}%`, width: `${width}%` }} data-testid={`availability-time-segment-${index}`} />;
              })}
            </div>
            {blocks.map((block, index) => (
              <div className="time-block" key={index} data-testid={`availability-block-${index}`}>
                <select className="select" value={block.start} onChange={(e) => updateBlock(index, "start", e.target.value)} data-testid={`availability-from-select-${index}`}>
                  {timeOptions.slice(0, -1).map((time) => <option key={time} value={time}>{timeLabel(time)}</option>)}
                </select>
                <select className="select" value={block.end} onChange={(e) => updateBlock(index, "end", e.target.value)} data-testid={`availability-until-select-${index}`}>
                  {timeOptions.filter((time) => minutes(time) > minutes(block.start)).map((time) => <option key={time} value={time}>{timeLabel(time)}</option>)}
                </select>
                <button className="icon-button" onClick={() => setBlocks((prev) => prev.filter((_, i) => i !== index))} disabled={blocks.length === 1} data-testid={`availability-remove-block-button-${index}`}><Trash2 size={18} /></button>
              </div>
            ))}
            {blocks.length < 4 && <button className="button ghost" onClick={() => setBlocks((prev) => [...prev, { start: "10:00", end: "12:00" }])} data-testid="availability-add-block-button">+ Add another time block</button>}
            <div className="radio-pills" data-testid="availability-recurring-options">
              <button className={`radio-pill ${recurrence === "once" ? "active" : ""}`} onClick={() => setRecurrence("once")} data-testid="availability-once-button">Just this once</button>
              <button className={`radio-pill ${recurrence === "weekly" ? "active" : ""}`} onClick={() => setRecurrence("weekly")} data-testid="availability-weekly-button">Every {dayName}</button>
            </div>
            <button className="button primary" onClick={save} data-testid="availability-save-button">Save availability →</button>
            {existing && <button className="button secondary" onClick={remove} data-testid="availability-remove-date-button">Remove this date</button>}
          </div>
        )}
      </section>
    </div>
  );
}

function CalendarView({ dashboard, refresh }) {
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState("month");
  const [selected, setSelected] = useState(null);
  const availability = dashboard?.availability || [];
  const playdates = dashboard?.playdates || [];
  const availabilityDates = new Set(availability.map((slot) => slot.date));
  const pendingDates = new Set(playdates.filter((p) => ["proposed", "countered"].includes(p.status)).map((p) => p.date));
  const confirmedDates = new Set(playdates.filter((p) => ["confirmed", "rescheduled", "completed"].includes(p.status)).map((p) => p.date));

  const monthDays = useMemo(() => {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const first = new Date(start);
    first.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(first);
      d.setDate(first.getDate() + i);
      return d;
    });
  }, [cursor]);

  const move = (dir) => {
    const next = new Date(cursor);
    if (view === "month") next.setMonth(next.getMonth() + dir);
    if (view === "week") next.setDate(next.getDate() + dir * 7);
    if (view === "day") next.setDate(next.getDate() + dir);
    setCursor(next);
  };

  const visibleDays = view === "month" ? monthDays : view === "week" ? monthDays.slice(0, 7).map((_, i) => { const d = new Date(cursor); d.setDate(cursor.getDate() - cursor.getDay() + i); return d; }) : [cursor];

  return (
    <section className="calendar-card stack" data-testid="availability-calendar-card">
      <div className="calendar-header">
        <button className="icon-button" onClick={() => move(-1)} data-testid="calendar-prev-button"><ChevronLeft size={20} /></button>
        <strong data-testid="calendar-current-label">{view === "month" ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : fmtDate(isoDate(cursor), { month: "short", day: "numeric", year: "numeric" })}</strong>
        <button className="icon-button" onClick={() => move(1)} data-testid="calendar-next-button"><ChevronRight size={20} /></button>
      </div>
      <div className="view-toggle" data-testid="calendar-view-toggle">
        {['month', 'week', 'day'].map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)} data-testid={`calendar-${item}-view-button`}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </div>
      <button className="button secondary small" onClick={() => setCursor(new Date())} data-testid="calendar-today-button">Today</button>
      {view !== "day" && <div className="calendar-grid" data-testid="calendar-weekdays">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={`${d}-${i}`} className="weekday" data-testid={`weekday-${i}`}>{d}</div>)}</div>}
      <div className={view === "day" ? "stack" : "calendar-grid"} data-testid="calendar-grid">
        {visibleDays.map((day) => {
          const value = isoDate(day);
          const inMonth = day.getMonth() === cursor.getMonth() || view !== "month";
          const today = value === isoDate(new Date());
          return (
            <button key={value} className={`day-cell ${inMonth ? "" : "muted-day"} ${today ? "today" : ""}`} onClick={() => setSelected(day)} data-testid={`calendar-day-${value}`}>
              <span data-testid={`calendar-day-number-${value}`}>{view === "day" ? fmtDate(value, { weekday: "long", month: "long", day: "numeric" }) : day.getDate()}</span>
              <span className="dot-row" data-testid={`calendar-dots-${value}`}>
                {availabilityDates.has(value) && <span className="dot sage" />}
                {confirmedDates.has(value) && <span className="dot terra" />}
                {pendingDates.has(value) && <span className="dot amber" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="chip-row" data-testid="calendar-legend">
        <span className="badge sage">Sage = available</span><span className="badge terra">Terracotta = confirmed</span><span className="badge amber">Amber = pending</span>
      </div>
      {selected && <AvailabilitySheet selectedDate={selected} availability={availability} onClose={() => setSelected(null)} onSaved={refresh} />}
    </section>
  );
}

function PlaydatesPage({ user, dashboard, refresh }) {
  const [showGroup, setShowGroup] = useState(false);
  return (
    <AppLayout title="Playdates" user={user}>
      <div className="stack stagger">
        <CalendarView dashboard={dashboard} refresh={refresh} />
        <button className="button blue" onClick={() => setShowGroup(true)} data-testid="new-group-playdate-button"><Users size={18} /> New Group Playdate</button>
        <section className="stack" data-testid="playdate-list-section">
          <h2 className="section-title" data-testid="playdate-list-title">Proposals & plans</h2>
          {(dashboard?.playdates || []).length ? dashboard.playdates.map((playdate) => <PlaydateCard key={playdate.playdate_id} playdate={playdate} user={user} refresh={refresh} />) : <div className="empty-state card" data-testid="playdates-empty-state">No playdates yet.</div>}
        </section>
      </div>
      {showGroup && <GroupPlaydateModal dashboard={dashboard} refresh={refresh} onClose={() => setShowGroup(false)} />}
    </AppLayout>
  );
}

function ProposalModal({ slot, family, match, dashboard, onClose, refresh }) {
  const [location, setLocation] = useState("Neighborhood park");
  const [activity, setActivity] = useState("Free play");
  const [notes, setNotes] = useState("");
  const selected = match || { parent: family?.parent, children: family?.children, date: slot?.date, start_time: slot?.blocks?.[0]?.start, end_time: slot?.blocks?.[0]?.end };
  const ownChild = dashboard?.children?.[0];

  const submit = async () => {
    try {
      await api("/playdates", {
        method: "POST",
        body: JSON.stringify({
          type: "1:1",
          invitee_parent_ids: [selected.parent.user_id],
          child_ids: ownChild ? [ownChild.child_id] : [],
          date: selected.date,
          start_time: selected.start_time,
          end_time: selected.end_time,
          location,
          activity,
          notes,
          min_confirmations: 1,
          title: `${ownChild?.first_name || "PlayPal"} + ${selected.children?.[0]?.first_name || "friend"}`,
        }),
      });
      toast.success("Proposal sent");
      await refresh();
      onClose();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (!selected?.parent) return null;
  return (
    <div className="center-overlay" data-testid="proposal-modal-overlay">
      <section className="modal-panel stack" data-testid="proposal-modal">
        <div className="sheet-title-row"><h3 data-testid="proposal-title">Propose Playdate</h3><button className="icon-button" onClick={onClose} data-testid="proposal-close-button"><X size={20} /></button></div>
        <div className="mini-card" data-testid="proposal-prefill-card">
          <strong data-testid="proposal-children">{ownChild?.first_name || "Your child"} + {selected.children?.[0]?.first_name || selected.parent.name}</strong>
          <p className="muted" data-testid="proposal-time">{fmtDate(selected.date, { weekday: "long", month: "short", day: "numeric" })}, {timeLabel(selected.start_time)}–{timeLabel(selected.end_time)}</p>
        </div>
        <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" data-testid="proposal-location-input" />
        <input className="input" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Activity" data-testid="proposal-activity-input" />
        <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for the other parent" data-testid="proposal-notes-input" />
        <button className="button primary" onClick={submit} data-testid="proposal-send-button"><Send size={18} /> Send proposal</button>
      </section>
    </div>
  );
}

function CommunityPage({ user, dashboard, refresh }) {
  const [feed, setFeed] = useState({ families: [], matches: [] });
  const [communities, setCommunities] = useState([]);
  const [proposal, setProposal] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const location = useLocation();

  const load = useCallback(async () => {
    try {
      const [feedData, communityData] = await Promise.all([api("/community-feed"), api("/communities")]);
      setFeed(feedData);
      setCommunities(communityData);
    } catch (error) {
      toast.error(error.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (location.state?.match) setProposal({ match: location.state.match }); }, [location.state]);

  return (
    <AppLayout title="Community" user={user}>
      <div className="stack stagger">
        <section className="card stack" data-testid="community-actions-card">
          <h1 className="section-title" data-testid="community-title">Trusted circles</h1>
          <p className="muted" data-testid="community-subtitle">Join a school or neighborhood community, then propose from open slots.</p>
          <div className="proposal-actions">
            <button className="button primary" onClick={() => setShowJoin(true)} data-testid="join-community-open-button"><Search size={18} /> Join</button>
            <button className="button secondary" onClick={() => setShowCreate(true)} data-testid="create-community-open-button"><Plus size={18} /> Create</button>
          </div>
        </section>
        <section className="stack" data-testid="availability-feed-section">
          <h2 className="section-title" data-testid="availability-feed-title">Who’s free this week</h2>
          {feed.families?.length ? feed.families.map((family) => (
            <div className="card feed-family" key={family.parent.user_id} data-testid={`feed-family-${family.parent.user_id}`}>
              <div className="family-head">
                <div>
                  <strong data-testid={`feed-parent-name-${family.parent.user_id}`}>{family.parent.name}</strong>
                  <p className="muted" data-testid={`feed-child-name-${family.parent.user_id}`}>{family.children?.map((c) => `${c.first_name}, ${c.age}`).join(" · ")}</p>
                </div>
                <span className="badge sage" data-testid={`feed-trust-badge-${family.parent.user_id}`}>Trust circle</span>
              </div>
              <div className="stack">
                {family.slots.slice(0, 3).map((slot) => (
                  <button key={slot.slot_id} className="slot-button" onClick={() => setProposal({ family, slot })} data-testid={`feed-slot-${slot.slot_id}`}>
                    <Clock size={16} /> {fmtDate(slot.date, { weekday: "short", month: "short", day: "numeric" })} · {slot.blocks.map((b) => `${timeLabel(b.start)}–${timeLabel(b.end)}`).join(", ")}
                  </button>
                ))}
              </div>
            </div>
          )) : <div className="empty-state card" data-testid="availability-feed-empty">Join a community and add availability to see family overlaps.</div>}
        </section>
        <section className="stack" data-testid="my-communities-section">
          <h2 className="section-title" data-testid="my-communities-title">Directory</h2>
          {communities.map((community) => <CommunityDirectoryCard key={community.community_id} community={community} refreshAll={async () => { await refresh(); await load(); }} />)}
        </section>
      </div>
      {proposal && <ProposalModal {...proposal} dashboard={dashboard} refresh={refresh} onClose={() => setProposal(null)} />}
      {showCreate && <CreateCommunityModal onClose={() => setShowCreate(false)} refreshAll={async () => { await refresh(); await load(); }} />}
      {showJoin && <JoinCommunityModal communities={communities} onClose={() => setShowJoin(false)} refreshAll={async () => { await refresh(); await load(); }} />}
    </AppLayout>
  );
}

function CommunityDirectoryCard({ community, refreshAll }) {
  const join = async () => {
    try {
      await api("/communities/join", { method: "POST", body: JSON.stringify({ community_id: community.community_id, teacher_name: "Ms. Smith", child_grade: "Grade 1" }) });
      toast.success("Community joined");
      await refreshAll();
    } catch (error) { toast.error(error.message); }
  };
  return (
    <div className="mini-card" data-testid={`community-card-${community.community_id}`}>
      <div className="family-head">
        <div><strong data-testid={`community-name-${community.community_id}`}>{community.name}</strong><p className="muted" data-testid={`community-meta-${community.community_id}`}>{community.city} · {community.member_count} families</p></div>
        {community.membership ? <span className="badge sage" data-testid={`community-status-${community.community_id}`}>{community.membership.status}</span> : <button className="button small secondary" onClick={join} data-testid={`community-join-${community.community_id}`}>Join</button>}
      </div>
    </div>
  );
}

function CreateCommunityModal({ onClose, refreshAll }) {
  const [track, setTrack] = useState("school");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [scope, setScope] = useState("Whole school");
  const [duplicate, setDuplicate] = useState(null);

  const check = async () => {
    const result = await api("/communities/check-duplicate", { method: "POST", body: JSON.stringify({ name, city, type: track }) });
    setDuplicate(result);
    return result;
  };
  const create = async () => {
    try {
      const result = duplicate || await check();
      if (result.result === "duplicate") return toast.info("This community already exists. Join it from the directory.");
      await api("/communities", { method: "POST", body: JSON.stringify({ name, city, type: track, connection: "parent", scope }) });
      toast.success("Community created");
      await refreshAll();
      onClose();
    } catch (error) { toast.error(error.message); }
  };
  return (
    <div className="center-overlay" data-testid="create-community-modal-overlay">
      <section className="modal-panel stack" data-testid="create-community-modal">
        <div className="sheet-title-row"><h3 data-testid="create-community-title">Create Community</h3><button className="icon-button" onClick={onClose} data-testid="create-community-close-button"><X size={20} /></button></div>
        <div className="radio-pills"><button className={`radio-pill ${track === "school" ? "active" : ""}`} onClick={() => setTrack("school")} data-testid="track-school-button">School</button><button className={`radio-pill ${track === "neighborhood" ? "active" : ""}`} onClick={() => setTrack("neighborhood")} data-testid="track-neighborhood-button">Neighborhood</button></div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={track === "school" ? "School name" : "Neighborhood name"} data-testid="community-name-input" />
        <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City / region" data-testid="community-city-input" />
        {track === "school" && <select className="select" value={scope} onChange={(e) => setScope(e.target.value)} data-testid="community-scope-select"><option>Whole school</option><option>Specific grade</option><option>Class</option><option>Club or activity</option></select>}
        <button className="button secondary" onClick={check} data-testid="duplicate-check-button">Check duplicates</button>
        {duplicate && <div className="mini-card" data-testid="duplicate-result-card"><strong data-testid="duplicate-result">{duplicate.result}</strong><p className="muted" data-testid="duplicate-result-detail">{duplicate.matches?.[0]?.community?.name || "No close match found"}</p></div>}
        <button className="button primary" onClick={create} disabled={!name || !city} data-testid="create-community-submit-button">Create community</button>
      </section>
    </div>
  );
}

function JoinCommunityModal({ communities, onClose, refreshAll }) {
  const [selected, setSelected] = useState(communities?.[0]?.community_id || "");
  const [sponsor, setSponsor] = useState("");
  const [teacher, setTeacher] = useState("");
  const join = async () => {
    try {
      await api("/communities/join", { method: "POST", body: JSON.stringify({ community_id: selected, sponsor_name: sponsor || null, teacher_name: teacher || null, child_grade: teacher ? "Grade 1" : null }) });
      toast.success("Join request complete");
      await refreshAll();
      onClose();
    } catch (error) { toast.error(error.message); }
  };
  return (
    <div className="center-overlay" data-testid="join-community-modal-overlay">
      <section className="modal-panel stack" data-testid="join-community-modal">
        <div className="sheet-title-row"><h3 data-testid="join-community-title">Join Community</h3><button className="icon-button" onClick={onClose} data-testid="join-community-close-button"><X size={20} /></button></div>
        <select className="select" value={selected} onChange={(e) => setSelected(e.target.value)} data-testid="join-community-select">{communities.map((c) => <option key={c.community_id} value={c.community_id}>{c.name}</option>)}</select>
        <input className="input" value={sponsor} onChange={(e) => setSponsor(e.target.value)} placeholder="Sponsor name, if you know one" data-testid="sponsor-name-input" />
        <input className="input" value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="Teacher name alternative" data-testid="teacher-name-input" />
        <button className="button primary" onClick={join} disabled={!selected} data-testid="join-community-submit-button">Request to join</button>
      </section>
    </div>
  );
}

function PlaydateCard({ playdate, user, refresh }) {
  const [showChat, setShowChat] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const isInvitee = playdate.participants?.some((p) => p.parent_id === user.user_id && p.rsvp_status === "invited");
  const accepted = playdate.participants?.filter((p) => p.rsvp_status === "accepted") || [];
  const respond = async (action) => {
    try {
      await api(`/playdates/${playdate.playdate_id}/respond`, { method: "POST", body: JSON.stringify({ action }) });
      toast.success(action === "accept" ? "Playdate confirmed" : "Response sent");
      await refresh();
    } catch (error) { toast.error(error.message); }
  };
  const cancel = async () => {
    try { await api(`/playdates/${playdate.playdate_id}/cancel`, { method: "POST", body: JSON.stringify({ reason: "Child is sick 🤒" }) }); toast.success("Playdate cancelled"); await refresh(); } catch (error) { toast.error(error.message); }
  };
  return (
    <article className="card stack" data-testid={`playdate-card-${playdate.playdate_id}`}>
      <div className="family-head">
        <div>
          <span className={`badge ${playdate.status === "confirmed" ? "terra" : playdate.status === "completed" ? "sage" : "amber"}`} data-testid={`playdate-status-${playdate.playdate_id}`}>{playdate.status}</span>
          <h3 className="card-title" data-testid={`playdate-title-${playdate.playdate_id}`}>{playdate.title}</h3>
        </div>
        <span className="badge blue" data-testid={`playdate-type-${playdate.playdate_id}`}>{playdate.type}</span>
      </div>
      <p className="muted" data-testid={`playdate-detail-${playdate.playdate_id}`}><CalendarDays size={15} /> {fmtDate(playdate.date, { weekday: "long", month: "short", day: "numeric" })} · {timeLabel(playdate.start_time)}–{timeLabel(playdate.end_time)}</p>
      <p className="muted" data-testid={`playdate-location-${playdate.playdate_id}`}><MapPin size={15} /> {playdate.location} · {playdate.activity}</p>
      <div className="chip-row" data-testid={`playdate-participants-${playdate.playdate_id}`}>{accepted.map((p) => <span className="pill" key={p.parent_id}>{p.parent?.name || "Parent"}</span>)}</div>
      <div className="proposal-actions">
        {isInvitee && <button className="button sage small" onClick={() => respond("accept")} data-testid={`playdate-accept-${playdate.playdate_id}`}><Check size={16} /> Accept</button>}
        {isInvitee && <button className="button secondary small" onClick={() => respond("decline")} data-testid={`playdate-decline-${playdate.playdate_id}`}>Decline</button>}
        {["confirmed", "rescheduled"].includes(playdate.status) && <button className="button blue small" onClick={() => setShowChat(true)} data-testid={`playdate-chat-${playdate.playdate_id}`}><MessageCircle size={16} /> Chat</button>}
        {["confirmed", "rescheduled"].includes(playdate.status) && <button className="button secondary small" onClick={cancel} data-testid={`playdate-cancel-${playdate.playdate_id}`}>Sick day cancel</button>}
        {playdate.status !== "completed" && <button className="button ghost small" onClick={() => setShowComplete(true)} data-testid={`playdate-complete-open-${playdate.playdate_id}`}>Complete</button>}
      </div>
      {showChat && <ChatModal playdate={playdate} onClose={() => setShowChat(false)} />}
      {showComplete && <CompletionModal playdate={playdate} refresh={refresh} onClose={() => setShowComplete(false)} />}
    </article>
  );
}

function ChatModal({ playdate, onClose }) {
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const load = useCallback(async () => {
    try { setMessages(await api(`/playdates/${playdate.playdate_id}/messages`)); } catch (error) { toast.error(error.message); }
  }, [playdate.playdate_id]);
  useEffect(() => { load(); }, [load]);
  const send = async () => {
    if (!content.trim()) return;
    try { await api(`/playdates/${playdate.playdate_id}/messages`, { method: "POST", body: JSON.stringify({ content }) }); setContent(""); await load(); } catch (error) { toast.error(error.message); }
  };
  return (
    <div className="center-overlay" data-testid="chat-modal-overlay">
      <section className="modal-panel stack" data-testid="chat-modal">
        <div className="sheet-title-row"><h3 data-testid="chat-title">Playdate chat</h3><button className="icon-button" onClick={onClose} data-testid="chat-close-button"><X size={20} /></button></div>
        <div className="message-list" data-testid="chat-message-list">
          {messages.map((m) => <div key={m.message_id} className="message-bubble" data-testid={`chat-message-${m.message_id}`}><div className="message-meta">{m.sender_name}</div>{m.content}</div>)}
          {!messages.length && <div className="empty-state" data-testid="chat-empty-state">No messages yet.</div>}
        </div>
        <div className="row" style={{ gap: 8 }}><input className="input" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Message" data-testid="chat-message-input" /><button className="icon-button" onClick={send} data-testid="chat-send-button"><Send size={18} /></button></div>
      </section>
    </div>
  );
}

function CompletionModal({ playdate, refresh, onClose }) {
  const [reaction, setReaction] = useState("great");
  const [note, setNote] = useState("");
  const complete = async () => {
    try {
      await api(`/playdates/${playdate.playdate_id}/complete`, { method: "POST" });
      await api(`/playdates/${playdate.playdate_id}/reaction`, { method: "POST", body: JSON.stringify({ reaction }) });
      if (note) await api(`/playdates/${playdate.playdate_id}/memory`, { method: "POST", body: JSON.stringify({ note_text: note }) });
      toast.success("Credits added");
      await refresh();
      onClose();
    } catch (error) { toast.error(error.message); }
  };
  return (
    <div className="center-overlay" data-testid="completion-modal-overlay">
      <section className="modal-panel stack" data-testid="completion-modal">
        <div className="sheet-title-row"><h3 data-testid="completion-title">Hope it was a blast! 🎉</h3><button className="icon-button" onClick={onClose} data-testid="completion-close-button"><X size={20} /></button></div>
        <div className="chip-row" data-testid="reaction-options">{[["great", "😊 Great"], ["fine", "😐 Fine"], ["not_right", "😔 Not right"]].map(([value, label]) => <button key={value} className={`chip ${reaction === value ? "active" : ""}`} onClick={() => setReaction(value)} data-testid={`reaction-${value}-button`}>{label}</button>)}</div>
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Private memory note" data-testid="memory-note-input" />
        <button className="button primary" onClick={complete} data-testid="completion-submit-button">Complete & add credits</button>
      </section>
    </div>
  );
}

function GroupPlaydateModal({ dashboard, refresh, onClose }) {
  const [selected, setSelected] = useState([]);
  const [date, setDate] = useState(isoDate(new Date(Date.now() + 86400000 * 3)));
  const [start, setStart] = useState("15:00");
  const [end, setEnd] = useState("17:00");
  const [location, setLocation] = useState("Community playground");
  const [activity, setActivity] = useState("Group free play");
  const families = dashboard?.matches?.map((m) => m.parent) || [];
  const toggle = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 6 ? [...prev, id] : prev);
  const send = async () => {
    try {
      await api("/playdates", { method: "POST", body: JSON.stringify({ type: "group", invitee_parent_ids: selected, child_ids: dashboard?.children?.[0] ? [dashboard.children[0].child_id] : [], date, start_time: start, end_time: end, location, activity, min_confirmations: 2, title: "Friend Group Playdate" }) });
      toast.success("Group proposal sent"); await refresh(); onClose();
    } catch (error) { toast.error(error.message); }
  };
  return (
    <div className="center-overlay" data-testid="group-modal-overlay">
      <section className="modal-panel stack" data-testid="group-modal">
        <div className="sheet-title-row"><h3 data-testid="group-title">New Group Playdate</h3><button className="icon-button" onClick={onClose} data-testid="group-close-button"><X size={20} /></button></div>
        <div className="chip-row" data-testid="group-family-options">{families.map((f) => <button key={f.user_id} className={`chip ${selected.includes(f.user_id) ? "active" : ""}`} onClick={() => toggle(f.user_id)} data-testid={`group-family-${f.user_id}`}>{f.name}</button>)}</div>
        {!families.length && <p className="muted" data-testid="group-no-families">Add availability and join communities to surface families.</p>}
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="group-date-input" />
        <div className="row" style={{ gap: 8 }}><select className="select" value={start} onChange={(e) => setStart(e.target.value)} data-testid="group-start-select">{timeOptions.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}</select><select className="select" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="group-end-select">{timeOptions.filter((t) => minutes(t) > minutes(start)).map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}</select></div>
        <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} data-testid="group-location-input" /><input className="input" value={activity} onChange={(e) => setActivity(e.target.value)} data-testid="group-activity-input" />
        <button className="button primary" onClick={send} disabled={selected.length < 2} data-testid="group-send-button">Send to {selected.length} families</button>
      </section>
    </div>
  );
}

function ProfilePage({ user, dashboard, refresh }) {
  const [showChild, setShowChild] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const logout = async () => { await api("/auth/logout", { method: "POST" }); window.location.href = "/login"; };
  return (
    <AppLayout title="Profile" user={user}>
      <div className="stack stagger">
        <section className="card stack" data-testid="profile-parent-card">
          <div className="row" style={{ gap: 12 }}><div className="avatar-circle" style={{ width: 52, height: 52 }} data-testid="profile-avatar">{user?.name?.[0] || "P"}</div><div><h1 className="section-title" data-testid="profile-name">{user?.name}</h1><p className="muted" data-testid="profile-email">{user?.email}</p></div></div>
          <span className="badge amber" data-testid="profile-tier-badge">{user?.tier?.badge} {user?.tier?.name} · {user?.credits || 0} credits</span>
        </section>
        <section className="stack" data-testid="children-section">
          <div className="family-head"><h2 className="section-title" data-testid="children-title">Children</h2><button className="button small primary" onClick={() => setShowChild(true)} data-testid="add-child-open-button"><Plus size={16} /> Add</button></div>
          {dashboard?.children?.map((child) => (
            <div className="mini-card child-profile-card" key={child.child_id} data-testid={`child-card-${child.child_id}`}>
              <div>
                <strong data-testid={`child-name-${child.child_id}`}>{child.first_name}</strong>
                <p className="muted" data-testid={`child-detail-${child.child_id}`}>{child.age} · {child.grade} · {child.interests?.join(", ")}</p>
                {child.allergies && <span className="badge amber" data-testid={`child-allergies-${child.child_id}`}>Allergies: {child.allergies}</span>}
              </div>
              <button className="button small secondary" onClick={() => setEditingChild(child)} data-testid={`edit-child-${child.child_id}-button`}>Edit</button>
            </div>
          ))}
          {!dashboard?.children?.length && <div className="empty-state card" data-testid="children-empty-state">Add a child profile to unlock scheduling.</div>}
        </section>
        <section className="card stack" data-testid="notification-settings-card"><h2 className="card-title" data-testid="notification-settings-title">Notification settings</h2><div className="chip-row"><span className="badge sage">Email on</span><span className="badge blue">Push ready</span><span className="badge amber">SMS optional</span></div></section>
        <button className="button secondary" onClick={logout} data-testid="logout-button">Log out</button>
      </div>
      {showChild && <ChildModal onClose={() => setShowChild(false)} refresh={refresh} />}
      {editingChild && <ChildModal child={editingChild} onClose={() => setEditingChild(null)} refresh={refresh} />}
    </AppLayout>
  );
}

function ChildModal({ child, onClose, refresh }) {
  const [form, setForm] = useState({
    first_name: child?.first_name || "",
    age: child?.age || 6,
    grade: child?.grade || "Grade 1",
    interests: child?.interests || [],
    allergies: child?.allergies || "",
    notes: child?.notes || "",
  });
  const toggleInterest = (interest) => setForm((prev) => ({ ...prev, interests: prev.interests.includes(interest) ? prev.interests.filter((i) => i !== interest) : [...prev.interests, interest] }));
  const save = async () => {
    try {
      if (child?.child_id) {
        await api(`/children/${child.child_id}`, { method: "PUT", body: JSON.stringify(form) });
        toast.success("Child profile updated");
      } else {
        await api("/children", { method: "POST", body: JSON.stringify(form) });
        toast.success("Child profile added");
      }
      await refresh();
      onClose();
    } catch (error) { toast.error(error.message); }
  };
  const interests = ["Soccer", "Lego", "Art", "Reading", "Dance", "Swimming", "Gaming", "Nature", "Science", "Music", "Cooking", "Animals"];
  return (
    <div className="center-overlay" data-testid="child-modal-overlay">
      <section className="modal-panel stack" data-testid="child-modal">
        <div className="sheet-title-row"><h3 data-testid="child-modal-title">{child ? "Edit Child Profile" : "Child Profile"}</h3><button className="icon-button" onClick={onClose} data-testid="child-close-button"><X size={20} /></button></div>
        <input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="First name only" data-testid="child-first-name-input" />
        <input className="input" type="number" min="1" max="10" value={form.age} onChange={(e) => setForm({ ...form, age: Number(e.target.value) })} data-testid="child-age-input" />
        <select className="select" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} data-testid="child-grade-select">{["Pre-K", "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"].map((g) => <option key={g}>{g}</option>)}</select>
        <div className="chip-row" data-testid="child-interest-options">{interests.map((interest) => <button key={interest} className={`chip ${form.interests.includes(interest) ? "active" : ""}`} onClick={() => toggleInterest(interest)} data-testid={`interest-${interest.toLowerCase()}-button`}>{interest}</button>)}</div>
        <input className="input" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder="Allergies / dietary restrictions" data-testid="child-allergies-input" />
        <textarea className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes for other parents" data-testid="child-notes-input" />
        <button className="button primary" onClick={save} disabled={!form.first_name} data-testid="child-save-button"><Baby size={18} /> {child ? "Update child profile" : "Save child profile"}</button>
      </section>
    </div>
  );
}

function MessagesPlaceholder({ user }) {
  return <AppLayout title="Messages" user={user}><div className="empty-state card" data-testid="messages-placeholder">General inbox arrives in Phase 2. Confirmed playdates already have contextual chat.</div></AppLayout>;
}

function AppRouter() {
  const [user, setUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const refresh = useCallback(async () => {
    const me = await api("/auth/me");
    setUser(me.user);
    const dash = await api("/dashboard");
    setDashboard(dash);
    setUser(dash.parent);
  }, []);

  useEffect(() => {
    if (window.location.hash?.includes("session_id=") || window.location.hash?.includes("token=")) {
      setLoading(false);
      return;
    }
    const run = async () => {
      try { await refresh(); } catch { setUser(null); setDashboard(null); } finally { setLoading(false); }
    };
    run();
  }, [refresh]);

  if (location.hash?.includes("session_id=") || location.hash?.includes("token=")) return <AuthCallback refresh={refresh} />;
  const authed = Boolean(user);

  return (
    <Routes>
      <Route path="/login" element={authed ? <Navigate to="/home" replace /> : <LoginScreen />} />
      <Route path="/auth/magic" element={<AuthCallback refresh={refresh} />} />
      <Route path="/home" element={<Protected authed={authed} loading={loading}><HomePage user={user} dashboard={dashboard} refresh={refresh} /></Protected>} />
      <Route path="/playdates" element={<Protected authed={authed} loading={loading}><PlaydatesPage user={user} dashboard={dashboard} refresh={refresh} /></Protected>} />
      <Route path="/community" element={<Protected authed={authed} loading={loading}><CommunityPage user={user} dashboard={dashboard} refresh={refresh} /></Protected>} />
      <Route path="/messages" element={<Protected authed={authed} loading={loading}><MessagesPlaceholder user={user} /></Protected>} />
      <Route path="/profile" element={<Protected authed={authed} loading={loading}><ProfilePage user={user} dashboard={dashboard} refresh={refresh} /></Protected>} />
      <Route path="*" element={<Navigate to={authed ? "/home" : "/login"} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      <Toaster richColors position="top-center" />
    </div>
  );
}

export default App;