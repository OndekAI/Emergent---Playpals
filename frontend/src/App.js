import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/App.css";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Baby,
  CalendarDays,
  Check,
  ChevronDown,
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
  Users,
  UserRound,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import AddFamily from "./AddFamily";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

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

const minutesToTime = (total) => `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

const DAY_CHIP_TIMES = Array.from({ length: 21 }, (_, i) => minutesToTime(9 * 60 + i * 30));

const chipsToBlocks = (chips) => {
  const sorted = [...chips].sort((a, b) => minutes(a) - minutes(b));
  const blocks = [];
  for (const t of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && minutes(last.end) === minutes(t)) {
      last.end = minutesToTime(minutes(t) + 30);
    } else {
      blocks.push({ start: t, end: minutesToTime(minutes(t) + 30) });
    }
  }
  return blocks;
};

const blocksToChips = (blocks) => {
  const chips = new Set();
  for (const block of blocks || []) {
    for (let m = minutes(block.start); m < minutes(block.end); m += 30) chips.add(minutesToTime(m));
  }
  return chips;
};

const GRADES = ["Pre-K", "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"];
const INTERESTS = ["Sports", "Lego", "Art", "Reading", "Dance", "Swimming", "Gaming", "Nature", "Science", "Music", "Cooking", "Animals"];
const ACTIVITIES = ["Park", "Our place", "Their place", "Swimming", "Soft play", "Free play"];
const CHILD_COLORS = ["var(--terracotta)", "var(--blue)", "var(--sage)", "var(--amber)"];
const childColor = (index) => CHILD_COLORS[index % CHILD_COLORS.length];

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
    const magicToken = hash.get("token");
    const run = async () => {
      try {
        if (magicToken) await api("/auth/magic/verify", { method: "POST", body: JSON.stringify({ token: magicToken }) });
        await refresh();
        const pendingSlug = localStorage.getItem("pendingJoinSlug");
        const dest = pendingSlug ? `/join/${pendingSlug}` : "/home";
        if (pendingSlug) localStorage.removeItem("pendingJoinSlug");
        window.history.replaceState({}, "", dest);
        navigate(dest, { replace: true });
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

function LoginScreen({ refresh }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [googleReady, setGoogleReady] = useState(false);
  const navigate = useNavigate();

  // Real Google sign-in via Google Identity Services — replaces the old
  // auth.emergentagent.com redirect. Google renders its own button into a
  // hidden container; our visible "Continue with Google" button just clicks it,
  // so the on-screen design stays exactly as spec'd.
  const handleGoogleCredential = useCallback(async (credentialResponse) => {
    setBusy(true);
    try {
      await api("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      await refresh();
      const pendingSlug = localStorage.getItem("pendingJoinSlug");
      const dest = pendingSlug ? `/join/${pendingSlug}` : "/home";
      if (pendingSlug) localStorage.removeItem("pendingJoinSlug");
      navigate(dest, { replace: true });
    } catch (error) {
      toast.error(error.message || "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }, [refresh, navigate]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const initialize = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      const container = document.getElementById("hidden-google-button");
      if (container) {
        window.google.accounts.id.renderButton(container, { type: "standard" });
      }
      setGoogleReady(true);
    };
    if (window.google?.accounts?.id) {
      initialize();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [handleGoogleCredential]);

  const googleLogin = () => {
    if (!GOOGLE_CLIENT_ID) {
      toast.error("Google sign-in isn't set up yet — use the email link below for now.");
      return;
    }
    const realButton = document.querySelector("#hidden-google-button div[role=button]");
    if (realButton && googleReady) {
      realButton.click();
    } else {
      toast.error("Google sign-in is still loading — try again in a second.");
    }
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
        <div id="hidden-google-button" style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 0, overflow: "hidden" }} aria-hidden="true" />
        <button type="button" className="button primary" onClick={googleLogin} disabled={busy} data-testid="google-login-button">
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
  ["/home", "Home", Home],
  ["/playdates", "Playdates", CalendarDays],
  ["/community", "Community", Users],
  ["/profile", "Profile", UserRound],
];

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <nav className="bottom-nav" data-testid="bottom-navigation">
      {navItems.map(([path, label, Icon]) => (
        <button
          key={path}
          className={`nav-item ${location.pathname.startsWith(path) ? "active" : ""}`}
          onClick={() => navigate(path)}
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

function Protected({ authed, loading, needsWelcome, children }) {
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!authed) return <Navigate to="/login" replace />;
  if (needsWelcome && location.pathname !== "/welcome") return <Navigate to="/welcome" replace />;
  return children;
}

function JoinLinkGate({ authed, loading, children }) {
  const { slug } = useParams();
  if (loading) return <LoadingScreen />;
  if (!authed) {
    localStorage.setItem("pendingJoinSlug", slug);
    return <Navigate to="/login" replace />;
  }
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

// 5.6: rough client-side estimate for "soonest to expire" sort order — mirrors the
// backend timer's whichever-comes-first rule (created_at + 48h vs. the slot's own
// start time, see run_proposal_expiry_timer in server.py) closely enough for display
// ordering. Not meant to be exact-to-the-minute; the real expiry is server-side.
function estimatedExpiry(playdate) {
  const createdPlus48h = new Date(playdate.created_at).getTime() + 48 * 3600 * 1000;
  const slotStart = new Date(`${playdate.date}T${playdate.start_time}:00`).getTime();
  return Math.min(createdPlus48h, slotStart);
}

function HomePage({ user, dashboard, refresh }) {
  const navigate = useNavigate();
  const location = useLocation();
  // 5.6: split what was one undifferentiated "Upcoming" list into waiting-on-you
  // (needs a response from this parent) vs. already-confirmed, sorted appropriately
  // for each — soonest-to-expire for the former, soonest-date for the latter.
  const waitingOnYou = (dashboard?.playdates || [])
    .filter((p) => ["proposed", "countered", "reschedule_pending"].includes(p.status))
    .sort((a, b) => estimatedExpiry(a) - estimatedExpiry(b));
  const comingUp = (dashboard?.playdates || [])
    .filter((p) => ["confirmed", "rescheduled"].includes(p.status))
    .sort((a, b) => new Date(`${a.date}T${a.start_time}:00`) - new Date(`${b.date}T${b.start_time}:00`));
  const [showAllComingUp, setShowAllComingUp] = useState(false);
  const visibleComingUp = showAllComingUp ? comingUp : comingUp.slice(0, 2);
  const [localMatches, setLocalMatches] = useState(dashboard?.matches || []);
  const [sponsorRequests, setSponsorRequests] = useState([]);
  const [shareRequests, setShareRequests] = useState([]);

  useEffect(() => {
    api("/sponsor-requests").then(setSponsorRequests).catch(() => setSponsorRequests([]));
    api("/availability-share-requests/pending").then(setShareRequests).catch(() => setShareRequests([]));
  }, [dashboard]);

  useEffect(() => setLocalMatches(dashboard?.matches || []), [dashboard?.matches]);

  // 3.7/5.7: scroll to the playdate a notification linked to, if it's currently
  // rendered here (e.g. in Waiting on You, or the visible slice of Coming Up). If
  // it's not — completed, or not in the visible top-2 — this used to be a silent
  // no-op; now it's at least a toast explaining why, rather than building the full
  // "find this playdate anywhere" view, which stays out of scope. Deliberately not
  // depending on `dashboard` here (only location.state) so an unrelated dashboard
  // refresh elsewhere doesn't re-fire this and re-toast; a slightly stale read of
  // dashboard for the toast wording is an acceptable tradeoff for that.
  useEffect(() => {
    const targetId = location.state?.highlightPlaydateId;
    if (!targetId) return;
    const el = document.querySelector(`[data-testid="playdate-card-${targetId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const target = (dashboard?.playdates || []).find((p) => p.playdate_id === targetId);
    if (target?.status === "completed") toast("That playdate has already completed");
    else if (target) toast("That playdate isn't shown here right now");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const proposeMatch = (match) => {
    navigate("/community", { state: { match } });
  };

  const dismissMatch = async (match, dismissalType) => {
    setLocalMatches((prev) => prev.filter((item) => item.match_id !== match.match_id));
    try {
      const doc = await api("/matches/dismiss", { method: "POST", body: JSON.stringify({ target_parent_id: match.parent.user_id, dismissal_type: dismissalType }) });
      if (dismissalType === "dont_suggest_again") {
        // Undo just deletes the dismissal record server-side and refreshes the
        // dashboard — no need to re-insert the match into localMatches by hand,
        // the existing dashboard.matches sync effect picks it back up.
        toast("We won't suggest this pairing again", {
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await api(`/matches/dismiss/${doc.dismissal_id}`, { method: "DELETE" });
                await refresh();
                toast.success("Undone");
              } catch (error) { toast.error(error.message); }
            },
          },
        });
      } else {
        toast.success("Hidden for this week");
      }
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
            {sponsorRequests.map((request) => <SponsorRequestCard key={request.membership_id} request={request} onResponded={() => { setSponsorRequests((prev) => prev.filter((r) => r.membership_id !== request.membership_id)); refresh(); }} />)}
          </section>
        )}

        {!!shareRequests.length && (
          <section className="card stack" data-testid="share-requests-card">
            <span className="badge blue" data-testid="share-requests-badge">Availability share requests</span>
            {shareRequests.map((request) => <ShareRequestCard key={request.request_id} request={request} onResponded={() => { setShareRequests((prev) => prev.filter((r) => r.request_id !== request.request_id)); refresh(); }} />)}
          </section>
        )}

        <section className="stack" data-testid="home-match-section">
          <div className="section-row"><h2 className="match-heading" data-testid="match-section-title">Playdate Match Found!</h2><span data-testid="match-count">{localMatches.length} matches</span></div>
          <div className="match-scroll" data-testid="match-card-list">
            {localMatches.map((match) => <MatchCard key={match.match_id} match={match} onPropose={() => proposeMatch(match)} onDismiss={dismissMatch} />)}
            {!localMatches.length && <div className="empty-state card" data-testid="match-empty-state">No new matches right now.</div>}
          </div>
        </section>

        {/* 5.6: each section omitted entirely when empty — no "nothing here"
            placeholder per section, neither is collapsible. The one overall empty
            state below only shows when BOTH are empty (a genuinely new parent). */}
        {!!waitingOnYou.length && (
          <section className="stack" data-testid="home-waiting-section">
            <h2 className="section-title" data-testid="home-waiting-title">Waiting on You</h2>
            {waitingOnYou.map((playdate) => (
              <PlaydateCard key={playdate.playdate_id} playdate={playdate} user={user} dashboard={dashboard} refresh={refresh} />
            ))}
          </section>
        )}

        {!!comingUp.length && (
          <section className="stack" data-testid="home-coming-up-section">
            <h2 className="section-title" data-testid="home-coming-up-title">Coming Up</h2>
            {visibleComingUp.map((playdate) => (
              <PlaydateCard key={playdate.playdate_id} playdate={playdate} user={user} dashboard={dashboard} refresh={refresh} />
            ))}
            {comingUp.length > 2 && !showAllComingUp && (
              <button className="text-link" onClick={() => setShowAllComingUp(true)} data-testid="home-coming-up-see-all">
                See all {comingUp.length}
              </button>
            )}
          </section>
        )}

        {!waitingOnYou.length && !comingUp.length && (
          <section className="stack" data-testid="home-upcoming-section">
            <h2 className="section-title" data-testid="home-upcoming-title">Upcoming</h2>
            <div className="empty-state card" data-testid="home-empty-upcoming">No playdates yet. Community availability is ready when you are.</div>
          </section>
        )}

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
          <h3 data-testid={`match-children-${match.match_id}`}>{childA.first_name || "Your child"} & {childB.first_name || "Friend"}</h3>{process.env.NODE_ENV !== "production" && match.parent?.user_id?.startsWith("sample_") && <p className="muted" data-testid={`match-demo-${match.match_id}`}>Demo family</p>}
          <p className="muted" data-testid={`match-meta-${match.match_id}`}>Ages {childA.age || "?"} & {childB.age || "?"} · {ageGap}yr apart · {match.parent?.name}</p>
        </div>
        <span className={`score-badge ${high ? "sage" : "amber"}`} data-testid={`match-score-${match.match_id}`}>{match.score_label || "Great match"}</span>
      </div>
      <span className="badge sage" data-testid={`match-tier-${match.match_id}`}>{tierText(match.parent)}</span>
      <div className="stack" style={{ gap: 8 }}>
        <span className="muted">Both enjoy:</span>
        <div className="chip-row" data-testid={`match-interests-${match.match_id}`}>{(shared.length ? shared : (childB.interests || []).slice(0, 3)).map((interest) => <span className="interest-pill" key={interest}>{interest}</span>)}</div>
      </div>
      <p data-testid={`match-time-${match.match_id}`}><CalendarDays size={15} /> {fmtDate(match.date, { weekday: "short", month: "short", day: "numeric" })} · {timeLabel(match.start_time)}–{timeLabel(match.end_time)}</p>
      <span className="overlap-pill" data-testid={`match-overlap-${match.match_id}`}>{match.duration_minutes}+ min overlap</span>
      <button className="button primary" onClick={onPropose} data-testid={`match-propose-${match.match_id}`}>Propose Playdate →</button>
      <div className="match-links"><button onClick={() => onDismiss(match, "not_this_week")} data-testid={`match-not-this-week-${match.match_id}`}>Not this week</button><span>|</span><button className="danger-link" onClick={() => onDismiss(match, "dont_suggest_again")} data-testid={`match-dont-suggest-${match.match_id}`}>Don't suggest again</button></div>
    </article>
  );
}

function SponsorRequestCard({ request, onResponded }) {
  const respond = async (action) => {
    try {
      await api(`/sponsor-requests/${request.membership_id}/respond`, { method: "POST", body: JSON.stringify({ action }) });
      toast.success(action === "approve" ? "Sponsor approved" : "Sponsor declined");
      onResponded();
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

function ShareRequestCard({ request, onResponded }) {
  const respond = async (action) => {
    try {
      await api(`/availability-share-requests/${request.request_id}/respond`, { method: "POST", body: JSON.stringify({ action }) });
      toast.success(action === "approve" ? "Now sharing availability" : "Request declined");
      onResponded();
    } catch (error) { toast.error(error.message); }
  };
  return (
    <div className="mini-card stack" data-testid={`share-request-${request.request_id}`}>
      <div>
        <strong data-testid={`share-request-parent-${request.request_id}`}>{request.requester?.name}</strong>
        <p className="muted" data-testid={`share-request-detail-${request.request_id}`}>wants to share availability with you</p>
      </div>
      <div className="proposal-actions">
        <button className="button sage small" onClick={() => respond("approve")} data-testid={`share-approve-${request.request_id}`}>Yes, share</button>
        <button className="button secondary small" onClick={() => respond("decline")} data-testid={`share-decline-${request.request_id}`}>No</button>
      </div>
    </div>
  );
}

const defaultRecurringEndDate = (fromDate) => {
  const year = fromDate.getFullYear();
  const june30 = new Date(year, 5, 30);
  return june30 >= fromDate ? june30 : new Date(year + 1, 5, 30);
};

const mostRecentSlot = (availability) => {
  const sorted = [...availability].filter((s) => s.created_at).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return sorted[0] || null;
};

function DaySheet({ selectedDate, availability, onClose, onSaved, children, activeChildId, playdates }) {
  const dateSlots = availability.filter((slot) => slot.date === isoDate(selectedDate));
  // 3.1: a live proposal (not yet resolved) blocks deletion outright on the backend —
  // distinct from ever_held, which is just "someone proposed against this at some point"
  // and only prompts a confirm-before-delete, not a hard block.
  const slotIds = new Set(dateSlots.map((s) => s.slot_id));
  const hasLiveProposal = (playdates || []).some((p) => ["proposed", "countered"].includes(p.status) && slotIds.has(p.slot_id));
  const existing = dateSlots[0] || null;
  const lastUsed = existing || mostRecentSlot(availability);
  const [checkedIds, setCheckedIds] = useState(() => new Set(
    children.length
      ? (dateSlots.length
          ? children.filter((c) => dateSlots.some((s) => !s.child_ids?.length || s.child_ids.includes(c.child_id))).map((c) => c.child_id)
          : (activeChildId && children.some((c) => c.child_id === activeChildId) ? [activeChildId] : children.map((c) => c.child_id)))
      : []
  ));
  const [chips, setChips] = useState(() => (existing?.blocks?.length ? blocksToChips(existing.blocks) : new Set(["15:00", "15:30", "16:00", "16:30"])));
  const [recurrence, setRecurrence] = useState(existing?.is_recurring ? "weekly" : "once");
  const [endDate, setEndDate] = useState(existing?.recurring_end_date || isoDate(defaultRecurringEndDate(selectedDate)));
  const [editingEndDate, setEditingEndDate] = useState(false);
  const [visibilityMode, setVisibilityMode] = useState(lastUsed?.visibility_mode || "everyone");
  const [manualIds, setManualIds] = useState(lastUsed?.visible_to_parent_ids || []);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [blockedDelete, setBlockedDelete] = useState(false);
  const [showShareSuggestion, setShowShareSuggestion] = useState(false);
  const dateText = selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const dayName = selectedDate.toLocaleDateString(undefined, { weekday: "long" });
  const isPast = isoDate(selectedDate) < isoDate(new Date());

  useEffect(() => {
    api("/community-members")
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false));
  }, []);

  const toggleChip = (t) => {
    setChips((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };

  const toggleChild = (childId) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(childId) ? next.delete(childId) : next.add(childId);
      return next;
    });
  };

  const toggleManual = (parentId) => {
    setManualIds((prev) => prev.includes(parentId) ? prev.filter((id) => id !== parentId) : [...prev, parentId]);
  };

  const save = async () => {
    const blocks = chipsToBlocks(chips);
    if (!blocks.length) {
      toast.error("Tap at least one time you're open");
      return;
    }
    const childIds = children.length <= 1
      ? (children[0] ? [children[0].child_id] : [])
      : (checkedIds.size === children.length ? [] : [...checkedIds]);
    // 4.5: first-save-only, not every save — this is a one-time "here's what to do
    // next" nudge for someone who just set availability for the first time and would
    // otherwise see nothing happen (no active share means nobody can see it yet).
    // Repeating it on every save would just be naggy for a parent who already knows
    // the ropes. Checked against the pre-save prop, before this save adds to it.
    const isFirstSave = availability.length === 0;
    try {
      await api("/availability", {
        method: "POST",
        body: JSON.stringify({
          date: isoDate(selectedDate),
          blocks,
          recurrence,
          visibility_mode: visibilityMode,
          visible_to_parent_ids: manualIds,
          child_ids: childIds,
          recurring_end_date: recurrence === "weekly" ? endDate : null,
        }),
      });
      toast.success("Saved");
      await onSaved();
      if (isFirstSave) {
        setShowShareSuggestion(true);
      } else {
        onClose();
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const doRemove = async () => {
    try {
      await api(`/availability/${isoDate(selectedDate)}`, { method: "DELETE" });
      toast.success("Removed");
      await onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const remove = () => {
    if (hasLiveProposal) {
      setBlockedDelete(true);
    } else if (dateSlots.some((s) => s.ever_held)) {
      setConfirmDelete(true);
    } else {
      doRemove();
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
            <p className="muted">Tap the times you're open</p>
            <div className="time-grid" data-testid="availability-time-grid">
              {DAY_CHIP_TIMES.map((t) => (
                <button key={t} className={`time-chip ${chips.has(t) ? "active" : ""}`} onClick={() => toggleChip(t)} data-testid={`availability-time-chip-${t}`}>
                  {timeLabel(t)}
                </button>
              ))}
            </div>
            {children.length > 1 && (
              <section className="stack" data-testid="availability-child-section">
                <h4 className="section-label">WHO'S FREE</h4>
                <div className="stack" style={{ gap: 8 }}>
                  {children.map((child, index) => {
                    const checked = checkedIds.has(child.child_id);
                    return (
                      <button
                        type="button"
                        key={child.child_id}
                        className={`parent-row ${checked ? "active" : ""}`}
                        onClick={() => toggleChild(child.child_id)}
                        data-testid={`availability-child-${child.child_id}-button`}
                      >
                        <div className="avatar-circle" style={{ width: 36, height: 36, background: childColor(index) }}>{child.first_name?.[0]?.toUpperCase()}</div>
                        <strong>{child.first_name}</strong>
                        {checked && <Check size={18} data-testid={`availability-child-checked-${child.child_id}`} />}
                      </button>
                    );
                  })}
                </div>
                <p className="muted" style={{ fontSize: 12 }}>Both children start checked — most open windows are the whole household. Uncheck anyone with a conflict.</p>
              </section>
            )}
            <section className="stack" data-testid="availability-visibility-section">
              <h4 className="section-label">WHO CAN SEE THIS?</h4>
              <div className="visibility-options">
                {[["everyone", "Everyone in my communities"], ["manual", "Only people I select"], ["request_only", "Only people who request"]].map(([value, label]) => (
                  <button key={value} className={`radio-pill ${visibilityMode === value ? "active" : ""}`} onClick={() => setVisibilityMode(value)} data-testid={`visibility-${value}-button`}>{label}</button>
                ))}
              </div>
              {visibilityMode === "manual" && (
                <div className="manual-list stack" data-testid="manual-visibility-list">
                  {membersLoading ? (
                    <p className="muted">Loading your community members…</p>
                  ) : members.length ? (
                    members.map((member) => {
                      const checked = manualIds.includes(member.user_id);
                      return (
                        <button
                          type="button"
                          key={member.user_id}
                          className={`parent-row ${checked ? "active" : ""}`}
                          onClick={() => toggleManual(member.user_id)}
                          data-testid={`manual-visible-option-${member.user_id}`}
                        >
                          <div className="avatar-circle" style={{ width: 36, height: 36 }}>
                            {member.picture ? <img src={member.picture} alt="" /> : member.name?.[0]?.toUpperCase()}
                          </div>
                          <strong>{member.name}</strong>
                          {checked && <Check size={18} data-testid={`manual-visible-checked-${member.user_id}`} />}
                        </button>
                      );
                    })
                  ) : (
                    <p className="muted">Join a community to select people here.</p>
                  )}
                </div>
              )}
            </section>
            <div className="radio-pills" data-testid="availability-recurring-options">
              <button className={`radio-pill ${recurrence === "once" ? "active" : ""}`} onClick={() => setRecurrence("once")} data-testid="availability-once-button">Just this once</button>
              <button className={`radio-pill ${recurrence === "weekly" ? "active" : ""}`} onClick={() => setRecurrence("weekly")} data-testid="availability-weekly-button">Every {dayName}</button>
            </div>
            {recurrence === "weekly" && (
              <div className="mini-card row" style={{ justifyContent: "space-between" }} data-testid="availability-end-date-row">
                {editingEndDate ? (
                  <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} onBlur={() => setEditingEndDate(false)} autoFocus data-testid="availability-end-date-input" />
                ) : (
                  <>
                    <span>Ends <strong>{fmtDate(endDate, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</strong></span>
                    <button className="text-link" onClick={() => setEditingEndDate(true)} data-testid="availability-end-date-change-button">Change</button>
                  </>
                )}
              </div>
            )}
            <button className="button primary" onClick={save} data-testid="availability-save-button">Save</button>
            {existing && <button className="button secondary" onClick={remove} data-testid="availability-remove-button">Remove this time</button>}
          </div>
        )}
      </section>
      {confirmDelete && (
        <div className="center-overlay" data-testid="availability-remove-confirm-overlay">
          <section className="modal-panel stack" data-testid="availability-remove-confirm-modal">
            <div className="sheet-title-row">
              <h3>Remove this time?</h3>
              <button className="icon-button" onClick={() => setConfirmDelete(false)} data-testid="availability-remove-confirm-close"><X size={20} /></button>
            </div>
            <p className="muted">A family has proposed against this slot before. Removing it won't cancel any playdate already confirmed, but it will take back this open time.</p>
            <button className="button primary" onClick={doRemove} data-testid="availability-remove-confirm-button">Remove anyway</button>
            <button className="button secondary" onClick={() => setConfirmDelete(false)} data-testid="availability-remove-cancel-button">Keep it</button>
          </section>
        </div>
      )}
      {blockedDelete && (
        <div className="center-overlay" data-testid="availability-remove-blocked-overlay">
          <section className="modal-panel stack" data-testid="availability-remove-blocked-modal">
            <div className="sheet-title-row">
              <h3>There's an active proposal on this time</h3>
              <button className="icon-button" onClick={() => setBlockedDelete(false)} data-testid="availability-remove-blocked-close"><X size={20} /></button>
            </div>
            <p className="muted">A family has an open proposal on this time right now. Respond to it (accept, decline, or withdraw) before removing this time.</p>
            <button className="button secondary" onClick={() => setBlockedDelete(false)} data-testid="availability-remove-blocked-ok">Got it</button>
          </section>
        </div>
      )}
      {showShareSuggestion && (
        <ShareSuggestionModal
          members={members}
          onClose={() => { setShowShareSuggestion(false); onClose(); }}
        />
      )}
    </div>
  );
}

function ShareSuggestionModal({ members, onClose }) {
  // 4.5: shown once, right after a parent's first-ever availability save — this is
  // the direct fix for saving availability otherwise appearing to do nothing, since
  // nobody can see it without an active share. Suggests community members not yet
  // shared with, reusing the same request-to-share call as ParentProfileSheet/
  // FeedShareButton rather than a new mechanism.
  const suggestions = (members || []).filter((m) => m.share_status === "none");
  const [sentIds, setSentIds] = useState(() => new Set());

  const request = async (parentId) => {
    try {
      const result = await api("/availability-share-requests", { method: "POST", body: JSON.stringify({ target_parent_id: parentId }) });
      setSentIds((prev) => new Set(prev).add(parentId));
      toast.success(result.status === "approved" ? "You're now sharing availability 🎉" : "Request sent");
    } catch (error) { toast.error(error.message); }
  };

  return (
    <div className="center-overlay" data-testid="share-suggestion-overlay">
      <section className="modal-panel stack" data-testid="share-suggestion-modal">
        <div className="sheet-title-row">
          <h3>Availability saved — now let families see it</h3>
          <button className="icon-button" onClick={onClose} data-testid="share-suggestion-close"><X size={20} /></button>
        </div>
        {suggestions.length ? (
          <>
            <p className="muted">Nobody can see your open time until you share it. Request sharing with families from your communities:</p>
            <div className="stack" style={{ gap: 8 }} data-testid="share-suggestion-list">
              {suggestions.slice(0, 8).map((member) => (
                <div className="mini-card child-profile-card" key={member.user_id} data-testid={`share-suggestion-row-${member.user_id}`}>
                  <div className="row" style={{ gap: 10 }}>
                    <div className="avatar-circle" style={{ width: 36, height: 36 }}>{member.picture ? <img src={member.picture} alt="" /> : member.name?.[0]}</div>
                    <strong>{member.name}</strong>
                  </div>
                  {sentIds.has(member.user_id)
                    ? <span className="badge amber">Request sent</span>
                    : <button className="button small secondary" onClick={() => request(member.user_id)} data-testid={`share-suggestion-request-${member.user_id}`}>Request to share</button>}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">Join a community from the Community tab to find families to share with.</p>
        )}
        <button className="button primary" onClick={onClose} data-testid="share-suggestion-done">Done</button>
      </section>
    </div>
  );
}

function CalendarView({ dashboard, refresh, selectedDate, onSelectDate, activeChildId, activeChildName, onPastPlaydates }) {
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState("month");
  const availability = dashboard?.availability || [];
  const playdates = dashboard?.playdates || [];
  const childSlots = activeChildId ? availability.filter((slot) => !slot.child_ids?.length || slot.child_ids.includes(activeChildId)) : availability;
  const availabilityDates = new Set(childSlots.map((slot) => slot.date));
  const pendingDates = new Set(playdates.filter((p) => ["proposed", "countered", "reschedule_pending"].includes(p.status)).map((p) => p.date));
  const confirmedDates = new Set(playdates.filter((p) => ["confirmed", "rescheduled", "completed", "reschedule_pending"].includes(p.status)).map((p) => p.date));

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
            <button key={value} className={`day-cell ${inMonth ? "" : "muted-day"} ${today ? "today" : ""}`} onClick={() => onSelectDate(day)} data-testid={`calendar-day-${value}`}>
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
        <span className="row" style={{ gap: 6 }} data-testid="legend-available"><span className="dot sage" style={{ width: 10, height: 10 }} />{activeChildName ? `${activeChildName} is free` : "Your availability"}</span>
        <span className="row" style={{ gap: 6 }} data-testid="legend-pending"><span className="dot amber" style={{ width: 10, height: 10 }} />Pending proposal</span>
        <span className="row" style={{ gap: 6 }} data-testid="legend-confirmed"><span className="dot terra" style={{ width: 10, height: 10 }} />Confirmed playdate</span>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>Tap any date to set open time. Recurring slots pause on their own after four quiet weeks.</p>
      {onPastPlaydates && <button className="text-link" onClick={onPastPlaydates} data-testid="past-playdates-link">Past playdates ›</button>}
      {selectedDate && <DaySheet selectedDate={selectedDate} availability={availability} onClose={() => onSelectDate(null)} onSaved={refresh} children={dashboard.children} activeChildId={activeChildId} playdates={playdates} />}
    </section>
  );
}

function FeedShareButton({ parentId, initialStatus }) {
  // 4.4: same request-to-share entry point as ParentProfileSheet (Community member
  // list), surfaced here too so a parent can request sharing without leaving the
  // feed they're already browsing.
  const [status, setStatus] = useState(initialStatus || "none");
  const request = async () => {
    try {
      const result = await api("/availability-share-requests", { method: "POST", body: JSON.stringify({ target_parent_id: parentId }) });
      setStatus(result.status === "approved" ? "approved" : "pending_sent");
      toast.success(result.status === "approved" ? "You're now sharing availability 🎉" : "Request sent");
    } catch (error) { toast.error(error.message); }
  };
  if (status === "approved") return <span className="badge sage" data-testid={`feed-share-status-${parentId}`}>✓ Sharing</span>;
  if (status === "pending_sent") return <span className="badge amber" data-testid={`feed-share-status-${parentId}`}>Request sent</span>;
  if (status === "pending_received") return <span className="badge blue" data-testid={`feed-share-status-${parentId}`}>Respond from Home</span>;
  return <button className="button small secondary" onClick={request} data-testid={`feed-share-request-${parentId}`}>Request to share</button>;
}

function WhoFreeFeed({ activeChild, dashboard, onPropose }) {
  const navigate = useNavigate();
  const [feedData, setFeedData] = useState(null);
  const [filter, setFilter] = useState("When we're both free");
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    setFeedData(null);
    api("/community-feed").then(setFeedData).catch(() => setFeedData({ rows: [], matches: [] }));
  }, [dashboard]);

  if (feedData === null) {
    return (
      <div className="stack" data-testid="who-free-loading">
        {[0, 1, 2].map((i) => <div key={i} className="card" style={{ minHeight: 130, opacity: 0.5 }} data-testid={`who-free-skeleton-${i}`} />)}
      </div>
    );
  }

  const childRows = feedData.rows;

  if (!childRows.length) {
    const gradeCommunity = activeChild && dashboard?.communities?.find((c) => c.master_community_id && c.name.endsWith(activeChild.grade));
    // 5.5: distinguish a genuinely empty community (nobody else has joined) from one
    // where members exist but just haven't started sharing yet — these need different
    // next steps (invite others vs. request sharing), and looked identical before.
    const hasPeers = (feedData.peer_count || 0) > 0;
    return (
      <div className="card empty-state stack" data-testid="who-free-empty-state">
        {hasPeers ? (
          <>
            <h3 className="card-title" data-testid="who-free-empty-title">No one's sharing with {activeChild?.first_name || "your child"} yet</h3>
            <p className="muted">Families in {activeChild?.grade || "your child's grade"} are already there — nobody's shared their open time with you yet. Request sharing and their calendar shows up here.</p>
            <button
              className="button primary"
              onClick={() => navigate("/community", gradeCommunity ? { state: { communityId: gradeCommunity.community_id } } : undefined)}
              data-testid="who-free-empty-request-button"
            >
              Request sharing in {activeChild?.grade || "your grade"}
            </button>
          </>
        ) : (
          <>
            <h3 className="card-title" data-testid="who-free-empty-title">No one else in {activeChild?.grade || "your child's grade"} yet</h3>
            <p className="muted">Be the first to invite other families — once they join and share their open time, their calendar shows up here.</p>
            <button
              className="button primary"
              onClick={() => {
                if (gradeCommunity) {
                  navigate("/community", { state: { communityId: gradeCommunity.community_id } });
                } else {
                  toast.error("Join a grade community first from the Community tab");
                  navigate("/community");
                }
              }}
              data-testid="who-free-empty-find-button"
            >
              Find or join a community
            </button>
            {gradeCommunity?.join_slug && (
              <button
                className="text-link"
                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join/${gradeCommunity.join_slug}`); toast.success("Link copied"); }}
                data-testid="who-free-empty-invite-link"
              >
                Invite a family by link
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  const overlapIds = new Set((feedData.matches || []).map((m) => m.parent.user_id));
  const weekEnd = isoDate(new Date(Date.now() + 7 * 86400000));
  let filtered = childRows;
  if (filter === "When we're both free") filtered = childRows.filter((r) => overlapIds.has(r.family_id));
  else if (filter === "Free this week") filtered = childRows.filter((r) => r.date <= weekEnd);

  const families = [];
  const byFamilyId = new Map();
  for (const row of filtered) {
    if (!byFamilyId.has(row.family_id)) {
      const entry = { family_id: row.family_id, parent_name: row.parent_name, parent_picture: row.parent_picture, child_name: row.child_name, grade: row.grade, share_status: row.share_status, rows: [] };
      byFamilyId.set(row.family_id, entry);
      families.push(entry);
    }
    byFamilyId.get(row.family_id).rows.push(row);
  }

  return (
    <div className="stack" data-testid="who-free-feed">
      <div className="chip-row" data-testid="who-free-filters">
        {["When we're both free", "Free this week", "All families"].map((item) => (
          <button key={item} className={`filter-pill ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)} data-testid={`who-free-filter-${item.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{item}</button>
        ))}
      </div>
      {families.length ? (
        <>
          <p className="section-label" data-testid="who-free-count">{families.length} {families.length === 1 ? "family" : "families"} open to {activeChild?.first_name || "you"}</p>
          {families.map((family) => {
            const isExpanded = expanded.has(family.family_id);
            const visibleRows = isExpanded ? family.rows : family.rows.slice(0, 3);
            return (
              <div className="card" key={family.family_id} data-testid={`who-free-card-${family.family_id}`}>
                <div className="family-head">
                  <div className="row" style={{ gap: 10 }}>
                    <div className="avatar-circle" style={{ width: 46, height: 46 }}>
                      {family.parent_picture ? <img src={family.parent_picture} alt="" /> : family.child_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <strong>{family.child_name} · {family.grade}</strong>
                      <p className="muted">{family.parent_name}</p>
                    </div>
                  </div>
                  <FeedShareButton parentId={family.family_id} initialStatus={family.share_status} />
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  {visibleRows.map((row) => row.status === "held" ? (
                    <div className="slot-button held" key={row.slot_id} data-testid={`who-free-slot-held-${row.slot_id}`}>
                      <span>{fmtDate(row.date, { weekday: "short", month: "short", day: "numeric" })} · {row.slot_time?.map((b) => `${timeLabel(b.start)}–${timeLabel(b.end)}`).join(", ")}</span>
                      <span className="heldtag">Waiting on another family</span>
                    </div>
                  ) : (
                    <button className="slot-button" key={row.slot_id} onClick={() => onPropose(row)} data-testid={`who-free-slot-open-${row.slot_id}`}>
                      <span>{fmtDate(row.date, { weekday: "short", month: "short", day: "numeric" })} · {row.slot_time?.map((b) => `${timeLabel(b.start)}–${timeLabel(b.end)}`).join(", ")}</span>
                      <span className="arrow">Propose ›</span>
                    </button>
                  ))}
                </div>
                {family.rows.length > 3 && !isExpanded && (
                  <button className="text-link" onClick={() => setExpanded((prev) => new Set(prev).add(family.family_id))} data-testid={`who-free-see-all-${family.family_id}`}>
                    See all {family.rows.length} openings
                  </button>
                )}
              </div>
            );
          })}
          <p className="muted" style={{ fontSize: 12 }} data-testid="who-free-held-hint">Slots marked <strong>waiting</strong> already have a proposal pending. They free up again if that family declines.</p>
        </>
      ) : (
        <div className="empty-state card stack" data-testid="who-free-filter-empty">
          {/* 5.4: distinct from a generic filter miss — shares are active (childRows is
              non-empty here), it's specifically that nothing overlaps this week. */}
          {filter === "When we're both free" ? (
            <>
              <p data-testid="who-free-filter-empty-title">Nothing overlaps with your open time this week.</p>
              <p className="muted">Try "Free this week" to see all their openings, or widen your own availability to catch more overlap.</p>
            </>
          ) : filter === "Free this week" ? (
            <>
              <p data-testid="who-free-filter-empty-title">No openings from these families in the next 7 days.</p>
              <p className="muted">Check "All families" to see what's further out.</p>
            </>
          ) : (
            <p data-testid="who-free-filter-empty-title">No families match this filter yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function PastPlaydatesSheet({ dashboard, user, refresh, onClose }) {
  const past = (dashboard?.playdates || []).filter((p) => p.status === "completed");
  return (
    <div className="sheet-overlay" data-testid="past-playdates-overlay">
      <section className="bottom-sheet stack" data-testid="past-playdates-sheet">
        <div className="drag-handle" />
        <div className="sheet-title-row">
          <h3>Past playdates</h3>
          <button className="icon-button" onClick={onClose} data-testid="past-playdates-close-button"><X size={20} /></button>
        </div>
        {past.length ? past.map((playdate) => <PlaydateCard key={playdate.playdate_id} playdate={playdate} user={user} dashboard={dashboard} refresh={refresh} />) : <div className="empty-state" data-testid="past-playdates-empty">No completed playdates yet.</div>}
      </section>
    </div>
  );
}

function PlaydatesPage({ user, dashboard, refresh }) {
  const children = dashboard?.children || [];
  const [activeChildId, setActiveChildId] = useState(children[0]?.child_id || null);
  const [mode, setMode] = useState("free");
  const [proposal, setProposal] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    if (children.length && !children.some((c) => c.child_id === activeChildId)) setActiveChildId(children[0].child_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children.map((c) => c.child_id).join(",")]);

  const activeChild = children.find((c) => c.child_id === activeChildId) || null;

  return (
    <AppLayout title="Playdates" user={user}>
      <div className="stack stagger">
        {children.length > 1 && (
          <div className="chip-row" data-testid="playdates-child-chip-row">
            {children.map((child) => (
              <button key={child.child_id} className={`filter-pill ${activeChildId === child.child_id ? "active" : ""}`} onClick={() => setActiveChildId(child.child_id)} data-testid={`playdates-child-chip-${child.child_id}`}>
                {child.first_name}
              </button>
            ))}
          </div>
        )}
        <div className="view-toggle" style={{ gridTemplateColumns: "1fr 1fr" }} data-testid="playdates-mode-toggle">
          <button className={mode === "free" ? "active" : ""} onClick={() => setMode("free")} data-testid="playdates-mode-free-button">Who's free</button>
          <button className={mode === "mine" ? "active" : ""} onClick={() => setMode("mine")} data-testid="playdates-mode-mine-button">My time</button>
        </div>
        {mode === "free" ? (
          <WhoFreeFeed activeChild={activeChild} dashboard={dashboard} onPropose={setProposal} />
        ) : (
          <CalendarView
            dashboard={dashboard}
            refresh={refresh}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            activeChildId={activeChild?.child_id}
            activeChildName={activeChild?.first_name}
            onPastPlaydates={() => setShowPast(true)}
          />
        )}
      </div>
      {proposal && <ProposalModal row={proposal} dashboard={dashboard} refresh={refresh} onClose={() => setProposal(null)} />}
      {showPast && <PastPlaydatesSheet dashboard={dashboard} user={user} refresh={refresh} onClose={() => setShowPast(false)} />}
    </AppLayout>
  );
}

function ActivityCard({ note }) {
  const navigate = useNavigate();
  const Icon = note.kind === "playdate" ? Check : note.kind === "sponsor" ? Clock : Send;
  // 3.7: kinds "playdate"/"credits"/"chat" all carry reference_id = the playdate_id they're
  // about (see notify_parent call sites in server.py). "sponsor" notifications don't
  // reference a playdate, so they stay non-navigable rather than routing to nothing.
  const linksToPlaydate = !!note.reference_id && ["playdate", "credits", "chat"].includes(note.kind);
  const handleClick = () => {
    if (!linksToPlaydate) return;
    navigate("/home", { state: { highlightPlaydateId: note.reference_id } });
  };
  return (
    <div
      className="activity-card"
      onClick={linksToPlaydate ? handleClick : undefined}
      style={linksToPlaydate ? { cursor: "pointer" } : undefined}
      data-testid={`activity-card-${note.notification_id}`}
    >
      <span className={`activity-icon ${note.kind || "default"}`}><Icon size={16} /></span>
      <div><strong>{note.title}</strong><p>{note.body}</p><small>{fmtDate(note.created_at?.slice(0, 10) || isoDate(new Date()), { month: "short", day: "numeric" })}</small></div>
      {!note.read_at && <i />}
    </div>
  );
}

function ProposalModal({ row, match, dashboard, onClose, refresh }) {
  const [location, setLocation] = useState("Neighborhood park");
  const [activity, setActivity] = useState(ACTIVITIES[0]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [blockIdx, setBlockIdx] = useState(0);
  const selected = match
    ? { parentId: match.parent.user_id, parentName: match.parent.name, childName: match.children?.[0]?.first_name, childId: match.children?.[0]?.child_id, date: match.date, blocks: [{ start: match.start_time, end: match.end_time }] }
    : row
    ? { parentId: row.family_id, parentName: row.parent_name, childName: row.child_name, childId: row.child_id, date: row.date, blocks: row.slot_time, slotId: row.slot_id }
    : null;
  const chosenBlock = selected?.blocks?.[blockIdx] || selected?.blocks?.[0];
  const [customStart, setCustomStart] = useState(chosenBlock?.start);
  const [customEnd, setCustomEnd] = useState(chosenBlock?.end);
  useEffect(() => {
    if (chosenBlock) { setCustomStart(chosenBlock.start); setCustomEnd(chosenBlock.end); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockIdx, selected?.date, selected?.parentId]);
  const blockTimeOptions = chosenBlock
    ? timeOptions.filter((t) => minutes(t) >= minutes(chosenBlock.start) && minutes(t) <= minutes(chosenBlock.end))
    : [];
  useEffect(() => {
    if (customStart && customEnd && minutes(customEnd) <= minutes(customStart)) {
      const next = blockTimeOptions.find((t) => minutes(t) > minutes(customStart));
      if (next) setCustomEnd(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customStart]);
  const ownChild = dashboard?.children?.find((c) => c.child_id === (row?.child_id)) || dashboard?.children?.[0];
  const today = isoDate(new Date());
  const hasOwnOpenSlot = (dashboard?.availability || []).some((s) => !s.is_paused && s.date >= today && (!s.child_ids?.length || s.child_ids.includes(ownChild?.child_id)));

  const submit = async () => {
    // sendingRef is checked/set synchronously so two click events fired before
    // React re-renders (e.g. a fast double-click) can't both slip past this guard
    // the way the `sending` state alone could.
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const response = await api("/playdates", {
        method: "POST",
        body: JSON.stringify({
          invitee_parent_id: selected.parentId,
          child_ids: ownChild ? [ownChild.child_id] : [],
          date: selected.date,
          start_time: customStart,
          end_time: customEnd,
          location,
          activity,
          notes: "",
          title: `${ownChild?.first_name || "PlayPal"} + ${selected.childName || "friend"}`,
          slot_id: selected.slotId || null,
        }),
      });
      toast.success("Proposal sent");
      // 3.5: cross-child overlap is a warning, not a blocker — proposal already went
      // through, this just flags it in addition to the success toast.
      if (response?.warning) toast(response.warning);
      await refresh();
      onClose();
    } catch (error) {
      toast.error(error.message);
      sendingRef.current = false;
      setSending(false);
    }
  };

  if (!selected) return null;
  return (
    <div className="center-overlay" data-testid="proposal-modal-overlay">
      <section className="modal-panel stack" data-testid="proposal-modal">
        <div className="sheet-title-row"><h3 data-testid="proposal-title">Propose to {selected.parentName}</h3><button className="icon-button" onClick={onClose} data-testid="proposal-close-button"><X size={20} /></button></div>
        <div className="mini-card stack" data-testid="proposal-readout">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Date</span>
            <strong data-testid="proposal-time">{fmtDate(selected.date, { weekday: "long", month: "short", day: "numeric" })}</strong>
          </div>
          {selected.blocks?.length > 1 && (
            <div className="chip-row" data-testid="proposal-block-picker">
              {selected.blocks.map((b, i) => (
                <button
                  key={i}
                  className={`chip ${i === blockIdx ? "active" : ""}`}
                  onClick={() => setBlockIdx(i)}
                  data-testid={`proposal-block-${i}`}
                >
                  {timeLabel(b.start)}–{timeLabel(b.end)}
                </button>
              ))}
            </div>
          )}
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted">Time</span>
            <div className="row" style={{ gap: 8 }}>
              <select className="select" value={customStart} onChange={(e) => setCustomStart(e.target.value)} data-testid="proposal-start-select">
                {blockTimeOptions.slice(0, -1).map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}
              </select>
              <span className="muted">–</span>
              <select className="select" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} data-testid="proposal-end-select">
                {blockTimeOptions.filter((t) => minutes(t) > minutes(customStart)).map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}
              </select>
            </div>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Children</span>
            <strong data-testid="proposal-children">{ownChild?.first_name || "Your child"} + {selected.childName || selected.parentName}</strong>
          </div>
        </div>
        <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" data-testid="proposal-location-input" />
        <div className="stack" data-testid="proposal-activity-section">
          <h4 className="section-label">ACTIVITY</h4>
          <div className="chip-row">{ACTIVITIES.map((a) => <button key={a} className={`chip ${activity === a ? "active" : ""}`} onClick={() => setActivity(a)} data-testid={`proposal-activity-${a.toLowerCase().replace(/\s+/g, "-")}`}>{a}</button>)}</div>
        </div>
        {!hasOwnOpenSlot && (
          <div className="nudge-line" data-testid="proposal-nudge">
            <span>🗓️</span>
            <div><strong>{selected.parentName} can't reach you back yet.</strong> Add {ownChild?.first_name || "your child"}'s open time so families can propose to you too.</div>
          </div>
        )}
        <button className="button primary" onClick={submit} disabled={sending} data-testid="proposal-send-button"><Send size={18} /> {sending ? "Sending…" : "Send proposal"}</button>
      </section>
    </div>
  );
}

function CommunityPage({ user, dashboard, refresh }) {
  const [communities, setCommunities] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [drill, setDrill] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
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
  useEffect(() => { if (location.state?.communityId) setDrill({ communityId: location.state.communityId }); }, [location.state]);
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const results = await api(`/communities/search?q=${encodeURIComponent(q)}`);
        setSearchResults(results);
      } catch (error) { toast.error(error.message); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const myCommunities = communities.filter((community) => community.membership);
  const myMasters = myCommunities.filter((community) => !community.master_community_id);
  const myMasterIds = new Set(myMasters.map((community) => community.community_id));
  const subsOf = (masterId) => myCommunities.filter((community) => community.master_community_id === masterId);
  // A sub-community whose master isn't in myCommunities (only possible for grade
  // memberships that predate the silent master-membership backfill) has nothing
  // to nest under — fall back to showing it flat rather than dropping it.
  const orphanSubs = myCommunities.filter((community) => community.master_community_id && !myMasterIds.has(community.master_community_id));
  const refreshAll = async () => { await refresh(); await load(); };

  return (
    <AppLayout title="Community" user={user}>
      <div className="stack stagger">
        <section className="stack" data-testid="my-communities-section">
          <div className="section-row"><h2 className="section-label" data-testid="my-communities-title">MY COMMUNITIES</h2><button className="icon-button" onClick={() => setShowCreate(true)} data-testid="create-community-open-button"><Plus size={18} /></button></div>
          {myMasters.map((community) => (
            <div className="stack" style={{ gap: 6 }} key={community.community_id} data-testid={`my-community-group-${community.community_id}`}>
              <MyCommunityCard community={community} onOpen={() => setDrill({ communityId: community.community_id })} refreshAll={refreshAll} />
              {subsOf(community.community_id).length > 0 && (
                <div className="stack" style={{ gap: 6, marginLeft: 20 }} data-testid={`my-community-subs-${community.community_id}`}>
                  {subsOf(community.community_id).map((sub) => <MyCommunitySubRow key={sub.community_id} community={sub} onOpen={() => setDrill({ communityId: sub.community_id })} />)}
                </div>
              )}
            </div>
          ))}
          {orphanSubs.map((community) => <MyCommunityCard key={community.community_id} community={community} onOpen={() => setDrill({ communityId: community.community_id })} refreshAll={refreshAll} />)}
          {!myCommunities.length && <div className="empty-state card">No communities joined yet.</div>}
        </section>
        <section className="stack" data-testid="discover-communities-section">
          <h2 className="section-label" data-testid="discover-title">FIND YOUR GROUPS</h2>
          <div className="search-bar">
            <Search size={18} />
            <input
              placeholder="Search by grade, class, or group"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="community-search-input"
            />
          </div>
          {searchQuery.trim().length < 2 && <div className="empty-state card">Type to search grades and groups in your schools.</div>}
          {searchResults.map((community) => <CommunityDirectoryCard key={community.community_id} community={community} onOpen={() => setDrill({ communityId: community.community_id })} />)}
        </section>
      </div>
      {showCreate && <CreateCommunityModal onClose={() => setShowCreate(false)} refreshAll={async () => { await refresh(); await load(); }} />}
      {drill && <CommunityDrillDown {...drill} dashboard={dashboard} refresh={refresh} user={user} onClose={() => { setDrill(null); load(); }} />}
    </AppLayout>
  );
}

function MyCommunityCard({ community, onOpen, refreshAll }) {
  const [stepBack, setStepBack] = useState(false);
  return <div className="community-card" data-testid={`my-community-${community.community_id}`} onClick={onOpen}><div className="family-head"><div className="row" style={{ gap: 10 }}><div className="community-icon"><MapPin size={18} /></div><div><strong>{community.name}</strong><p className="muted">{community.city} · {community.member_count} members</p></div></div><span className={`badge ${community.membership?.status === "active" ? "sage" : "amber"}`}>{community.membership?.status}</span></div><button className="text-link" onClick={(e) => { e.stopPropagation(); setStepBack(true); }} data-testid={`step-back-${community.community_id}`}>Step back from this community</button>{stepBack && <StepBackSheet community={community} onClose={() => setStepBack(false)} refreshAll={refreshAll} />}</div>;
}

function MyCommunitySubRow({ community, onOpen }) {
  return (
    <div className="mini-card family-head" onClick={onOpen} data-testid={`my-community-sub-${community.community_id}`}>
      <div className="row" style={{ gap: 8 }}>
        <div className="community-icon" style={{ width: 32, height: 32 }}><MapPin size={14} /></div>
        <div><strong>{community.name}</strong><p className="muted">{community.member_count} members</p></div>
      </div>
      <span className={`badge ${community.membership?.status === "active" ? "sage" : "amber"}`}>{community.membership?.status}</span>
    </div>
  );
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

function CommunityDrillDown({ communityId, proposalMatch, dashboard, refresh, onClose, user }) {
  const [activeId, setActiveId] = useState(communityId);
  const [history, setHistory] = useState([]);
  const [detail, setDetail] = useState(null);
  const [proposal, setProposal] = useState(proposalMatch ? { match: proposalMatch } : null);
  const [copiedId, setCopiedId] = useState(null);
  const [addingGrade, setAddingGrade] = useState(false);
  const [newGradeName, setNewGradeName] = useState("");
  useEffect(() => { setActiveId(communityId); setHistory([]); }, [communityId]);
  const load = useCallback(async () => {
    if (!activeId && proposalMatch) return;
    try { setDetail(await api(`/communities/${activeId}`)); } catch (error) { toast.error(error.message); }
  }, [activeId, proposalMatch]);
  useEffect(() => { load(); }, [load]);
  const loading = !detail && !proposalMatch;
  const community = detail?.community || proposalMatch?.parent || {};
  const viewGrade = (gradeId) => {
    setHistory((prev) => [...prev, activeId]);
    setActiveId(gradeId);
  };
  const goBack = () => {
    if (history.length) {
      setActiveId(history[history.length - 1]);
      setHistory((prev) => prev.slice(0, -1));
    } else {
      onClose();
    }
  };
  const join = async (id) => {
    try {
      const result = await api("/communities/join", { method: "POST", body: JSON.stringify({ community_id: id }) });
      toast.success(result.already_member ? "You're already a member" : "Joined!");
      await load();
      await refresh();
    } catch (error) { toast.error(error.message); }
  };
  const copyLink = (id, slug) => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${slug}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const addGrade = async () => {
    if (!newGradeName.trim()) return;
    try {
      const response = await api(`/communities/${activeId}/add-sub`, { method: "POST", body: JSON.stringify({ name: newGradeName.trim() }) });
      toast.success(response.community?.status === "pending_approval" ? "Request sent — you'll be notified when it's approved" : `${newGradeName.trim()} added`);
      setAddingGrade(false);
      setNewGradeName("");
      await load();
    } catch (error) { toast.error(error.message); }
  };
  return (
    <div className="slide-screen" data-testid="community-drill-screen">
      <header className="top-header">
        <button className="icon-button" onClick={goBack} data-testid="drill-back-button"><ChevronLeft size={20} /></button>
        <div className="screen-title">{loading ? "Loading…" : community.name || "Community"}</div>
        <div />
      </header>
      <main className="main-content stack">
        <section className="card stack">
          <div className="row" style={{ gap: 12 }}>
            <div className="community-icon big"><MapPin size={20} /></div>
            <div><h1 className="section-title">{loading ? "Loading…" : community.name}</h1><p className="muted">{loading ? "" : `${community.city || ""} · ${community.member_count || 0} members`}</p></div>
          </div>
          {detail?.membership ? <span className="badge sage">Active</span> : activeId && <button className="button primary" onClick={() => join(activeId)} data-testid="request-to-join-button">Join</button>}
          {user?.is_admin && community.join_slug && (
            <button className="button small secondary" onClick={() => copyLink(community.community_id, community.join_slug)} data-testid="copy-community-link-button">
              {copiedId === community.community_id ? <><Check size={15} /> Copied</> : "Copy join link"}
            </button>
          )}
        </section>
        {detail?.grades && !community.master_community_id && (
          <section className="stack">
            <h2 className="section-label">GRADE COMMUNITIES</h2>
            {detail.grades.map((grade) => (
              <button
                className="mini-card family-head"
                key={grade.community_id}
                onClick={() => viewGrade(grade.community_id)}
                data-testid={`grade-row-${grade.community_id}`}
                style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
              >
                <div><strong>{grade.name}</strong><p className="muted">{grade.member_count} members</p></div>
                <div className="row" style={{ gap: 8 }}>
                  {grade.membership ? <span className="badge sage">Active</span> : <button className="button small secondary" onClick={(e) => { e.stopPropagation(); join(grade.community_id); }}>Join</button>}
                  {user?.is_admin && grade.join_slug && <button className="button small secondary" onClick={(e) => { e.stopPropagation(); copyLink(grade.community_id, grade.join_slug); }}>{copiedId === grade.community_id ? <><Check size={15} /> Copied</> : "Copy link"}</button>}
                </div>
              </button>
            ))}
            {(user?.is_admin || detail?.membership?.status === "active") && (
              addingGrade ? (
                <div className="mini-card family-head" data-testid="add-grade-form">
                  <input className="input" value={newGradeName} onChange={(e) => setNewGradeName(e.target.value)} placeholder="e.g. PK-3, Soccer Team, Dunbar Group" data-testid="add-grade-input" />
                  <div className="row" style={{ gap: 8 }}>
                    <button className="button small primary" onClick={addGrade} disabled={!newGradeName.trim()} data-testid="add-grade-save-button">{user?.is_admin ? "Add" : "Request"}</button>
                    <button className="button small secondary" onClick={() => { setAddingGrade(false); setNewGradeName(""); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="button small secondary" onClick={() => setAddingGrade(true)} data-testid="add-grade-button">+ {user?.is_admin ? "Add" : "Request"} grade or group</button>
              )
            )}
          </section>
        )}
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
  const [status, setStatus] = useState(parent.share_status || "none");
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const child = firstChild(parent.children);

  const request = async () => {
    try {
      const result = await api("/availability-share-requests", { method: "POST", body: JSON.stringify({ target_parent_id: parent.user_id }) });
      setStatus(result.status === "approved" ? "approved" : "pending_sent");
      toast.success(result.status === "approved" ? `✓ You're now sharing availability with ${parent.name} 🎉` : "Request sent");
    } catch (error) { toast.error(error.message); }
  };

  // P0-1: this is the app's one existing "parent profile" surface (reached from the
  // Community member list via ParentRow) — Who's Free feed cards have no equivalent
  // profile view, just inline actions, so that's not a second entry point here.
  // Silent on the backend (no notification to the blocked party) per the same
  // reasoning as the Phase 4 revoke decision; the two-step confirm here is purely a
  // local guard against an accidental tap, not anything the other party sees either.
  const block = async () => {
    try {
      await api("/parent-blocks", { method: "POST", body: JSON.stringify({ target_parent_id: parent.user_id }) });
      setBlocked(true);
    } catch (error) { toast.error(error.message); }
  };

  if (blocked) {
    return (
      <div className="sheet-overlay" data-testid="parent-profile-sheet">
        <section className="bottom-sheet centered-sheet">
          <div className="drag-handle" />
          <button className="icon-button sheet-close" onClick={onClose} data-testid="parent-profile-blocked-close"><X size={18} /></button>
          <h2>Blocked</h2>
          <p className="muted">You won't see {parent.name}'s availability anymore, and they can't propose playdates to you.</p>
          <button className="button secondary" onClick={onClose} data-testid="parent-profile-blocked-done">Done</button>
        </section>
      </div>
    );
  }

  return (
    <div className="sheet-overlay" data-testid="parent-profile-sheet">
      <section className="bottom-sheet centered-sheet">
        <div className="drag-handle" />
        <button className="icon-button sheet-close" onClick={onClose} data-testid="parent-profile-close"><X size={18} /></button>
        <div className="avatar-circle" style={{ width: 56, height: 56, margin: "0 auto" }}>{parent.name?.[0]}</div>
        <h2>{parent.name}</h2>
        <p className="muted">{child.first_name} · age {child.age}</p>
        <span className="badge sage">{tierText(parent)}</span>
        <div className="chip-row centered">{(child.interests || []).map((interest) => <span className="interest-pill" key={interest}>{interest}</span>)}</div>
        <hr />
        {status === "approved" ? <span className="badge sage">✓ Sharing availability</span>
          : status === "pending_sent" ? <span className="badge amber">Request sent — waiting for response</span>
          : status === "pending_received" ? <span className="badge blue">They asked to share with you — respond from Home</span>
          : <button className="button secondary" onClick={request} data-testid="parent-profile-share-request">Request to share availability</button>}
        <hr />
        {confirmingBlock ? (
          <div className="stack" data-testid="parent-profile-block-confirm">
            <p className="muted">Block {parent.name}? You won't see their availability, and they can't propose to you. They won't be told.</p>
            <button className="button secondary" onClick={block} data-testid="parent-profile-block-confirm-button">Yes, block</button>
            <button className="button ghost" onClick={() => setConfirmingBlock(false)} data-testid="parent-profile-block-cancel">Never mind</button>
          </div>
        ) : (
          <button className="text-link" onClick={() => setConfirmingBlock(true)} data-testid="parent-profile-block-open">Block this family</button>
        )}
        <a href="mailto:priti@ondek.co?subject=Safety%20concern" className="text-link" data-testid="parent-profile-contact-us">Safety concern? Contact us</a>
      </section>
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
      const response = await api("/communities", { method: "POST", body: JSON.stringify({ name, city, type: track, connection: "parent", scope }) });
      if (response.community?.status === "pending_approval") {
        toast.success("Request sent — you'll be notified when it's approved");
      } else {
        toast.success("Community created");
      }
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

function JoinViaLinkScreen({ user, refresh }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [community, setCommunity] = useState(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [members, setMembers] = useState([]);
  const [sponsorQuery, setSponsorQuery] = useState("");
  const [taggedId, setTaggedId] = useState(null);
  const [grades, setGrades] = useState([]);
  const [joinedGradeIds, setJoinedGradeIds] = useState([]);

  useEffect(() => {
    let active = true;
    setCommunity(null);
    setError("");
    api(`/communities/by-slug/${slug}`)
      .then((data) => { if (active) setCommunity(data.community); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [slug]);

  const join = async () => {
    setJoining(true);
    try {
      await api("/communities/join", { method: "POST", body: JSON.stringify({ community_id: community.community_id, via_link: true }) });
      toast.success(`Joined ${community.name}`);
      await refresh();
      const detail = await api(`/communities/${community.community_id}`);
      setMembers(detail.members || []);
      setGrades(detail.grades || []);
      setJoined(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setJoining(false);
    }
  };

  const tagSponsor = async (memberId) => {
    try {
      await api(`/communities/${community.community_id}/tag-sponsor`, { method: "POST", body: JSON.stringify({ sponsor_id: memberId }) });
      setTaggedId(memberId);
      toast.success("Thanks for letting them know!");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const joinGrade = async (gradeId) => {
    try {
      await api("/communities/join", { method: "POST", body: JSON.stringify({ community_id: gradeId }) });
      setJoinedGradeIds((prev) => [...prev, gradeId]);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const finish = () => navigate("/home", { replace: true });

  const filteredMembers = sponsorQuery.trim()
    ? members.filter((m) => m.user_id !== user.user_id && m.name?.toLowerCase().includes(sponsorQuery.trim().toLowerCase()))
    : [];

  return (
    <div className="slide-screen" data-testid="join-link-screen">
      <Header title="Join community" user={user} />
      <main className="main-content stack">
        {error ? (
          <div className="empty-state card" data-testid="join-link-error">{error}</div>
        ) : !community ? (
          <div className="stack" style={{ alignItems: "center" }}>
            <div className="spinner" data-testid="join-link-spinner" />
            <p className="muted">Looking up your invite…</p>
          </div>
        ) : joined ? (
          <section className="card stack" data-testid="join-link-sponsor-card">
            <h1 className="section-title">You're in! 🎉</h1>
            <p className="muted">Know someone in {community.name}? (optional)</p>
            <input
              className="input"
              type="text"
              placeholder="Search by name"
              value={sponsorQuery}
              onChange={(e) => setSponsorQuery(e.target.value)}
              data-testid="join-link-sponsor-search"
            />
            {filteredMembers.length > 0 && (
              <div className="stack" data-testid="join-link-sponsor-results">
                {filteredMembers.map((m) => (
                  <button
                    key={m.user_id}
                    className="button secondary"
                    onClick={() => tagSponsor(m.user_id)}
                    disabled={taggedId === m.user_id}
                    data-testid={`join-link-sponsor-option-${m.user_id}`}
                  >
                    {taggedId === m.user_id ? `✓ ${m.name}` : m.name}
                  </button>
                ))}
              </div>
            )}
            {community.type === "school" && grades.length > 0 && (
              <div className="stack" data-testid="join-link-grades">
                <p className="muted">Also join a grade?</p>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {grades.map((g) => {
                    const isJoined = joinedGradeIds.includes(g.community_id);
                    return (
                      <button
                        key={g.community_id}
                        className="button secondary"
                        onClick={() => joinGrade(g.community_id)}
                        disabled={isJoined}
                        data-testid={`join-link-grade-option-${g.community_id}`}
                      >
                        {isJoined ? `✓ ${g.name}` : g.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <button className="button primary" onClick={finish} data-testid="join-link-continue-button">
              Continue
            </button>
          </section>
        ) : (
          <section className="card stack" data-testid="join-link-card">
            <div className="row" style={{ gap: 12 }}>
              <div className="community-icon big"><MapPin size={20} /></div>
              <div>
                <h1 className="section-title" data-testid="join-link-name">{community.name}</h1>
                <p className="muted">{[community.city, community.member_count ? `${community.member_count} members` : null].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <button className="button primary" onClick={join} disabled={joining} data-testid="join-link-submit-button">
              {joining ? "Joining…" : `Join ${community.name}`}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

function PlaydateCard({ playdate, user, dashboard, refresh }) {
  const [showChat, setShowChat] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const isSender = playdate.organizer_id === user.user_id;
  const sentCounter = playdate.counter?.from_parent_id === user.user_id;
  const accepted = playdate.participants?.filter((p) => p.rsvp_status === "accepted") || [];
  // 5.2: withdraw only works for the organizer (backend restricts it to organizer_id)
  // and only on proposed/countered — reschedule_pending is a modification request on
  // an already-confirmed playdate, so "Cancel" (the real cancel endpoint) is the
  // semantically correct action there, not "Withdraw" (which the backend wouldn't
  // even accept for that status). "Waiting" here means: this is the sender's own
  // pre-response state, shown alongside the sent-time.
  const isWaitingSender = isSender && (playdate.status === "proposed" || (playdate.status === "countered" && sentCounter));
  const cancelledByName = playdate.status === "cancelled" && playdate.cancelled_by
    ? playdate.participants?.find((p) => p.parent_id === playdate.cancelled_by)?.parent?.name
    : null;
  const respond = async (action) => {
    try {
      const response = await api(`/playdates/${playdate.playdate_id}/respond`, { method: "POST", body: JSON.stringify({ action }) });
      toast.success(action === "accept" ? "Playdate confirmed" : "Response sent");
      // 3.5: cross-child overlap warning on accept — non-blocking, alongside the success toast.
      if (response?.warning) toast(response.warning);
      await refresh();
    } catch (error) { toast.error(error.message); }
  };
  // Chat opens as soon as a proposal exists, for sender and receiver alike — not
  // only after Accept. Proposals often need a quick clarifying exchange before
  // either side responds, so gating chat behind Accept (per the original PRD)
  // was blocking that. Scoped to slot-based 1:1 proposals only: auto-match nudges
  // (a suggested overlap that hasn't been turned into a proposal yet) are a
  // different surface and may need stricter chat gating — don't reuse this flag
  // for those without reconsidering. "countered" stays in here too — a
  // counter-proposal is still an active negotiation, not a step back from chat.
  const chatAvailable = ["proposed", "confirmed", "rescheduled", "countered", "reschedule_pending"].includes(playdate.status);
  const statusStyle = playdate.status === "cancelled" ? "cancelled" : ["confirmed", "rescheduled", "completed"].includes(playdate.status) ? "confirmed" : "proposed";
  const showingCounter = ["countered", "reschedule_pending"].includes(playdate.status) && playdate.counter;
  const displayDate = showingCounter ? playdate.counter.date : playdate.date;
  const displayStart = showingCounter ? playdate.counter.start_time : playdate.start_time;
  const displayEnd = showingCounter ? playdate.counter.end_time : playdate.end_time;
  return (
    <article className="card stack" data-testid={`playdate-card-${playdate.playdate_id}`}>
      <div className="family-head">
        <div>
          <span className={`playdate-status ${statusStyle}`} data-testid={`playdate-status-${playdate.playdate_id}`}>{playdate.status}</span>
          <h3 className="card-title" data-testid={`playdate-title-${playdate.playdate_id}`}>{playdate.title}</h3>
        </div>
        <span className="badge blue" data-testid={`playdate-type-${playdate.playdate_id}`}>{playdate.type}</span>
      </div>
      {showingCounter && <p className="hint-line" data-testid={`playdate-counter-hint-${playdate.playdate_id}`}>↳ New time suggested</p>}
      <p className="muted" data-testid={`playdate-detail-${playdate.playdate_id}`}><CalendarDays size={15} /> {fmtDate(displayDate, { weekday: "long", month: "short", day: "numeric" })} · {timeLabel(displayStart)}–{timeLabel(displayEnd)}</p>
      <p className="muted" data-testid={`playdate-location-${playdate.playdate_id}`}><MapPin size={15} /> {playdate.location} · {playdate.activity}</p>
      {/* 5.2: sent-time on the sender's own pre-response (waiting) state */}
      {isWaitingSender && playdate.created_at && (
        <p className="muted" data-testid={`playdate-sent-${playdate.playdate_id}`}>Sent {fmtDate(playdate.created_at.slice(0, 10), { month: "short", day: "numeric" })}</p>
      )}
      {/* 5.3: cancellation_reason/cancelled_by were already stored server-side but
          never rendered anywhere — cancelled_by's name is resolved from the
          already-fetched participants array, no new backend field needed. */}
      {playdate.status === "cancelled" && (
        <p className="muted" data-testid={`playdate-cancellation-${playdate.playdate_id}`}>
          Cancelled{cancelledByName ? ` by ${cancelledByName}` : ""}{playdate.cancellation_reason ? `: ${playdate.cancellation_reason}` : ""}
        </p>
      )}
      <div className="chip-row" data-testid={`playdate-participants-${playdate.playdate_id}`}>{accepted.map((p) => <span className="pill" key={p.parent_id}>{p.parent?.name?.split(" ")[0] || "Parent"}</span>)}</div>
      <div className="playdate-actions">
        {playdate.status === "proposed" && !isSender && (
          <>
            <button className="button primary" onClick={() => respond("accept")} data-testid={`playdate-accept-${playdate.playdate_id}`}><Check size={16} /> Accept</button>
            {/* 5.1: Counter promoted to a top-level button, no longer nested inside
                Decline — applies here and to the countered/reschedule_pending receiver
                case below too, since both share the exact same pattern. */}
            <button className="button secondary" onClick={() => setShowCounter(true)} data-testid={`playdate-counter-${playdate.playdate_id}`}>Suggest a time</button>
            <button className="button secondary" onClick={() => setShowDecline(true)} data-testid={`playdate-decline-${playdate.playdate_id}`}>Decline</button>
          </>
        )}
        {playdate.status === "proposed" && isSender && (
          <button className="button secondary" onClick={() => respond("withdraw")} data-testid={`playdate-withdraw-${playdate.playdate_id}`}>Withdraw</button>
        )}
        {["countered", "reschedule_pending"].includes(playdate.status) && !sentCounter && (
          <>
            <button className="button primary" onClick={() => respond("accept")} data-testid={`playdate-accept-${playdate.playdate_id}`}><Check size={16} /> Accept</button>
            <button className="button secondary" onClick={() => setShowCounter(true)} data-testid={`playdate-counter-${playdate.playdate_id}`}>Suggest a time</button>
            <button className="button secondary" onClick={() => setShowDecline(true)} data-testid={`playdate-decline-${playdate.playdate_id}`}>Decline</button>
          </>
        )}
        {/* 5.2: countered + sent-by-organizer is a pre-response "waiting" state on a
            never-yet-confirmed negotiation, so Withdraw (backend allows it for
            organizer + countered) is correct — not Cancel, which implies undoing a
            real booking. reschedule_pending is that real case (a modification request
            on an already-confirmed playdate), so it keeps Cancel; same for a
            non-organizer's countered wait, since withdraw is organizer-only server-side. */}
        {playdate.status === "countered" && sentCounter && isSender && (
          <button className="button secondary" onClick={() => respond("withdraw")} data-testid={`playdate-withdraw-${playdate.playdate_id}`}>Withdraw</button>
        )}
        {((playdate.status === "countered" && sentCounter && !isSender) || (playdate.status === "reschedule_pending" && sentCounter)) && (
          <button className="button secondary" onClick={() => setShowCancel(true)} data-testid={`playdate-cancel-${playdate.playdate_id}`}>Cancel</button>
        )}
        {chatAvailable && <button className="button blue-outline" onClick={() => setShowChat(true)} data-testid={`playdate-chat-${playdate.playdate_id}`}><MessageCircle size={16} /> Chat</button>}
        {["confirmed", "rescheduled"].includes(playdate.status) && (
          <>
            <button className="button secondary" onClick={() => setShowReschedule(true)} data-testid={`playdate-reschedule-${playdate.playdate_id}`}>Reschedule</button>
            <button className="button secondary" onClick={() => setShowCancel(true)} data-testid={`playdate-cancel-${playdate.playdate_id}`}>Cancel</button>
            <button className="button primary" onClick={() => setShowComplete(true)} data-testid={`playdate-complete-open-${playdate.playdate_id}`}>Complete</button>
          </>
        )}
      </div>
      {showCounter && <CounterModal playdate={playdate} dashboard={dashboard} refresh={refresh} onClose={() => setShowCounter(false)} />}
      {showChat && <ChatModal playdate={playdate} user={user} onClose={() => setShowChat(false)} />}
      {showReschedule && <RescheduleModal playdate={playdate} dashboard={dashboard} refresh={refresh} onClose={() => setShowReschedule(false)} />}
      {showComplete && <CompletionModal playdate={playdate} refresh={refresh} onClose={() => setShowComplete(false)} />}
      {showCancel && <CancelModal playdate={playdate} refresh={refresh} onClose={() => setShowCancel(false)} />}
      {showDecline && <DeclineOrSuggestModal playdate={playdate} refresh={refresh} onClose={() => setShowDecline(false)} />}
    </article>
  );
}

function RescheduleModal({ playdate, dashboard, refresh, onClose }) {
  const today = isoDate(new Date());
  const upcomingSlots = (dashboard?.availability || []).filter((slot) => slot.date >= today);
  const submit = async (rescheduleDate, rescheduleStart, rescheduleEnd) => {
    try {
      await api(`/playdates/${playdate.playdate_id}/reschedule`, { method: "POST", body: JSON.stringify({ date: rescheduleDate, start_time: rescheduleStart, end_time: rescheduleEnd }) });
      toast.success("Reschedule request sent");
      await refresh();
      onClose();
    } catch (error) { toast.error(error.message); }
  };
  return (
    <div className="center-overlay" data-testid="reschedule-modal-overlay">
      <section className="modal-panel stack" data-testid="reschedule-modal">
        <div className="sheet-title-row"><h3 data-testid="reschedule-title">Reschedule</h3><button className="icon-button" onClick={onClose} data-testid="reschedule-close-button"><X size={20} /></button></div>
        {upcomingSlots.length ? (
          <div className="stack" data-testid="reschedule-slots">
            <h4 className="section-label">FROM YOUR AVAILABILITY</h4>
            {upcomingSlots.slice(0, 8).flatMap((slot) => (slot.blocks || []).map((block, i) => (
              <button
                key={`${slot.date}-${i}`}
                className="slot-pill"
                onClick={() => submit(slot.date, block.start, block.end)}
                data-testid={`reschedule-slot-${slot.date}-${i}`}
              >
                {fmtDate(slot.date, { weekday: "short", month: "short", day: "numeric" })} · {timeLabel(block.start)}–{timeLabel(block.end)}
              </button>
            )))}
          </div>
        ) : (
          <p className="muted" data-testid="reschedule-no-availability">You don't have any open time set yet — add availability first so you can suggest a real time your kid is actually free.</p>
        )}
      </section>
    </div>
  );
}

function CounterModal({ playdate, dashboard, refresh, onClose }) {
  // 5.1: extracted from what used to be DeclineOrSuggestModal's bundled
  // suggest-a-time section — now reachable directly from a top-level "Suggest a
  // time" button, not nested behind Decline.
  const organizer = playdate.participants?.find((p) => p.parent_id === playdate.organizer_id)?.parent;
  const [date, setDate] = useState(playdate.date);
  const [start, setStart] = useState(playdate.start_time);
  const [end, setEnd] = useState(playdate.end_time);
  const today = isoDate(new Date());
  const upcomingSlots = (dashboard?.availability || []).filter((slot) => slot.date >= today);

  const sendCounter = async (counterDate, counterStart, counterEnd) => {
    try {
      await api(`/playdates/${playdate.playdate_id}/respond`, { method: "POST", body: JSON.stringify({ action: "counter", counter_date: counterDate, counter_start_time: counterStart, counter_end_time: counterEnd }) });
      toast.success("Suggested a new time");
      await refresh();
      onClose();
    } catch (error) { toast.error(error.message); }
  };

  return (
    <div className="center-overlay" data-testid="counter-modal-overlay">
      <section className="modal-panel stack" data-testid="counter-modal">
        <div className="sheet-title-row"><h3 data-testid="counter-title">Suggest a different time</h3><button className="icon-button" onClick={onClose} data-testid="counter-close-button"><X size={20} /></button></div>
        <p className="muted">Propose a new time to {organizer?.name || "them"}.</p>
        {upcomingSlots.length > 0 && (
          <div className="stack" data-testid="counter-slots">
            <h4 className="section-label">FROM YOUR AVAILABILITY</h4>
            {upcomingSlots.slice(0, 5).flatMap((slot) => (slot.blocks || []).map((block, i) => (
              <button
                key={`${slot.date}-${i}`}
                className="slot-pill"
                onClick={() => sendCounter(slot.date, block.start, block.end)}
                data-testid={`counter-slot-${slot.date}-${i}`}
              >
                {fmtDate(slot.date, { weekday: "short", month: "short", day: "numeric" })} · {timeLabel(block.start)}–{timeLabel(block.end)}
              </button>
            )))}
          </div>
        )}
        <div className="stack">
          <h4 className="section-label">OR PICK A CUSTOM TIME</h4>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="counter-date-input" />
          <div className="row" style={{ gap: 8 }}>
            <select className="select" value={start} onChange={(e) => setStart(e.target.value)} data-testid="counter-start-select">{timeOptions.slice(0, -1).map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}</select>
            <select className="select" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="counter-end-select">{timeOptions.filter((t) => minutes(t) > minutes(start)).map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}</select>
          </div>
          <button className="button primary" onClick={() => sendCounter(date, start, end)} data-testid="counter-submit-button">Suggest this time</button>
        </div>
      </section>
    </div>
  );
}

function DeclineOrSuggestModal({ playdate, refresh, onClose }) {
  // 5.1: simplified to a plain decline-confirm now that suggesting a time has its
  // own top-level entry point (CounterModal) — no longer needs to bundle both.
  const declineOutright = async () => {
    try {
      await api(`/playdates/${playdate.playdate_id}/respond`, { method: "POST", body: JSON.stringify({ action: "decline" }) });
      toast.success("Response sent");
      await refresh();
      onClose();
    } catch (error) { toast.error(error.message); }
  };

  return (
    <div className="center-overlay" data-testid="decline-suggest-modal-overlay">
      <section className="modal-panel stack" data-testid="decline-suggest-modal">
        <div className="sheet-title-row"><h3 data-testid="decline-suggest-title">Decline this playdate?</h3><button className="icon-button" onClick={onClose} data-testid="decline-suggest-close-button"><X size={20} /></button></div>
        <p className="muted">The other family will be notified. Want to suggest a different time instead? Close this and use "Suggest a time".</p>
        <button className="button primary" onClick={declineOutright} data-testid="decline-suggest-decline-button">Decline</button>
        <button className="button secondary" onClick={onClose} data-testid="decline-suggest-cancel-button">Never mind</button>
      </section>
    </div>
  );
}

function ChatModal({ playdate, user, onClose }) {
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
    <div className="center-overlay" data-testid="chat-screen" onClick={onClose}>
      <section className="modal-panel chat-panel stack" data-testid="chat-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-title-row">
          <div>
            <h3 data-testid="chat-title">{playdate.title}</h3>
            <span className={`badge ${playdate.status === "completed" ? "terra" : "sage"}`}>{playdate.status.toUpperCase()}</span>
          </div>
          <button className="icon-button" onClick={onClose} data-testid="chat-back-button"><X size={20} /></button>
        </div>
        <section className="chat-thread" data-testid="chat-message-list">
          {messages.map((m) => {
            const mine = m.sender_id === user?.user_id;
            return (
              <div key={m.message_id} className={`chat-message-row ${mine ? "mine" : "theirs"}`} data-testid={`chat-message-${m.message_id}`}>
                <div className={`message-bubble ${mine ? "mine" : ""}`}>
                  {!mine && <div className="message-meta">{m.sender_name}</div>}
                  <div>{m.content}</div>
                  <small>{new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small>
                </div>
              </div>
            );
          })}
          {!messages.length && <div className="empty-state" data-testid="chat-empty-state">No messages yet.</div>}
        </section>
        {locked ? <div className="chat-locked" data-testid="chat-locked-banner"><Lock size={18} /> Chat is locked after a playdate ends.</div> : <div className="chat-input-bar"><input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Message..." data-testid="chat-message-input" /><button onClick={send} disabled={!content.trim()} data-testid="chat-send-button"><Send size={18} /></button></div>}
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

function SharingSection() {
  // 4.1: placed in Profile as its own section, matching the existing
  // card-stack-per-topic IA already used for Children/Notification settings on
  // this same page, rather than inventing a new screen or nav entry for it.
  const [shares, setShares] = useState(null);
  const [revoking, setRevoking] = useState(null);

  const load = useCallback(() => {
    api("/availability-share-requests/active").then(setShares).catch(() => setShares([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const revoke = async (requestId) => {
    setRevoking(requestId);
    try {
      await api(`/availability-share-requests/${requestId}/revoke`, { method: "POST" });
      // 4.2: silent by design — no toast wording implying the other party was told;
      // this only confirms the action to the person who took it.
      toast.success("Stopped sharing");
      setShares((prev) => prev.filter((s) => s.request_id !== requestId));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRevoking(null);
    }
  };

  if (shares === null) return null;

  return (
    <section className="stack" data-testid="sharing-section">
      <h2 className="section-title" data-testid="sharing-title">Sharing with {shares.length} {shares.length === 1 ? "family" : "families"}</h2>
      {shares.map((share) => (
        <div className="mini-card child-profile-card" key={share.request_id} data-testid={`sharing-card-${share.request_id}`}>
          <div className="row" style={{ gap: 10 }}>
            <div className="avatar-circle" style={{ width: 40, height: 40 }}>
              {share.parent.picture ? <img src={share.parent.picture} alt="" /> : share.parent.name?.[0]}
            </div>
            <strong data-testid={`sharing-name-${share.request_id}`}>{share.parent.name}</strong>
          </div>
          <button className="button small secondary" onClick={() => revoke(share.request_id)} disabled={revoking === share.request_id} data-testid={`sharing-revoke-${share.request_id}`}>
            {revoking === share.request_id ? "…" : "Stop sharing"}
          </button>
        </div>
      ))}
      {!shares.length && <div className="empty-state card" data-testid="sharing-empty-state">Not sharing availability with anyone yet.</div>}
    </section>
  );
}

function ProfilePage({ user, dashboard, refresh }) {
  const [showChild, setShowChild] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [showParentEdit, setShowParentEdit] = useState(false);
  const [showAddFamily, setShowAddFamily] = useState(false);
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
        <SharingSection />
        <section className="card stack" data-testid="notification-settings-card"><h2 className="card-title" data-testid="notification-settings-title">Notification settings</h2><div className="chip-row"><span className="badge sage">Email {user?.notification_preferences?.email ? "on" : "off"}</span><span className="badge blue">Push {user?.notification_preferences?.push ? "on" : "off"}</span><span className="badge amber">SMS {user?.notification_preferences?.sms ? "on" : "off"}</span></div></section>
        {user?.is_admin && <AdminPendingCommunities />}
        {user?.is_admin && <AdminApprovedCommunities />}
        {/* Cosmetic only — real enforcement is require_admin on POST /admin/add-family */}
        {user?.is_admin && (
          <button className="card admin-row" onClick={() => setShowAddFamily(true)} data-testid="admin-add-family-button">
            Admin — Add a Family
          </button>
        )}
        <button className="button secondary" onClick={logout} data-testid="logout-button">Log out</button>
      </div>
      {showChild && <ChildModal onClose={() => setShowChild(false)} refresh={refresh} />}
      {editingChild && <ChildModal child={editingChild} onClose={() => setEditingChild(null)} refresh={refresh} />}
      {showParentEdit && <ParentProfileModal user={user} refresh={refresh} onClose={() => setShowParentEdit(false)} />}
      {showAddFamily && <AddFamily api={api} onClose={() => setShowAddFamily(false)} />}
    </AppLayout>
  );
}

function AdminPendingCommunities() {
  const [pending, setPending] = useState([]);
  const [approvedLinks, setApprovedLinks] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [declineTarget, setDeclineTarget] = useState(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineBusy, setDeclineBusy] = useState(false);

  const loadPending = useCallback(() => {
    setLoading(true);
    api("/admin/communities/pending")
      .then((data) => setPending(data.communities || []))
      .catch(() => setPending([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const approve = async (communityId) => {
    try {
      const data = await api(`/communities/${communityId}/approve`, { method: "POST" });
      toast.success(`${data.community.name} approved`);
      setApprovedLinks((prev) => ({ ...prev, [communityId]: data.community.join_slug }));
      setPending((prev) => prev.filter((c) => c.community_id !== communityId));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const closeDecline = () => {
    setDeclineTarget(null);
    setDeclineReason("");
  };

  const decline = async () => {
    setDeclineBusy(true);
    try {
      await api(`/communities/${declineTarget.community_id}/decline`, { method: "POST", body: JSON.stringify({ reason: declineReason.trim() || null }) });
      toast.success(`${declineTarget.name} declined`);
      setPending((prev) => prev.filter((c) => c.community_id !== declineTarget.community_id));
      closeDecline();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeclineBusy(false);
    }
  };

  const copyLink = (communityId, slug) => {
    const link = `${window.location.origin}/join/${slug}`;
    navigator.clipboard.writeText(link);
    setCopiedId(communityId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading || (!pending.length && !Object.keys(approvedLinks).length)) return null;

  return (
    <section className="card stack" data-testid="admin-pending-communities-card">
      <h2 className="card-title" data-testid="admin-pending-title">Pending communities</h2>
      {pending.map((community) => (
        <div className="mini-card family-head" key={community.community_id} data-testid={`admin-pending-${community.community_id}`}>
          <div>
            <strong data-testid={`admin-pending-name-${community.community_id}`}>{community.name}</strong>
            <p className="muted">{community.city || ""}</p>
          </div>
          <div className="radio-pills">
            <button className="button primary" onClick={() => approve(community.community_id)} data-testid={`admin-approve-button-${community.community_id}`}>
              Approve
            </button>
            <button className="button blue-outline" onClick={() => setDeclineTarget(community)} data-testid={`admin-decline-button-${community.community_id}`}>
              Decline
            </button>
          </div>
        </div>
      ))}
      {Object.entries(approvedLinks).map(([communityId, slug]) => (
        <div className="mini-card" key={communityId} data-testid={`admin-approved-${communityId}`}>
          <div>
            <strong>Join link ready</strong>
            <p className="muted" data-testid={`admin-approved-link-${communityId}`}>{`${window.location.origin}/join/${slug}`}</p>
          </div>
          <button className="button small secondary" onClick={() => copyLink(communityId, slug)} data-testid={`admin-copy-button-${communityId}`}>
            {copiedId === communityId ? <><Check size={15} /> Copied</> : "Copy"}
          </button>
        </div>
      ))}
      {declineTarget && (
        <div className="sheet-overlay" data-testid="decline-community-sheet-overlay">
          <section className="bottom-sheet stack" data-testid="decline-community-sheet">
            <div className="drag-handle" />
            <div className="sheet-title-row">
              <h3 data-testid="decline-community-title">Decline "{declineTarget.name}"?</h3>
              <button className="icon-button" onClick={closeDecline} data-testid="decline-community-close-button"><X size={20} /></button>
            </div>
            <p className="muted">Optional — let the parent know why. This is shown to them.</p>
            <textarea
              className="textarea"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. This community already exists — search for it in the directory."
              data-testid="decline-community-reason-input"
            />
            <div className="radio-pills">
              <button className="button blue-outline" onClick={closeDecline} disabled={declineBusy} data-testid="decline-community-cancel-button">
                Cancel
              </button>
              <button className="button primary" onClick={decline} disabled={declineBusy} data-testid="decline-community-confirm-button">
                {declineBusy ? "Declining…" : "Confirm decline"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function AdminApprovedCommunities() {
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    api("/admin/communities/approved")
      .then(setApproved)
      .catch(() => setApproved([]))
      .finally(() => setLoading(false));
  }, []);

  const copyLink = (id, slug) => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${slug}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpanded = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const approvedMeta = (community) => {
    if (!community.approved_at) return null;
    const when = fmtDate(community.approved_at.slice(0, 10), { month: "short", day: "numeric" });
    return community.approved_by_name ? `Approved ${when} by ${community.approved_by_name}` : `Approved ${when}`;
  };

  if (loading || !approved.length) return null;

  return (
    <section className="card stack" data-testid="admin-approved-communities-card">
      <h2 className="card-title" data-testid="admin-approved-communities-title">Approved communities</h2>
      {approved.map((master) => {
        const hasSubs = master.subs?.length > 0;
        const isOpen = expanded.has(master.community_id);
        const meta = approvedMeta(master);
        return (
          <div className="stack" style={{ gap: 6 }} key={master.community_id} data-testid={`admin-approved-group-${master.community_id}`}>
            <div
              className="mini-card family-head"
              onClick={() => hasSubs && toggleExpanded(master.community_id)}
              style={{ cursor: hasSubs ? "pointer" : "default" }}
              data-testid={`admin-approved-${master.community_id}`}
            >
              <div className="row" style={{ gap: 8 }}>
                {hasSubs && (isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
                <div>
                  <strong data-testid={`admin-approved-name-${master.community_id}`}>{master.name}</strong>
                  <p className="muted">{master.city || ""} · {master.member_count} members{hasSubs ? ` · ${master.subs.length} sub-communities` : ""}</p>
                  {meta && <p className="muted" style={{ fontSize: 11 }}>{meta}</p>}
                </div>
              </div>
              <button className="button small secondary" onClick={(e) => { e.stopPropagation(); copyLink(master.community_id, master.join_slug); }} data-testid={`admin-approved-copy-${master.community_id}`}>
                {copiedId === master.community_id ? <><Check size={15} /> Copied</> : "Copy link"}
              </button>
            </div>
            {isOpen && hasSubs && (
              <div className="stack" style={{ gap: 6, marginLeft: 20 }} data-testid={`admin-approved-subs-${master.community_id}`}>
                {master.subs.map((sub) => {
                  const subMeta = approvedMeta(sub);
                  return (
                    <div className="mini-card family-head" key={sub.community_id} data-testid={`admin-approved-sub-${sub.community_id}`}>
                      <div>
                        <strong>{sub.name}</strong>
                        <p className="muted">{sub.member_count} members</p>
                        {subMeta && <p className="muted" style={{ fontSize: 11 }}>{subMeta}</p>}
                      </div>
                      <button className="button small secondary" onClick={() => copyLink(sub.community_id, sub.join_slug)} data-testid={`admin-approved-sub-copy-${sub.community_id}`}>
                        {copiedId === sub.community_id ? <><Check size={15} /> Copied</> : "Copy link"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
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

function WelcomeScreen({ user, dashboard, refresh }) {
  const navigate = useNavigate();
  const firstChild = dashboard?.children?.[0];
  const community = dashboard?.communities?.find((c) => !c.master_community_id) || dashboard?.communities?.[0];
  const [allergies, setAllergies] = useState(firstChild?.allergies || "");
  const [interests, setInterests] = useState(firstChild?.interests || []);
  const [saving, setSaving] = useState(false);

  const toggleInterest = (interest) => setInterests((prev) => prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]);

  const submit = async () => {
    setSaving(true);
    try {
      if (firstChild) {
        await api(`/children/${firstChild.child_id}`, { method: "PUT", body: JSON.stringify({ allergies, interests }) });
      }
      await api("/profile", { method: "PUT", body: JSON.stringify({ needs_welcome: false }) });
      await refresh();
      navigate("/home", { replace: true });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="slide-screen" data-testid="welcome-screen">
      <Header title="Welcome" user={user} />
      <main className="main-content stack">
        <section className="card stack" data-testid="welcome-intro-card">
          <h1 className="section-title">Welcome to PlayPals!</h1>
          <p className="muted" data-testid="welcome-message">
            {firstChild
              ? `We've added ${firstChild.first_name} (${firstChild.grade}) to ${community?.name || "your community"}.`
              : `We've added you to ${community?.name || "your community"}.`}
          </p>
        </section>
        {firstChild && (
          <section className="card stack" data-testid="welcome-child-card">
            <h2 className="section-title">A couple quick details</h2>
            <input
              className="input"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="Allergies / dietary restrictions"
              data-testid="welcome-allergies-input"
            />
            <div className="chip-row" data-testid="welcome-interest-options">
              {INTERESTS.map((interest) => (
                <button
                  key={interest}
                  className={`chip ${interests.includes(interest) ? "active" : ""}`}
                  onClick={() => toggleInterest(interest)}
                  data-testid={`welcome-interest-${interest.toLowerCase()}-button`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </section>
        )}
        <button className="button primary" onClick={submit} disabled={saving} data-testid="welcome-continue-button">
          {saving ? "Saving…" : "Continue"}
        </button>
      </main>
    </div>
  );
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
  const needsWelcome = authed && dashboard?.parent?.needs_welcome;

  return (
    <Routes>
      <Route path="/login" element={authed ? <Navigate to="/home" replace /> : <LoginScreen refresh={refresh} />} />
      <Route path="/auth/magic" element={<AuthCallback refresh={refresh} />} />
      <Route path="/welcome" element={<Protected authed={authed} loading={loading}><WelcomeScreen user={user} dashboard={dashboard} refresh={refresh} /></Protected>} />
      <Route path="/home" element={<Protected authed={authed} loading={loading} needsWelcome={needsWelcome}><HomePage user={user} dashboard={dashboard} refresh={refresh} /></Protected>} />
      <Route path="/playdates" element={<Protected authed={authed} loading={loading} needsWelcome={needsWelcome}><PlaydatesPage user={user} dashboard={dashboard} refresh={refresh} /></Protected>} />
      <Route path="/community" element={<Protected authed={authed} loading={loading} needsWelcome={needsWelcome}><CommunityPage user={user} dashboard={dashboard} refresh={refresh} /></Protected>} />
      <Route path="/join/:slug" element={<JoinLinkGate authed={authed} loading={loading}><JoinViaLinkScreen user={user} refresh={refresh} /></JoinLinkGate>} />
      <Route path="/profile" element={<Protected authed={authed} loading={loading} needsWelcome={needsWelcome}><ProfilePage user={user} dashboard={dashboard} refresh={refresh} /></Protected>} />
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
