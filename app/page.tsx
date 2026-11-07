"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { ArrowRight, Check, ChevronDown, Leaf, LogOut, ShieldCheck, TrendingUp } from "lucide-react";
import MoodChart from "./mood-chart";
import { getFirebase } from "@/lib/firebase";
import { dateLabel, localDate, moods, shiftDate, type Entry } from "@/lib/mood";

function friendlyError(error: unknown) {
  const code = (error as { code?: string }).code;
  if (code === "permission-denied") return "Your data couldn’t be accessed. Publish the app’s Firestore rules in Firebase Console, then refresh.";
  if (code === "auth/unauthorized-domain") return "Add this website’s hostname to Firebase Authentication → Settings → Authorized domains, then try again.";
  if (code === "auth/popup-blocked") return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Sign-in was cancelled. You can try again whenever you’re ready.";
  if (code === "auth/network-request-failed" || code === "unavailable") return "Couldn’t connect. Check your internet connection and try again.";
  return "Something went wrong. Please try again.";
}

function MoodFace({ score }: { score: number }) {
  return <svg width="42" height="42" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="17" cy="20" r="1.7" fill="currentColor" /><circle cx="31" cy="20" r="1.7" fill="currentColor" />
    <path d={score === 1 ? "M15 33 Q24 20 33 33" : score === 2 ? "M17 31 Q24 24 31 31" : score === 3 ? "M17 29 H31" : score === 4 ? "M17 27 Q24 35 31 27" : "M14 26 Q24 42 34 26 Z"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [today, setToday] = useState("");
  const [range, setRange] = useState("30");
  const [showDemo, setShowDemo] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const account = useRef<string | null>(null);
  const savedToday = entries.find(entry => entry.date === today)?.score;

  useEffect(() => {
    setIsLocalhost(["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname));
    const update = () => { setToday(localDate()); setOnline(navigator.onLine); };
    update();
    const timer = setInterval(update, 30_000);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    const unsubscribe = onAuthStateChanged(getFirebase().auth, next => {
      account.current = next?.uid ?? null;
      setUser(next); setEntries([]); setSelected(null); setLoaded(false); setError(""); setMessage(""); setAuthReady(true);
    }, error => { setError(friendlyError(error)); setAuthReady(true); });
    return () => { clearInterval(timer); unsubscribe(); window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(getFirebase().db, "users", user.uid, "moods"), orderBy("date", "asc")), { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.hasPendingWrites || account.current !== user.uid) return;
      setEntries(snapshot.docs.map(item => item.data()).filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isInteger(item.score) && item.score >= 1 && item.score <= 5).map(item => ({ date: item.date, score: item.score })));
      setLoaded(true);
    }, error => { setLoaded(false); setError(friendlyError(error)); });
  }, [user]);

  useEffect(() => { setSelected(savedToday ?? null); setMessage(""); }, [savedToday, today]);

  async function login() {
    setBusy(true); setError("");
    try { const { auth, provider } = getFirebase(); await signInWithPopup(auth, provider); }
    catch (error) { setError(friendlyError(error)); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError("");
    try { await signOut(getFirebase().auth); }
    catch (error) { setError(friendlyError(error)); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!user || selected === null || !online || !loaded || saving) return;
    const date = localDate();
    if (date !== today) { setToday(date); return; }
    const uid = user.uid;
    setSaving(true); setError(""); setMessage("");
    try {
      await setDoc(doc(getFirebase().db, "users", uid, "moods", date), { date, score: selected, updatedAt: serverTimestamp() });
      if (account.current === uid) setMessage("Saved. A little moment, just for you.");
    } catch (error) { if (account.current === uid) setError(friendlyError(error)); }
    finally { setSaving(false); }
  }
  // Preview scores only feed the history view; the save handler uses real entries.
  const demoEntries: Entry[] = today ? Array.from({ length: 90 }, (_, index) => ({
    date: shiftDate(today, index - 89),
    score: [3, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 4, 5, 4][index % 14],
  })).filter((_, index) => index % 17 !== 6) : [];
  const graphEntries = showDemo ? demoEntries : entries;
  const graphReady = showDemo || loaded;
  const visible = graphEntries.filter(entry => entry.date <= today && (range === "all" || entry.date >= shiftDate(today || localDate(), -(Number(range) - 1))));
  const average = visible.length ? (visible.reduce((sum, entry) => sum + entry.score, 0) / visible.length).toFixed(1) : "—";
  const activeMood = moods.find(mood => mood.score === selected);

  return <div className="app-shell">
    <header className="site-header"><a className="wordmark" href="/" aria-label="Pulse home"><span className="brand-icon"><Leaf size={22} strokeWidth={1.6} /></span>pulse<span className="wordmark-dot">.</span></a>
      <div className="account">{user ? <><span className="account-name">{user.displayName || user.email}</span><button className="icon-button" onClick={logout} disabled={busy || saving} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button></> : <span className="header-caption">A little space to check in.</span>}</div>
    </header>
    <main>
      <section className="intro"><p className="eyebrow">YOUR DAILY PAUSE</p><h1>Make room for how you feel.</h1><p>One small check-in. A clearer picture of your days.</p></section>
      {!online && <p className="notice" role="status">You’re offline. {saving ? "Your save is waiting for a connection. Keep this page open." : "Reconnect to save your check-in."}</p>}
      {error && <div className="error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError("")}>×</button></div>}
      <section className="checkin card" aria-labelledby="checkin-title"><div className="section-top"><span className="eyebrow">TODAY’S CHECK-IN</span><span className="date-label">{today ? dateLabel(today, { weekday: "short", month: "short", day: "numeric" }) : "Today"}</span></div>
        <h2 id="checkin-title">Overall, how did you feel today?</h2><p className="subtle">Take a breath. Pick what feels closest.</p>
        <div className="mood-options" role="group" aria-label="Choose your daily mood score">{moods.map(mood => <button key={mood.score} className={`mood-option ${selected === mood.score ? "selected" : ""}`} style={{ "--mood-color": mood.color } as React.CSSProperties} disabled={!user || !loaded || saving} aria-pressed={selected === mood.score} aria-label={`${mood.score} — ${mood.label}. ${mood.description}`} title={mood.description} onClick={() => { setSelected(mood.score); setMessage(""); }}><MoodFace score={mood.score} /><span className="mood-label">{mood.label}</span><span className="mood-number">{mood.score}</span>{selected === mood.score && <span className="selected-check"><Check size={12} /></span>}</button>)}</div>
        <div className="checkin-bottom"><p className="selection-hint">{!authReady ? "Getting things ready…" : !user ? "Your check-ins belong to you. Sign in to start." : !loaded ? "Waiting for your mood history…" : activeMood ? activeMood.description : "No right or wrong answers. Just you, today."}</p>
          {!user ? <button className="primary-button" disabled={!authReady || busy} onClick={login}>{busy ? "Signing in…" : "Continue with Google"}<ArrowRight size={16} /></button> : <button className="primary-button" disabled={selected === null || saving || !online || !loaded || selected === savedToday} onClick={save}>{saving ? "Saving…" : selected !== null && selected === savedToday ? <><Check size={16} />Saved for today</> : <>{savedToday ? "Update check-in" : "Save check-in"}<ArrowRight size={16} /></>}</button>}
        </div><p className="save-message" role="status" aria-live="polite">{message || (user && savedToday ? "You can change today’s score whenever you need to." : "")}</p>
      </section>
      <section className="history card" aria-labelledby="history-title"><div className="history-heading"><div><div className="eyebrow">THE BIGGER PICTURE</div><h2 id="history-title">{showDemo ? "A look at sample days" : "Your days, over time"}</h2></div>
        <div className="history-controls">
          {isLocalhost && <button className="demo-button" aria-pressed={showDemo} disabled={!today} onClick={() => setShowDemo(current => !current)}>{showDemo ? "Show my data" : "Show demo data"}</button>}
          <div className="range-select"><select aria-label="Graph date range" value={range} onChange={event => setRange(event.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></select><ChevronDown size={14} /></div>
        </div></div>
        {showDemo && <p className="demo-notice" role="status">Demo preview · Fictional scores across 90 days, with a few missed days. Nothing is saved to your account.</p>}
        <div className="chart-wrap">{visible.length && graphReady ? <MoodChart key={`${range}-${showDemo}`} entries={graphEntries.filter(entry => entry.date <= today)} today={today} range={range} /> : <div className="empty-chart"><div className="empty-grid" aria-hidden="true"/><div className="empty-content"><span className="empty-icon"><TrendingUp size={25} strokeWidth={1.4} /></span><h3>A little perspective starts here.</h3><p>{!user ? "Sign in and save your first mood to begin your graph." : !loaded ? "Your history will appear once it’s connected." : "Your check-ins will appear here, one day at a time."}</p></div></div>}</div>
        <div className="chart-footer"><span><span className="legend-dot" />{showDemo ? "Sample mood" : "Daily mood"} <span className="legend-note">· Missing days stay blank</span></span><span><strong>{graphReady ? visible.length : "—"}</strong> {showDemo ? "sample entries" : "check-ins"} <span className="stat-separator">/</span> <strong>{graphReady ? average : "—"}</strong> average</span></div>
        {!!visible.length && graphReady && <details className="history-table"><summary>{showDemo ? "View sample scores" : "View recorded scores"}</summary><div className="table-scroll"><table><caption className="sr-only">{showDemo ? "Fictional sample scores" : "Recorded scores"} in the selected date range</caption><thead><tr><th>Date</th><th>Mood</th><th>Score</th></tr></thead><tbody>{[...visible].reverse().map(entry => <tr key={entry.date}><td>{dateLabel(entry.date, { year: "numeric", month: "short", day: "numeric" })}</td><td>{moods[entry.score - 1].label}</td><td>{entry.score} / 5</td></tr>)}</tbody></table></div></details>}
      </section>
      <p className="gentle-note">Some days bloom. Some days just are. They all belong here.</p>
    </main><footer><span><ShieldCheck size={14} />Private to your account</span><span>A moment for you, every day.</span></footer>
  </div>;
}
