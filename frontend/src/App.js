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
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Home,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
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

const GRADES = ["Pre-K", "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"];
const INTERESTS = ["Soccer", "Lego", "Art", "Reading", "Dance", "Swimming", "Gaming", "Nature", "Science", "Music", "Cooking", "Animals"];

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

const tierText = (parent) => parent?.tier ? `${parent.tier.badge} ${parent.tier.name}` : "🐶 Curious Pup";

const firstChild = (children) => children?.[0] || {};

function LogoMark({ testId = "logo-mark" }) {
    return (
          <img
        src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAAASFBMVEUAAADSd1bqrWmgr5X9/Prr5NXwyI7n0az4wXjhq5Xp0rJ/f3//e3uvsK/gpIr07Kz//3/9sGj0rKb/AAC4w67ltKG6xLDblHhPGAWgAAAAGHRSTlMA/vz8DlvlnPygZQICA9kLAgMGAdpmoavePwHCAAAG6UlEQVR42u1ayWKDOAx1HdlmC1tS8v9/OpI3ZDCEdKZ0DujQlizoofVJrhCXXHLJJZdccskll1xyySWXXHLJJZdccsklPxXYvDhFeYM/H/7qMdBfzYn67/6hG/oBY7DAiWaA6iXlqwQxAghQJV0pOAmB1Si/SCRdQLgoT0IAD2i/vEgT9VsE/TkOiCpRKVTsQp0RiWjnWeXXV5lcxMT4VfnmOhOR50RB+T8GoMT46+qbv3YBCLUN4KQyuAVAfp/TEGDLB/K0Utz+qQFEvxEFZ/UCSoQcghbESa1AiE4YuQ6AM+kArAJRKniIMwXKpf5zeSGkCLAGn81LgfcEfP7mbF5MNghcBOOv+4u5AMBmo2zhVEq+YKeWi/6NfmsDUOq3RhKo70dKC7wPf2hE/XGVut/9b9i984BD2TDuVmAYQvmsP5s7yb70uz4yncLO0wvyk73VJ1ZQ4kYiFOzGYGW0Nma3CoFpMVfc6NYdji2nHuU5AdzZ8wBrymB0UUgpC20g+foIDKOMgxOma33M/up5Y6I27A6atFspNMQo4ykx8rkJG7YSh8IabqmAj0QXFR34v7VkopUnA3UMHpriF7yhPdCx8MtmAWCylgMyOSoCH6FGJqLBA1P4IeMUNfBakZYD+ahuS7G3G4XSVhEZuXMXTAo7mHrDFHZAGdYTxAHaihG3AjC5tyobcQbsvU2xAGAo4bvwIeeN14o2le8sgA/7vK1NQL5390YTNLQVWRjAmgaT3r1eVOsxOgDoPg1B5wP7Trz5FgDs0M4wxE8RtTw+OsBhAF5TkQEgwkeMu9W4B4CHI2CU1xHCBgDRh8fT0Oct0IXUqOjmWQu8AnVtFkUFRMhjmFb6LcI59THnx2UW4lOTYcIHbI+EbAwEzYkFxPM2gdv+oRtXAKpYCGZrr7KgmgMD33fPWa6nN7vHwu+r0mKubbbYyvNU3jSQrwM11WgdU25ZBzgoLFZNPg3C9IIlWtotX8/DTlEV4J1ofp06EmCB8yYoyGfFog7F2qShbBV0VLEWyxQ7PbDVYgtp3FNTq9HfaRRMqByTlzqUUkUs/VSYWRnCO+mATrhbAzxUuxpfyfytZDnBS491A2Ln3YBQ4ePbAq2j4Qs0s4ntkIp/fEtbrZL0Y2doJY/AEYMD5g5Veucqrs6Cml+pXI/xkKIJKA4sIZAFqUc0EYxyCigqRmttywikbGmtja+weQZc0+o5gqfjQKAM2mUKF/HdWVFBboCuqsivlWbAgtll5e+EGNpSudpQJovVQBeTuPMQRMhTUElXmD2PTKii3l/xaNDMwvJVAa+01hxc/zC/m/Zg4+Da4UekCdEoFv1FUWgti0VHYLsDKUvj+Ane6TvJCamSSrRmAYKa8KokUoSu2gAnRtjt0smdXm5fZdtKuchI3pkx09TtrfjabfQmAAM0zUD59U6kWhORHBFY6gfLjM2GeqwGD+e67W1upGYdvCeDK/v7k6ENL2ACuLuObxAQL8rSU9hzQwWMtGSdoONNxz0vUK/YnjM3jWBY984j0JB8ot1+fCE26Dl1HLURCcCHmjUntQE478kwFjdW2nZCgz1SnPdDOqQOmShArjgkIZUDQFxp2Geltcgm5AKAWCfCAkB2p94e3DioLVo4i8nl4MC3uTlKrI5Ox1kAtdgPQpOukyuZMwCIn0ynjheKNwD03ibVU+JO/BjAlFqgeJuGmRB4HTtWzAPgQYBjQb4ONfsAysPrv9t+EIQxcQWg3z9aK+HfAPD/NbANQPIDi2wzeIn/CECuDNBAFpdQeQ8gB3z8PAv8eOIB5CzAKlGfm0sPn2tucRPFAJh9AEP+dFUeqwN3UW30w/tOIbTdqN/vhVIdtIB41xBZHdKaz8e7IUA8vT8EgI1mwqwTkRdCzXh6G9ox94A082wkv8VwAEDNLIDdo2Kc7B7qUDH7fY6HWAob8YrrUcEO2GR57HQfkrl05qqT90Enulnn2EcThErEPWDpj/yoFPIstMOsWiYiq0MG6n6OSA+ghk6yxGMmONQMGICJAvI+h0HnAAxhWUQRAD2EuRj9Mab/ZYL0805DsvysEFTJE0MNq45oIgVoeEiasP+Q0QGdDarveR/Qf5CFxumbnfAMk4GOS4Ke10VjNzNNpINSOZsNYWcsu0MAppj3kA7PTz/Os2UUsO2ZL4Xzeq6E0Y8J3gSyOpIGgRabUHjQjz4pIQShDnsat6B3majd/9A0oRXG5TxCag+v663JJzsJ1fy15/Op2BCncS6vQmV/4HVb6DBvg1uLlPP8bV9p2xIOdiNwZw7J+L7oI/DhdTjt+PB4Olnmrg58+uRsTIi52ffrQ0h/hPPBkejis33/ePfEsGuBBuD0A/ZLDsk/IbVJJUukBGoAAAAASUVORK5CYII="
        alt="PlayPals"
        className="logo-mark"
        data-testid={testId}
      />
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState("");

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
    if (!EMAIL_RE.test(email)) { setEmailError("That doesn't look like a valid email address."); return; }
    setEmailError("");
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
        {emailOpen && <input className="input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(""); }} placeholder="parent@email.com" data-testid="magic-email-input" autoFocus />}
        {emailError && <p className="helper-text error-text" data-testid="magic-email-error">{emailError}</p>}
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
  const [localMatches, setLocalMatches] = useState(dashboard?.matches || []);
  const [sponsorRequests, setSponsorRequests] = useState([]);

  useEffect(() => {
    api("/sponsor-requests").then(setSponsorRequests).catch(() => setSponsorRequests([]));
  }, [dashboard]);

  useEffect(() => setLocalMatches(dashboard?.matches || []), [dashboard?.matches]);

  const proposeMatch = (match) => {
    navigate("/community", { state: { match } });
  };

  const dismissMatch = async (match, dismissalType) => {
    setLocalMatches((prev) => prev.filter((item) => item.match_id !== match.match_id));
    try {
      await api("/matches/dismiss", { method: "POST", body: JSON.stringify({ target_parent_id: match.parent.user_id, dismissal_type: dismissalType }) });
      toast.success(dismissalType === "not_this_week" ? "Hidden for this week" : "We won't suggest this pairing again");
    } catch (error) { toast.error(error.message); }
  };

  return (
    <AppLayout title="Home" user={user}>
      <div className="stack stagger">
        <section className="home-hero" data-testid="home-welcome-card">
          <h1 data-testid="home-greeting">Good morning, {user?.name?.split(" ")[0] || "Parent"}</h1>
        </section>

        <section className="stats-row" data-testid="home-stats-row">
          {[["playdates_completed", "Playdates completed"], ["credits_earned", "Credits earned"], ["families_sharing_with_me", "Families sharing with me"]].map(([key, label]) => (
            <div className="stat-tile" key={key} data-testid={`home-stat-${key}`}>
              <strong>{dashboard?.stats?.[key] || 0}</strong><span>{label}</span>
            </div>
          ))}
        </section>

        <OnboardingCard dashboard={dashboard} navigate={navigate} />

        {!!sponsorRequests.length && (
          <section className="card stack" data-testid="sponsor-requests-card">
            <span className="badge blue" data-testid="sponsor-requests-badge">Sponsor requests</span>
            {sponsorRequests.map((request) => <SponsorRequestCard key={request.membership_id} request={request} refresh={async () => { await refresh(); setSponsorRequests(await api("/sponsor-requests")); }} />)}
          </section>
        )}

        <section className="stack" data-testid="home-match-section">
          <div className="section-row"><h2 className="match-heading" data-testid="match-section-title">Playdate Match Found!</h2><span data-testid="match-count">{localMatches.length} matches</span></div>
          <div className="match-scroll" data-testid="match-card-list">
            {localMatches.map((match) => <MatchCard key={match.match_id} match={match} onPropose={() => proposeMatch(match)} onDismiss={dismissMatch} />)}
            {!localMatches.length && <div className="empty-state card" data-testid="match-empty-state">No new matches right now.</div>}
          </div>
        </section>

        <section className="stack" data-testid="home-upcoming-section">
          <h2 className="section-title" data-testid="home-upcoming-title">Upcoming</h2>
          {upcoming.length ? upcoming.map((playdate) => (
            <PlaydateCard key={playdate.playdate_id} playdate={playdate} user={user} refresh={refresh} />
          )) : <div className="empty-state card" data-testid="home-empty-upcoming">No playdates yet. Community availability is ready when you are.</div>}
        </section>

        <section className="stack" data-testid="home-activity-section">
          <h2 className="section-title" data-testid="home-activity-title">Activity</h2>
          {(dashboard?.notifications || []).slice(0, 4).map((note) => (
            <ActivityCard note={note} key={note.notification_id} />
          ))}
          {!dashboard?.notifications?.length && <div className="empty-state card" data-testid="home-empty-activity">Helpful nudges will show here.</div>}
        </section>
      </div>
    </AppLayout>
  );
}

function MatchCard({ match, onPropose, onDismiss }) {
  const high = (match.score || 0) >= 80;
  const childA = firstChild(match.own_children);
  const childB = firstChild(match.children);
  const shared = (childA.interests || []).filter((item) => (childB.interests || []).includes(item)).slice(0, 4);
  const ageGap = childA.age && childB.age ? Math.abs(childA.age - childB.age) : 0;
  return (
    <article className={`match-card ${high ? "high" : "medium"}`} data-testid={`match-card-${match.match_id}`}>
      <div className="family-head">
        <div>
          <h3 data-testid={`match-children-${match.match_id}`}>{childA.first_name || "Your child"} & {childB.first_name || "Friend"}</h3>
          <p className="muted" data-testid={`match-meta-${match.match_id}`}>Ages {childA.age || "?"} & {childB.age || "?"} · {ageGap}yr apart · {match.parent?.name}</p>
        </div>
        <span className={`score-badge ${high ? "sage" : "amber"}`} data-testid={`match-score-${match.match_id}`}>{match.score || 80}% · {match.score_label || "Great match"}</span>
      </div>
      <span className="badge sage" data-testid={`match-tier-${match.match_id}`}>{tierText(match.parent)}</span>
      <div className="stack" style={{ gap: 8 }}>
        <span className="muted">Both enjoy:</span>
        <div className="chip-row" data-testid={`match-interests-${match.match_id}`}>{(shared.length ? shared : (childB.interests || []).slice(0, 3)).map((interest) => <span className="interest-pill" key={interest}>{interest}</span>)}</div>
      </div>
      <p data-testid={`match-time-${match.match_id}`}><CalendarDays size={15} /> {fmtDate(match.date, { weekday: "long" })} · {timeLabel(match.start_time)}–{timeLabel(match.end_time)}</p>
      <span className="overlap-pill" data-testid={`match-overlap-${match.match_id}`}>{match.duration_minutes}+ min overlap</span>
      <button className="button primary" onClick={onPropose} data-testid={`match-propose-${match.match_id}`}>Propose Playdate →</button>
      <div className="match-links"><button onClick={() => onDismiss(match, "not_this_week")} data-testid={`match-not-this-week-${match.match_id}`}>Not this week</button><span>|</span><button className="danger-link" onClick={() => onDismiss(match, "dont_suggest_again")} data-testid={`match-dont-suggest-${match.match_id}`}>Don't suggest again</button></div>
    </article>
  );
}

function SponsorRequestCard({ request, refresh }) {
  const respond = async (action) => {
    try {
      await api(`/sponsor-requests/${request.membership_id}/respond`, { method: "POST", body: JSON.stringify({ action }) });
      toast.success(action === "approve" ? "Sponsor approved" : "Sponsor declined");
      await refresh();
    } catch (error) { toast.error(error.message); }
  };
  return (
    <div className="mini-card stack" data-testid={`sponsor-request-${request.membership_id}`}>
      <div>
        <strong data-testid={`sponsor-request-parent-${request.membership_id}`}>{request.parent?.name}</strong>
        <p className="muted" data-testid={`sponsor-request-detail-${request.membership_id}`}>wants to join {request.community?.name}</p>
      </div>
      <div className="proposal-actions">
        <button className="button sage small" onClick={() => respond("approve")} data-testid={`sponsor-approve-${request.membership_id}`}>Yes, approve</button>
        <button className="button secondary small" onClick={() => respond("decline")} data-testid={`sponsor-decline-${request.membership_id}`}>No</button>
      </div>
    </div>
  );
}

function AvailabilitySheet({ selectedDate, availability, onClose, onSaved }) {
  const existing = availability.find((slot) => slot.date === isoDate(selectedDate));
  const [blocks, setBlocks] = useState(existing?.blocks?.length ? existing.blocks : [{ start: "15:00", end: "17:00" }]);
  const [recurrence, setRecurrence] = useState("weekly");
  const [visibilityMode, setVisibilityMode] = useState(existing?.visibility_mode || "everyone");
  const [manualIds, setManualIds] = useState(existing?.visible_to_parent_ids || []);
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
      await api("/availability", { method: "POST", body: JSON.stringify({ date: isoDate(selectedDate), blocks, recurrence, visibility_mode: visibilityMode, visible_to_parent_ids: manualIds }) });
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
            <section className="stack" data-testid="availability-visibility-section">
              <h4 className="section-label">WHO CAN SEE THIS?</h4>
              <div className="visibility-options">
                {[["everyone", "Everyone in my communities"], ["manual", "Only people I select"], ["request_only", "Only people who request"]].map(([value, label]) => <button key={value} className={`radio-pill ${visibilityMode === value ? "active" : ""}`} onClick={() => setVisibilityMode(value)} data-testid={`visibility-${value}-button`}>{label}</button>)}
              </div>
              {visibilityMode === "manual" && <div className="manual-list" data-testid="manual-visibility-list"><p className="muted">Select people from community member lists after joining communities.</p><input className="input" value={manualIds.join(",")} onChange={(e) => setManualIds(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} placeholder="Parent IDs for now" data-testid="manual-visible-parent-ids" /></div>}
            </section>
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
  const [feed, setFeed] = useState({ families: [], matches: [] });
  const [proposal, setProposal] = useState(null);
  const [filter, setFilter] = useState("Upcoming");
  const [feedFilter, setFeedFilter] = useState("Overlapping with me");
  useEffect(() => { api("/community-feed").then(setFeed).catch(() => {}); }, [dashboard]);
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + i); return d; });
  const availabilityDates = new Set((dashboard?.availability || []).map((s) => s.date));
  const pendingDates = new Set((dashboard?.playdates || []).filter((p) => ["proposed", "countered"].includes(p.status)).map((p) => p.date));
  const confirmedDates = new Set((dashboard?.playdates || []).filter((p) => ["confirmed", "rescheduled"].includes(p.status)).map((p) => p.date));
  const visiblePlaydates = (dashboard?.playdates || []).filter((p) => filter === "All" || (filter === "Completed" ? p.status === "completed" : p.status !== "completed"));
  const overlapIds = new Set((feed.matches || []).map((m) => m.parent.user_id));
  const families = (feed.families || []).filter((family) => feedFilter === "All families" || (feedFilter === "Overlapping with me" ? overlapIds.has(family.parent.user_id) : true));
  return (
    <AppLayout title="Playdates" user={user}>
      <div className="stack stagger">
        <button className="button primary" onClick={() => setShowGroup(true)} data-testid="new-playdate-button"><Plus size={18} /> New Playdate</button>
        <section className="week-card" data-testid="playdates-week-section">
          <div className="week-strip" data-testid="week-strip">
            {week.map((day) => {
              const value = isoDate(day); const today = value === isoDate(new Date());
              return <button key={value} className="week-day" data-testid={`week-day-${value}`}><span>{day.toLocaleDateString(undefined, { weekday: "short" })}</span><b className={today ? "today" : ""}>{day.getDate()}</b><i>{availabilityDates.has(value) && <em className="dot sage" />}{confirmedDates.has(value) && <em className="dot terra" />}{pendingDates.has(value) && <em className="dot amber" />}</i></button>;
            })}
          </div>
          <div className="chip-row" data-testid="playdate-filter-pills">{["Upcoming", "Completed", "All"].map((item) => <button key={item} className={`filter-pill ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)} data-testid={`filter-${item.toLowerCase()}-button`}>{item}</button>)}</div>
        </section>
        <section className="stack" data-testid="activity-feed-section">
          {(dashboard?.notifications || []).slice(0, 4).map((note) => <ActivityCard note={note} key={note.notification_id} />)}
          {!dashboard?.notifications?.length && <div className="empty-state card" data-testid="activity-feed-empty">No activity yet.</div>}
        </section>
        <CalendarView dashboard={dashboard} refresh={refresh} />
        <button className="button blue" onClick={() => setShowGroup(true)} data-testid="new-group-playdate-button"><Users size={18} /> New Group Playdate</button>
        <section className="stack" data-testid="playdates-availability-feed">
          <h2 className="section-label" data-testid="who-free-title">WHO'S FREE THIS WEEK</h2>
          <div className="chip-row">{["Overlapping with me", "Free this week", "All families"].map((item) => <button key={item} className={`filter-pill ${feedFilter === item ? "active" : ""}`} onClick={() => setFeedFilter(item)} data-testid={`feed-filter-${item.toLowerCase().replaceAll(" ", "-")}`}>{item}</button>)}</div>
          {feedFilter === "Overlapping with me" && <p className="hint-line" data-testid="overlap-hint">⚡ Families with an amber border overlap with your availability this week.</p>}
          {families.map((family) => <FamilyAvailabilityCard key={family.parent.user_id} family={family} overlapping={overlapIds.has(family.parent.user_id)} dashboard={dashboard} onPropose={(slot) => setProposal({ family, slot })} />)}
          {!families.length && <div className="empty-state card" data-testid="family-feed-empty">No families match this filter yet.</div>}
        </section>
        <section className="stack" data-testid="playdate-list-section">
          <h2 className="section-title" data-testid="playdate-list-title">Proposals & plans</h2>
          {visiblePlaydates.length ? visiblePlaydates.map((playdate) => <PlaydateCard key={playdate.playdate_id} playdate={playdate} user={user} refresh={refresh} />) : <div className="empty-state card" data-testid="playdates-empty-state">No playdates yet.</div>}
        </section>
      </div>
      {proposal && <ProposalModal {...proposal} dashboard={dashboard} refresh={refresh} onClose={() => setProposal(null)} />}
      {showGroup && <GroupPlaydateModal dashboard={dashboard} refresh={refresh} onClose={() => setShowGroup(false)} />}
    </AppLayout>
  );
}

function ActivityCard({ note }) {
  const Icon = note.kind === "playdate" ? Check : note.kind === "sponsor" ? Clock : Send;
  return <div className="activity-card" data-testid={`activity-card-${note.notification_id}`}><span className={`activity-icon ${note.kind || "default"}`}><Icon size={16} /></span><div><strong>{note.title}</strong><p>{note.body}</p><small>{fmtDate(note.created_at?.slice(0, 10) || isoDate(new Date()), { month: "short", day: "numeric" })}</small></div>{!note.read_at && <i />}</div>;
}

function FamilyAvailabilityCard({ family, overlapping, dashboard, onPropose }) {
  const child = firstChild(family.children);
  const ownChild = firstChild(dashboard?.children);
  const slot = family.slots?.[0];
  return <article className={`family-availability-card ${overlapping ? "overlapping" : ""}`} data-testid={`family-availability-${family.parent.user_id}`}><div className="family-head"><div className="row" style={{ gap: 10 }}><div className="avatar-circle" style={{ width: 40, height: 40 }}>{family.parent.name?.[0]}</div><div><strong>{family.parent.name}</strong><p className="muted">{child.first_name} · age {child.age}</p></div></div><span className="badge sage">{tierText(family.parent)}</span></div><div className="chip-row">{(child.interests || []).slice(0, 4).map((interest) => <span className="interest-pill small" key={interest}>{interest}</span>)}</div>{slot && <div className="family-head"><p><span className="green-dot">●</span> {fmtDate(slot.date, { weekday: "long" })} {slot.blocks?.map((b) => `${timeLabel(b.start)}–${timeLabel(b.end)}`).join(", ")}</p>{overlapping && <span className="badge amber">⚡ Overlap</span>}</div>}<button className="button primary" onClick={() => onPropose(slot)} data-testid={`family-propose-${family.parent.user_id}`}>Propose — {ownChild.first_name || "Your child"} + {child.first_name || "Friend"}</button></article>;
}

function ProposalModal({ slot, family, match, dashboard, onClose, refresh }) {
  const [location, setLocation] = useState("Neighborhood park");
  const [activity, setActivity] = useState("Free play");
  const [notes, setNotes] = useState("");
  const targetSlots = family?.slots || (match ? [{ date: match.date, blocks: [{ start: match.start_time, end: match.end_time }], overlapping: true }] : []);
  const [manualDate, setManualDate] = useState(isoDate(new Date(Date.now() + 86400000)));
  const [manualStart, setManualStart] = useState("15:00");
  const [manualEnd, setManualEnd] = useState("17:00");
  const [selectedSlot, setSelectedSlot] = useState(slot || targetSlots[0] || null);
  const selected = match || { parent: family?.parent, children: family?.children, date: selectedSlot?.date || manualDate, start_time: selectedSlot?.blocks?.[0]?.start || manualStart, end_time: selectedSlot?.blocks?.[0]?.end || manualEnd };
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
        <div className="stack" data-testid="proposal-slot-list">
          <h4 className="section-label">OPEN AVAILABILITY</h4>
          {targetSlots.length ? targetSlots.map((slotItem, index) => <button key={`${slotItem.date}-${index}`} className={`slot-pill ${selectedSlot === slotItem ? "active" : ""} ${index === 0 ? "overlap" : ""}`} onClick={() => setSelectedSlot(slotItem)} data-testid={`proposal-slot-${index}`}>{index === 0 ? "⚡ " : ""}{fmtDate(slotItem.date, { weekday: "short", month: "short", day: "numeric" })} · {slotItem.blocks?.map((b) => `${timeLabel(b.start)}–${timeLabel(b.end)}`).join(", ")}</button>) : <div className="mini-card stack" data-testid="proposal-no-availability"><p className="muted">This family hasn't set availability yet. You can still send a proposal.</p><input className="input" type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} data-testid="proposal-manual-date" /><div className="row" style={{ gap: 8 }}><select className="select" value={manualStart} onChange={(e) => setManualStart(e.target.value)} data-testid="proposal-manual-start">{timeOptions.slice(0, -1).map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}</select><select className="select" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} data-testid="proposal-manual-end">{timeOptions.filter((t) => minutes(t) > minutes(manualStart)).map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}</select></div></div>}
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
  const [communities, setCommunities] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [drill, setDrill] = useState(null);
  const location = useLocation();

  const load = useCallback(async () => {
    try {
      const communityData = await api("/communities");
      setCommunities(communityData);
    } catch (error) {
      toast.error(error.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (location.state?.match) setDrill({ proposalMatch: location.state.match }); }, [location.state]);

  const myCommunities = communities.filter((community) => community.membership);
  const masters = communities.filter((community) => !community.master_community_id);

  return (
    <AppLayout title="Community" user={user}>
      <div className="stack stagger">
        <section className="stack" data-testid="my-communities-section">
          <div className="section-row"><h2 className="section-label" data-testid="my-communities-title">MY COMMUNITIES</h2><button className="icon-button" onClick={() => setShowCreate(true)} data-testid="create-community-open-button"><Plus size={18} /></button></div>
          {myCommunities.map((community) => <MyCommunityCard key={community.community_id} community={community} onOpen={() => setDrill({ communityId: community.community_id })} refreshAll={async () => { await refresh(); await load(); }} />)}
          {!myCommunities.length && <div className="empty-state card">No communities joined yet.</div>}
        </section>
        <section className="stack" data-testid="discover-communities-section">
          <h2 className="section-label" data-testid="discover-title">DISCOVER COMMUNITIES</h2>
          <div className="search-bar"><Search size={18} /><input placeholder="Search by school or neighbourhood" data-testid="community-search-input" /></div>
          {masters.map((community) => <CommunityDirectoryCard key={community.community_id} community={community} onOpen={() => setDrill({ communityId: community.community_id })} />)}
        </section>
      </div>
      {showCreate && <CreateCommunityModal onClose={() => setShowCreate(false)} refreshAll={async () => { await refresh(); await load(); }} />}
      {drill && <CommunityDrillDown {...drill} dashboard={dashboard} refresh={refresh} onClose={() => { setDrill(null); load(); }} />}
    </AppLayout>
  );
}

function MyCommunityCard({ community, onOpen, refreshAll }) {
  const [stepBack, setStepBack] = useState(false);
  return <div className="community-card" data-testid={`my-community-${community.community_id}`} onClick={onOpen}><div className="family-head"><div className="row" style={{ gap: 10 }}><div className="community-icon"><MapPin size={18} /></div><div><strong>{community.name}</strong><p className="muted">{community.city} · {community.member_count} members</p></div></div><span className={`badge ${community.membership?.status === "active" ? "sage" : "amber"}`}>{community.membership?.status}</span></div><button className="text-link" onClick={(e) => { e.stopPropagation(); setStepBack(true); }} data-testid={`step-back-${community.community_id}`}>Step back from this community</button>{stepBack && <StepBackSheet community={community} onClose={() => setStepBack(false)} refreshAll={refreshAll} />}</div>;
}

function CommunityDirectoryCard({ community, onOpen }) {
  return (
    <div className="mini-card directory-row" data-testid={`community-card-${community.community_id}`}>
      <div className="family-head">
        <div><strong data-testid={`community-name-${community.community_id}`}>{community.name}</strong><p className="muted" data-testid={`community-meta-${community.community_id}`}>{community.city} · {community.member_count} families</p></div>
        <button className="button small secondary" onClick={onOpen} data-testid={`community-join-${community.community_id}`}>{community.membership ? "Open" : "Join"}</button>
      </div>
    </div>
  );
}

function StepBackSheet({ community, onClose, refreshAll }) {
  const [reason, setReason] = useState("taking_break");
  const [duration, setDuration] = useState("2_weeks");
  const confirm = async () => {
    try {
      const result = await api(`/communities/${community.community_id}/step-back`, { method: "POST", body: JSON.stringify({ reason, duration }) });
      toast.success(result.message);
      await refreshAll?.();
      onClose();
    } catch (error) { toast.error(error.message); }
  };
  return <div className="sheet-overlay" data-testid="step-back-sheet"><section className="bottom-sheet"><div className="drag-handle" /><div className="sheet-title-row"><h3>Step back from {community.name}?</h3><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="stack"><button className={`radio-card ${reason === "moved_schools" ? "active" : ""}`} onClick={() => setReason("moved_schools")}><strong>This child has moved schools</strong><span>We'll help you find their new school community</span></button><button className={`radio-card ${reason === "taking_break" ? "active" : ""}`} onClick={() => setReason("taking_break")}><strong>Taking a break</strong><span>Pause and auto-reactivate later</span></button>{reason === "taking_break" && <div className="chip-row">{[["2_weeks", "2 weeks"], ["1_month", "1 month"], ["3_months", "3 months"]].map(([value, label]) => <button key={value} className={`chip ${duration === value ? "active" : ""}`} onClick={() => setDuration(value)}>{label}</button>)}</div>}<button className={`radio-card ${reason === "other" ? "active" : ""}`} onClick={() => setReason("other")}><strong>Other reason</strong><span>Keeps history and marks as alumni</span></button><button className="button primary" onClick={confirm}>Confirm</button></div></section></div>;
}

function CommunityDrillDown({ communityId, proposalMatch, dashboard, refresh, onClose }) {
  const [detail, setDetail] = useState(null);
  const [proposal, setProposal] = useState(proposalMatch ? { match: proposalMatch } : null);
  const [sponsorPromptId, setSponsorPromptId] = useState(null);
  const [sponsorNameInput, setSponsorNameInput] = useState("");
  const load = useCallback(async () => {
    if (!communityId && proposalMatch) return;
    try { setDetail(await api(`/communities/${communityId}`)); } catch (error) { toast.error(error.message); }
  }, [communityId, proposalMatch]);
  useEffect(() => { load(); }, [load]);
  const loading = !detail && !proposalMatch;
  const community = detail?.community || proposalMatch?.parent || {};
  // Bug fix (UAT Aug 16 2026): this used to auto-submit a hardcoded fake sponsor
  // ("Ms. Smith" / "Grade 1"), which silently bypassed the sponsor model and
  // granted instant active membership. Now it asks the real user for a sponsor
  // name first, matching the PRD's sponsor-vouching / 7-day-provisional rules.
  const join = async (id, sponsorName) => {
    try {
      await api("/communities/join", { method: "POST", body: JSON.stringify({ community_id: id, sponsor_name: sponsorName || null }) });
      toast.success(sponsorName ? "Sponsor request sent" : "Joined — provisional for 7 days until a member sponsors you");
      setSponsorPromptId(null);
      setSponsorNameInput("");
      await load();
      await refresh();
    } catch (error) { toast.error(error.message); }
  };
  return (
    <div className="slide-screen" data-testid="community-drill-screen">
      <header className="top-header">
        <button className="icon-button" onClick={onClose} data-testid="drill-back-button"><ChevronLeft size={20} /></button>
        <div className="screen-title">{loading ? "Loading…" : community.name || "Community"}</div>
        <div />
      </header>
      <main className="main-content stack">
        <section className="card stack">
          <div className="row" style={{ gap: 12 }}>
            <div className="community-icon big"><MapPin size={20} /></div>
            <div><h1 className="section-title">{loading ? "Loading…" : community.name}</h1><p className="muted">{loading ? "" : `${community.city || ""} · ${community.member_count || 0} members`}</p></div>
          </div>
          {detail?.membership ? <span className="badge sage">{detail.membership.status}</span> : communityId && <button className="button primary" onClick={() => setSponsorPromptId(communityId)} data-testid="request-to-join-button">Request to Join</button>}
        </section>
        {sponsorPromptId && (
          <section className="card stack" data-testid="sponsor-prompt-card">
            <h2 className="section-label">WHO CAN VOUCH FOR YOU?</h2>
            <p className="muted">Name a member you know so they can confirm you. Don't know anyone yet? You can still join provisionally for 7 days.</p>
            <input className="input" value={sponsorNameInput} onChange={(e) => setSponsorNameInput(e.target.value)} placeholder="Sponsor's name" data-testid="drill-sponsor-name-input" />
            <button className="button primary" onClick={() => join(sponsorPromptId, sponsorNameInput)} disabled={!sponsorNameInput} data-testid="drill-sponsor-submit-button">Send sponsor request</button>
            <button className="button secondary" onClick={() => join(sponsorPromptId, null)} data-testid="drill-provisional-button">I don't know anyone — join provisionally</button>
            <button className="button ghost" onClick={() => { setSponsorPromptId(null); setSponsorNameInput(""); }}>Cancel</button>
          </section>
        )}
        {detail?.grades && <section className="stack"><h2 className="section-label">GRADE COMMUNITIES</h2>{detail.grades.map((grade) => <div className="mini-card family-head" key={grade.community_id}><div><strong>{grade.name.replace("Mulgrave ", "")}</strong><p className="muted">{grade.member_count} members</p></div>{grade.membership ? <span className="badge sage">Active</span> : <button className="button small secondary" onClick={() => setSponsorPromptId(grade.community_id)}>Join</button>}</div>)}</section>}
        {detail?.members?.length > 0 && <section className="stack"><h2 className="section-label">MEMBERS</h2>{detail.members.map((member) => <ParentRow key={member.user_id} parent={member} />)}</section>}
        {proposalMatch && <button className="button primary" onClick={() => setProposal({ match: proposalMatch })}>Propose Playdate →</button>}
      </main>
      {proposal && <ProposalModal {...proposal} dashboard={dashboard} refresh={refresh} onClose={() => setProposal(null)} />}
    </div>
  );
}

function ParentRow({ parent }) {
  const [sheet, setSheet] = useState(false);
  const child = firstChild(parent.children);
  return <><button className="parent-row" onClick={() => setSheet(true)} data-testid={`parent-row-${parent.user_id}`}><div className="avatar-circle" style={{ width: 36, height: 36 }}>{parent.name?.[0]}</div><div><strong>{parent.name}</strong><p className="muted">{child.first_name || "Child"}</p></div><span className="badge sage">{tierText(parent)}</span></button>{sheet && <ParentProfileSheet parent={parent} onClose={() => setSheet(false)} />}</>;
}

function ParentProfileSheet({ parent, onClose }) {
  const [status, setStatus] = useState(parent.sharing ? "sharing" : "idle");
  const child = firstChild(parent.children);
  const request = async () => { try { const result = await api("/availability-share-requests", { method: "POST", body: JSON.stringify({ target_parent_id: parent.user_id }) }); setStatus(result.status === "approved" ? "sharing" : "pending"); toast.success(result.status === "approved" ? `✓ You're now sharing availability with ${parent.name} 🎉` : "Request sent"); } catch (error) { toast.error(error.message); } };
  return <div className="sheet-overlay" data-testid="parent-profile-sheet"><section className="bottom-sheet centered-sheet"><div className="drag-handle" /><button className="icon-button sheet-close" onClick={onClose}><X size={18} /></button><div className="avatar-circle" style={{ width: 56, height: 56, margin: "0 auto" }}>{parent.name?.[0]}</div><h2>{parent.name}</h2><p className="muted">{child.first_name} · age {child.age}</p><span className="badge sage">{tierText(parent)}</span><div className="chip-row centered">{(child.interests || []).map((interest) => <span className="interest-pill" key={interest}>{interest}</span>)}</div><hr />{status === "sharing" ? <span className="badge sage">✓ Sharing availability</span> : <button className="button secondary" disabled={status === "pending"} onClick={request}>{status === "pending" ? "Request sent — waiting for response" : "Request to share availability"}</button>}</section></div>;
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
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const isInvitee = playdate.participants?.some((p) => p.parent_id === user.user_id && p.rsvp_status === "invited");
  const accepted = playdate.participants?.filter((p) => p.rsvp_status === "accepted") || [];
  const respond = async (action) => {
    try {
      await api(`/playdates/${playdate.playdate_id}/respond`, { method: "POST", body: JSON.stringify({ action }) });
      toast.success(action === "accept" ? "Playdate confirmed" : "Response sent");
      await refresh();
    } catch (error) { toast.error(error.message); }
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
      <div className="chip-row" data-testid={`playdate-participants-${playdate.playdate_id}`}>{accepted.map((p) => <span className="pill" key={p.parent_id}>{p.parent?.name?.split(" ")[0] || "Parent"}</span>)}</div>
      <div className="proposal-actions">
        {isInvitee && <button className="button sage small" onClick={() => respond("accept")} data-testid={`playdate-accept-${playdate.playdate_id}`}><Check size={16} /> Accept</button>}
        {isInvitee && <button className="button secondary small" onClick={() => respond("decline")} data-testid={`playdate-decline-${playdate.playdate_id}`}>Decline</button>}
        {["confirmed", "rescheduled", "completed"].includes(playdate.status) && <button className="button secondary" onClick={() => setShowChat(true)} data-testid={`playdate-chat-${playdate.playdate_id}`}><MessageCircle size={16} /> Open Chat</button>}
        {["confirmed", "rescheduled"].includes(playdate.status) && <button className="button secondary small" onClick={() => setShowReschedule(true)} data-testid={`playdate-reschedule-${playdate.playdate_id}`}>Reschedule</button>}
        {["confirmed", "rescheduled"].includes(playdate.status) && <button className="button secondary small" onClick={() => setShowCancel(true)} data-testid={`playdate-cancel-${playdate.playdate_id}`}>Cancel</button>}
        {["confirmed", "rescheduled"].includes(playdate.status) && <button className="button ghost small" onClick={() => setShowComplete(true)} data-testid={`playdate-complete-open-${playdate.playdate_id}`}>Complete</button>}
      </div>
      {isInvitee && <button className="button amber-outline" onClick={() => setShowReschedule(true)} data-testid={`playdate-counter-${playdate.playdate_id}`}>↳ Counter-propose new time</button>}
      {showChat && <ChatModal playdate={playdate} onClose={() => setShowChat(false)} />}
      {showReschedule && <RescheduleModal playdate={playdate} refresh={refresh} onClose={() => setShowReschedule(false)} />}
      {showComplete && <CompletionModal playdate={playdate} refresh={refresh} onClose={() => setShowComplete(false)} />}
      {showCancel && <CancelModal playdate={playdate} refresh={refresh} onClose={() => setShowCancel(false)} />}
    </article>
  );
}

function RescheduleModal({ playdate, refresh, onClose }) {
  const [date, setDate] = useState(playdate.date);
  const [start, setStart] = useState(playdate.start_time);
  const [end, setEnd] = useState(playdate.end_time);
  const submit = async () => {
    try {
      await api(`/playdates/${playdate.playdate_id}/reschedule`, { method: "POST", body: JSON.stringify({ date, start_time: start, end_time: end }) });
      toast.success("Reschedule request sent");
      await refresh();
      onClose();
    } catch (error) { toast.error(error.message); }
  };
  return (
    <div className="center-overlay" data-testid="reschedule-modal-overlay">
      <section className="modal-panel stack" data-testid="reschedule-modal">
        <div className="sheet-title-row"><h3 data-testid="reschedule-title">Reschedule</h3><button className="icon-button" onClick={onClose} data-testid="reschedule-close-button"><X size={20} /></button></div>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="reschedule-date-input" />
        <div className="row" style={{ gap: 8 }}>
          <select className="select" value={start} onChange={(e) => setStart(e.target.value)} data-testid="reschedule-start-select">{timeOptions.slice(0, -1).map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}</select>
          <select className="select" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="reschedule-end-select">{timeOptions.filter((t) => minutes(t) > minutes(start)).map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}</select>
        </div>
        <button className="button primary" onClick={submit} data-testid="reschedule-submit-button">Send reschedule request</button>
      </section>
    </div>
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
  const locked = ["completed", "cancelled"].includes(playdate.status);
  return (
    <div className="chat-screen" data-testid="chat-screen">
      <header className="top-header"><button className="icon-button" onClick={onClose} data-testid="chat-back-button"><ChevronLeft size={20} /></button><div className="screen-title" data-testid="chat-title">{playdate.title}</div><span className={`badge ${playdate.status === "completed" ? "terra" : "sage"}`}>{playdate.status.toUpperCase()}</span></header>
      <section className="chat-thread" data-testid="chat-message-list">
          {messages.map((m) => <div key={m.message_id} className="chat-message-row" data-testid={`chat-message-${m.message_id}`}><div className="message-bubble"><div>{m.content}</div><small>{new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></div></div>)}
          {!messages.length && <div className="empty-state" data-testid="chat-empty-state">No messages yet.</div>}
      </section>
      {locked ? <div className="chat-locked" data-testid="chat-locked-banner"><Lock size={18} /> Chat is locked after a playdate ends.</div> : <div className="chat-input-bar"><input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Message..." data-testid="chat-message-input" /><button onClick={send} disabled={!content.trim()} data-testid="chat-send-button"><Send size={18} /></button></div>}
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

const CANCEL_REASONS = [
  { label: "Schedule conflict", value: "Schedule conflict" },
  { label: "Child is sick 🤒", value: "sick" },
  { label: "Change of plans", value: "Change of plans" },
  { label: "Other", value: "Other" },
];

function CancelModal({ playdate, refresh, onClose }) {
  const [reason, setReason] = useState("Schedule conflict");
  const cancel = async () => {
    try {
      await api(`/playdates/${playdate.playdate_id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
      toast.success("Playdate cancelled");
      await refresh();
      onClose();
    } catch (error) { toast.error(error.message); }
  };
  return (
    <div className="center-overlay" data-testid="cancel-modal-overlay">
      <section className="modal-panel stack" data-testid="cancel-modal">
        <div className="sheet-title-row"><h3 data-testid="cancel-title">Cancel playdate</h3><button className="icon-button" onClick={onClose} data-testid="cancel-close-button"><X size={20} /></button></div>
        <div className="stack" data-testid="cancel-reason-options">
          {CANCEL_REASONS.map(({ label, value }) => (
            <button key={value} className={`radio-card ${reason === value ? "active" : ""}`} onClick={() => setReason(value)} data-testid={`cancel-reason-${value.toLowerCase().replace(/\s+/g, "-")}`}>{label}</button>
          ))}
        </div>
        <button className="button primary" onClick={cancel} data-testid="cancel-submit-button">Confirm cancellation</button>
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
  const overlays = dashboard?.matches?.filter((m) => selected.includes(m.parent.user_id)).slice(0, 5) || [];
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
        <div className="group-overlay-card" data-testid="group-calendar-overlay">
          <div className="family-head"><strong data-testid="group-overlay-title">Calendar overlay</strong><span className="badge amber">Amber = shared opening</span></div>
          {overlays.length ? overlays.map((match, index) => {
            const left = ((minutes(match.start_time) - 360) / 900) * 100;
            const width = ((minutes(match.end_time) - minutes(match.start_time)) / 900) * 100;
            return (
              <div className="overlay-row" key={match.match_id} data-testid={`group-overlay-row-${match.parent.user_id}`}>
                <span data-testid={`group-overlay-name-${match.parent.user_id}`}>{match.parent.name.split(" ")[0]}</span>
                <div className="overlay-track"><i style={{ left: `${left}%`, width: `${width}%`, opacity: 0.4 + index * 0.08 }} /></div>
              </div>
            );
          }) : <p className="muted" data-testid="group-overlay-empty">Select 2–6 families to compare openings.</p>}
          {overlays.length >= 2 && <button className="slot-button overlap" type="button" onClick={() => { setDate(overlays[0].date); setStart(overlays[0].start_time); setEnd(overlays[0].end_time); }} data-testid="group-amber-overlap-button">Use amber overlap · {fmtDate(overlays[0].date, { weekday: "short", month: "short", day: "numeric" })} {timeLabel(overlays[0].start_time)}–{timeLabel(overlays[0].end_time)}</button>}
        </div>
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
  const [showParentEdit, setShowParentEdit] = useState(false);
  const logout = async () => { await api("/auth/logout", { method: "POST" }); window.location.href = "/login"; };
  return (
    <AppLayout title="Profile" user={user}>
      <div className="stack stagger">
        <section className="card stack" data-testid="profile-parent-card">
          <div className="family-head">
            <div className="row" style={{ gap: 12 }}><div className="avatar-circle" style={{ width: 52, height: 52 }} data-testid="profile-avatar">{user?.name?.[0] || "P"}</div><div><h1 className="section-title" data-testid="profile-name">{user?.name?.split(" ")[0] || "P"}</h1><p className="muted" data-testid="profile-email">{user?.email}</p></div></div>
            <button className="button small secondary" onClick={() => setShowParentEdit(true)} data-testid="edit-parent-profile-button"><Pencil size={15} /> Edit</button>
          </div>
          <span className="badge amber" data-testid="profile-tier-badge">{user?.tier?.badge} {user?.tier?.name} · {user?.credits || 0} {user?.credits === 1 ? "credit" : "credits"}</span>
          <section className="stats-row" data-testid="profile-stats-row">
            {[["playdates_completed", "Playdates completed"], ["credits_earned", "Credits earned"], ["availability_slots", "Availability slots"]].map(([key, label]) => <div className="stat-tile" key={key} data-testid={`profile-stat-${key}`}><strong>{dashboard?.stats?.[key] || 0}</strong><span>{label}</span></div>)}
          </section>
          <div className="chip-row" data-testid="profile-contact-summary">
            <span className="badge blue">{user?.contact_preference || "email"}</span>
            {user?.phone && <span className="badge sage">{user.phone}</span>}
            {user?.neighborhood && <span className="badge terra">{user.neighborhood}</span>}
          </div>
        </section>
        <section className="stack" data-testid="children-section">
          <div className="family-head"><h2 className="section-title" data-testid="children-title">Children</h2><button className="button small primary" onClick={() => setShowChild(true)} data-testid="add-child-open-button"><Plus size={16} /> Add</button></div>
          {dashboard?.children?.map((child) => (
            <div className="mini-card child-profile-card" key={child.child_id} data-testid={`child-card-${child.child_id}`}>
              <div>
                <strong data-testid={`child-name-${child.child_id}`}>{child.first_name}</strong>
                {child.status === "alumni" && <div className="badge amber" data-testid={`child-alumni-${child.child_id}`}>{child.school_name || "School"} Alumni — Class of {child.alumni_class_year || new Date().getFullYear()}</div>}
                <p className="muted" data-testid={`child-detail-${child.child_id}`}>{child.age} · {child.grade} · {child.interests?.join(", ")}</p>
                {child.allergies && <span className="badge amber" data-testid={`child-allergies-${child.child_id}`}>Allergies: {child.allergies}</span>}
              </div>
              <button className="button small secondary" onClick={() => setEditingChild(child)} data-testid={`edit-child-${child.child_id}-button`}>Edit</button>
            </div>
          ))}
          {!dashboard?.children?.length && <div className="empty-state card" data-testid="children-empty-state">Add a child profile to unlock scheduling.</div>}
        </section>
        <section className="card stack" data-testid="notification-settings-card"><h2 className="card-title" data-testid="notification-settings-title">Notification settings</h2><div className="chip-row"><span className="badge sage">Email {user?.notification_preferences?.email ? "on" : "off"}</span><span className="badge blue">Push {user?.notification_preferences?.push ? "on" : "off"}</span><span className="badge amber">SMS {user?.notification_preferences?.sms ? "on" : "off"}</span></div></section>
        <button className="button secondary" onClick={logout} data-testid="logout-button">Log out</button>
      </div>
      {showChild && <ChildModal onClose={() => setShowChild(false)} refresh={refresh} />}
      {editingChild && <ChildModal child={editingChild} onClose={() => setEditingChild(null)} refresh={refresh} />}
      {showParentEdit && <ParentProfileModal user={user} refresh={refresh} onClose={() => setShowParentEdit(false)} />}
    </AppLayout>
  );
}

function ParentProfileModal({ user, refresh, onClose }) {
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    neighborhood: user?.neighborhood || "",
    contact_preference: user?.contact_preference || "email",
    notification_preferences: user?.notification_preferences || { email: true, push: true, sms: false },
  });
  const toggleNotification = (key) => setForm((prev) => ({ ...prev, notification_preferences: { ...prev.notification_preferences, [key]: !prev.notification_preferences?.[key] } }));
  const save = async () => {
    try {
      await api("/profile", { method: "PUT", body: JSON.stringify(form) });
      toast.success("Profile updated");
      await refresh();
      onClose();
    } catch (error) { toast.error(error.message); }
  };
  return (
    <div className="center-overlay" data-testid="parent-profile-modal-overlay">
      <section className="modal-panel stack" data-testid="parent-profile-modal">
        <div className="sheet-title-row"><h3 data-testid="parent-profile-title">Edit Parent Profile</h3><button className="icon-button" onClick={onClose} data-testid="parent-profile-close-button"><X size={20} /></button></div>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="First name" data-testid="parent-name-input" />
        <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" data-testid="parent-phone-input" />
        <input className="input" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} placeholder="Neighborhood / area" data-testid="parent-neighborhood-input" />
        <select className="select" value={form.contact_preference} onChange={(e) => setForm({ ...form, contact_preference: e.target.value })} data-testid="parent-contact-preference-select"><option value="email">Email</option><option value="sms">SMS</option><option value="in_app">In-app only</option></select>
        <div className="chip-row" data-testid="notification-toggle-row">
          {[["email", "Email"], ["push", "Push"], ["sms", "SMS"]].map(([key, label]) => <button key={key} className={`chip ${form.notification_preferences?.[key] ? "active" : ""}`} onClick={() => toggleNotification(key)} data-testid={`notification-${key}-toggle`}>{label}</button>)}
        </div>
        <button className="button primary" onClick={save} data-testid="parent-profile-save-button">Save parent profile</button>
      </section>
    </div>
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
    const payload = { ...form, first_name: form.first_name ? form.first_name.charAt(0).toUpperCase() + form.first_name.slice(1) : form.first_name };
    try {
      if (child?.child_id) {
        await api(`/children/${child.child_id}`, { method: "PUT", body: JSON.stringify(payload) });
        toast.success("Child profile updated");
      } else {
        await api("/children", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Child profile added");
      }
      await refresh();
      onClose();
    } catch (error) { toast.error(error.message); }
  };
  return (
    <div className="center-overlay" data-testid="child-modal-overlay">
      <section className="modal-panel stack" data-testid="child-modal">
        <div className="sheet-title-row"><h3 data-testid="child-modal-title">{child ? "Edit Child Profile" : "Child Profile"}</h3><button className="icon-button" onClick={onClose} data-testid="child-close-button"><X size={20} /></button></div>
        <input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="First name only" data-testid="child-first-name-input" />
        <input className="input" type="number" min="3" max="13" value={form.age} onChange={(e) => setForm({ ...form, age: Number(e.target.value) })} data-testid="child-age-input" />
        <select className="select" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} data-testid="child-grade-select">{GRADES.map((g) => <option key={g}>{g}</option>)}</select>
        <div className="chip-row" data-testid="child-interest-options">{INTERESTS.map((interest) => <button key={interest} className={`chip ${form.interests.includes(interest) ? "active" : ""}`} onClick={() => toggleInterest(interest)} data-testid={`interest-${interest.toLowerCase()}-button`}>{interest}</button>)}</div>
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
