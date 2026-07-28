import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
} from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
  LineChart,
  Line,
} from "recharts";
import {
  LayoutDashboard,
  ClipboardList,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Bell,
  Download,
  Plus,
  X,
  SkipForward,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Pencil,
  Trash2,
} from "lucide-react";
import defaultHydraXls from "../assets/HYDRAA.xls?raw";

// ─── Sound System ────────────────────────────────────────────────────────────

export const SOUND_OPTIONS = [
  { id: "gentle", label: "Gentle Chime" },
  { id: "bell", label: "Bell" },
  { id: "pulse", label: "Pulse Beeps" },
  { id: "alert", label: "Alert Tone" },
  { id: "water", label: "Water Drop" },
  { id: "none", label: "Silent" },
  { id: "fahh", label: "Faahh.." },
];

let _audioCtx: AudioContext | null = null;
let _soundLoopId: ReturnType<typeof setInterval> | null = null;

function getAudioCtx(): AudioContext {
  if (!_audioCtx || _audioCtx.state === "closed")
    _audioCtx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
  return _audioCtx;
}

function _playTone(type: string, volume: number, ctx: AudioContext) {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);
  const v = Math.max(0, Math.min(1, volume));
  const now = ctx.currentTime;

  if (type === "gentle") {
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.22;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(v * 0.55, t + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  } else if (type === "bell") {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 1.4);
    gain.gain.setValueAtTime(v, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 1.7);
  } else if (type === "pulse") {
    [0, 0.22, 0.44].forEach((t) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, now + t);
      gain.gain.linearRampToValueAtTime(v * 0.25, now + t + 0.02);
      gain.gain.setValueAtTime(v * 0.25, now + t + 0.1);
      gain.gain.linearRampToValueAtTime(0, now + t + 0.18);
      osc.connect(gain);
      osc.start(now + t);
      osc.stop(now + t + 0.22);
    });
  } else if (type === "alert") {
    [0, 0.38].forEach((t, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = i === 0 ? 600 : 800;
      gain.gain.setValueAtTime(0, now + t);
      gain.gain.linearRampToValueAtTime(v * 0.5, now + t + 0.02);
      gain.gain.setValueAtTime(v * 0.5, now + t + 0.28);
      gain.gain.linearRampToValueAtTime(0, now + t + 0.35);
      osc.connect(gain);
      osc.start(now + t);
      osc.stop(now + t + 0.38);
    });
  } else if (type === "water") {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.28);
    gain.gain.setValueAtTime(v * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.42);
  }
}

function _soundRepeatMs(type: string) {
  return type === "pulse"
    ? 1600
    : type === "water"
      ? 1400
      : type === "alert"
        ? 2200
        : type === "bell"
          ? 200
          : 2600;
}

let _fahhAudio: HTMLAudioElement | null = null;

function playFahhSound(volume: number) {
  try {
    if (!_fahhAudio) {
      _fahhAudio = new Audio("src/assets/sounds/fahhhhhhhhhhhhhh.mp3");
    }

    _fahhAudio.pause();
    _fahhAudio.currentTime = 0;

    // volume should be between 0 and 1
    // _fahhAudio.volume = Math.max(0, Math.min(1, volume));
    _fahhAudio.volume = Math.max(0, Math.min(1, volume / 100));

    void _fahhAudio.play();
  } catch (error) {
    console.error("Unable to play FAHH sound:", error);
  }
}

function startReminderSound(type: string, volume: number) {
  stopReminderSound();
  if (type === "none") return;

  // Play FAHH audio file
  if (type === "fahh") {
    playFahhSound(volume);

    // Repeat FAHH every 3 seconds while reminder is visible
    _soundLoopId = setInterval(() => {
      playFahhSound(volume);
    }, 3000);

    return;
  }

  // Existing Web Audio sounds
  try {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    _playTone(type, volume, ctx);
    _soundLoopId = setInterval(() => {
      try {
        const c = getAudioCtx();
        if (c.state === "suspended") c.resume();
        _playTone(type, volume, c);
      } catch {}
    }, _soundRepeatMs(type));
  } catch {}
}

function stopReminderSound() {
  if (_soundLoopId !== null) {
    clearInterval(_soundLoopId);
    _soundLoopId = null;
  }

  if (_fahhAudio) {
    _fahhAudio.pause();
    _fahhAudio.currentTime = 0;
  }
}

async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function fireNativeNotification(todayWater: number, goal: number) {
  if (!("Notification" in window) || Notification.permission !== "granted")
    return;
  const pct = goal > 0 ? Math.round((todayWater / goal) * 100) : 0;
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const title = "Time to drink";
  const body =
    todayWater > 0
      ? `${todayWater} / ${goal} ml today (${pct}%) · ${timeStr}`
      : `Goal: ${goal} ml · Start hydrating! · ${timeStr}`;
  try {
    new Notification(title, {
      body,
      icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ctext y='26' font-size='28'%3E%F0%9F%92%A7%3C/text%3E%3C/svg%3E",
      tag: "hydraa-reminder",
    });
  } catch {
    /* silently ignore if blocked */
  }
}

function playTestSound(type: string, volume: number) {
  if (type === "none") return;

  // Play FAHH audio file
  if (type === "fahh") {
    playFahhSound(volume);
    return;
  }

  // Existing Web Audio sounds
  try {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    _playTone(type, volume, ctx);
  } catch {}
}

// ─── Types & Constants ────────────────────────────────────────────────────────

export type DrinkType = "water" | "coffee" | "tea" | "soda" | "juice";
type ThemeMode = "light" | "dark";
type TabKey = "dashboard" | "history" | "trends" | "settings";

const DRINKS: Record<
  DrinkType,
  { label: string; emoji: string; colorLight: string; colorDark: string }
> = {
  water: {
    label: "Water",
    emoji: "💧",
    colorLight: "#0284c7",
    colorDark: "#38bdf8",
  },
  coffee: {
    label: "Coffee",
    emoji: "☕",
    colorLight: "#92400e",
    colorDark: "#fbbf24",
  },
  tea: {
    label: "Tea",
    emoji: "🍵",
    colorLight: "#15803d",
    colorDark: "#4ade80",
  },
  soda: {
    label: "Soda",
    emoji: "🥤",
    colorLight: "#b91c1c",
    colorDark: "#f87171",
  },
  juice: {
    label: "Juice",
    emoji: "🧃",
    colorLight: "#b45309",
    colorDark: "#fb923c",
  },
};
const DRINK_KEYS = Object.keys(DRINKS) as DrinkType[];
const ML_PRESETS = [50, 100, 150, 200, 300];

const NAV_ITEMS: { key: TabKey; label: string; icon: any }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "history", label: "History", icon: ClipboardList },
  { key: "trends", label: "Trends", icon: TrendingUp },
  { key: "settings", label: "Settings", icon: Settings },
];

// ─── Data types ───────────────────────────────────────────────────────────────

interface HydrationRecord {
  id: string;
  date: string;
  time: string;
  timestamp: number;
  amount: number;
  drinkType: DrinkType;
  type: "drink" | "snooze" | "skip";
  source: "manual" | "reminder";
  snoozeDuration?: number;
  dailyWaterTotal: number;
}
interface DailyGoalRecord {
  date: string;
  goal: number;
}

interface AppState {
  records: HydrationRecord[];
  dailyGoal: number;
  dailyGoals: DailyGoalRecord[];
  reminderInterval: number;
  snoozeDurations: number[];
  reminderEnabled: boolean;
  soundChoice: string;
  soundVolume: number;
  soundEnabled: boolean;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function getGoalForDate(state: AppState, date: string): number {
  return (
    (state.dailyGoals ?? []).find((g) => g.date === date)?.goal ??
    state.dailyGoal
  );
}

function getDefaultState(): AppState {
  return {
    records: [],
    dailyGoal: 2500,
    dailyGoals: [],
    reminderInterval: 30,
    snoozeDurations: [5, 10, 15, 30],
    reminderEnabled: true,
    soundChoice: "gentle",
    soundVolume: 0.7,
    soundEnabled: true,
  };
}

function mergeDefaults(partial: any): AppState {
  return { ...getDefaultState(), ...(partial ?? {}) };
}

function getSheet(doc: Document, name: string): Element | null {
  const sheets = Array.from(doc.getElementsByTagName("Worksheet"));
  for (const sheet of sheets) {
    const n = sheet.getAttribute("ss:Name") ?? sheet.getAttribute("Name");
    if (n === name) return sheet;
  }
  return null;
}

function rowText(row: Element, index: number): string {
  const cells = Array.from(row.getElementsByTagName("Cell"));
  return (
    cells[index]?.getElementsByTagName("Data")?.[0]?.textContent?.trim() ?? ""
  );
}

function xlsToState(xml: string): { state: AppState; theme: ThemeMode } | null {
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) return null;

    const state = getDefaultState();
    const records: HydrationRecord[] = [];
    const dailyGoals: DailyGoalRecord[] = [];
    let theme: ThemeMode = "dark";

    const logSheet = getSheet(doc, "HYDRAA Log");
    if (logSheet) {
      const rows = Array.from(logSheet.getElementsByTagName("Row"));
      rows.slice(1).forEach((row, i) => {
        const date = rowText(row, 0);
        const time = rowText(row, 1);
        if (!date || !time) return;

        const drinkLabel = rowText(row, 2);
        const drinkType =
          DRINK_KEYS.find((k) => DRINKS[k].label === drinkLabel) ?? "water";
        const typeValue = rowText(row, 4).toLowerCase();
        const recordType: HydrationRecord["type"] =
          typeValue === "snoozed" || typeValue === "snooze"
            ? "snooze"
            : typeValue === "skipped" || typeValue === "skip"
              ? "skip"
              : "drink";
        const sourceValue = rowText(row, 5).toLowerCase();
        const source: HydrationRecord["source"] =
          sourceValue === "reminder" ? "reminder" : "manual";

        const timestamp =
          new Date(`${date}T${time}`).getTime() || Date.now() + i;
        records.push({
          id: String(timestamp),
          date,
          time,
          timestamp,
          amount: Math.max(0, Number(rowText(row, 3)) || 0),
          drinkType,
          type: recordType,
          source,
          snoozeDuration: Number(rowText(row, 6)) || undefined,
          dailyWaterTotal: Math.max(0, Number(rowText(row, 7)) || 0),
        });

        const rowGoal = Number(rowText(row, 8));
        if (Number.isFinite(rowGoal) && rowGoal >= 0) state.dailyGoal = rowGoal;
      });
    }

    const configSheet = getSheet(doc, "HYDRAA Config");
    if (configSheet) {
      const rows = Array.from(configSheet.getElementsByTagName("Row"));
      rows.slice(1).forEach((row) => {
        const key = rowText(row, 0);
        const value = rowText(row, 1);
        if (!key) return;
        if (key === "Daily Goal")
          state.dailyGoal = Number(value) || state.dailyGoal;
        if (key === "Reminder Interval")
          state.reminderInterval = Number(value) || state.reminderInterval;
        if (key === "Snooze Durations") {
          const parsed = value
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);
          if (parsed.length) state.snoozeDurations = parsed;
        }
        if (key === "Reminder Enabled")
          state.reminderEnabled = value === "true";
        if (key === "Sound Choice" && value) state.soundChoice = value;
        if (key === "Sound Volume") {
          const vol = Number(value);
          if (Number.isFinite(vol))
            state.soundVolume = Math.max(0, Math.min(1, vol));
        }
        if (key === "Sound Enabled") state.soundEnabled = value === "true";
        if (key === "Theme" && (value === "light" || value === "dark"))
          theme = value;
      });
    }

    const goalsSheet = getSheet(doc, "Daily Goals");
    if (goalsSheet) {
      const rows = Array.from(goalsSheet.getElementsByTagName("Row"));
      rows.slice(1).forEach((row) => {
        const date = rowText(row, 0);
        const goal = Number(rowText(row, 1)) || 0;
        if (date && goal >= 0) dailyGoals.push({ date, goal });
      });
    }

    state.records = records.sort((a, b) => b.timestamp - a.timestamp);
    state.dailyGoals = dailyGoals;
    return { state: mergeDefaults(state), theme };
  } catch {
    return null;
  }
}

function stateToXlsXml(state: AppState, theme: ThemeMode): string {
  const esc = (v: string | number | boolean) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;");
  const c = (v: string | number | boolean, num = false) =>
    `<Cell><Data ss:Type="${num ? "Number" : "String"}">${esc(v)}</Data></Cell>`;
  const hdr = (t: string) =>
    `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(t)}</Data></Cell>`;

  const hdrs = [
    "Date",
    "Time",
    "Drink Type",
    "Amount (ml)",
    "Type",
    "Source",
    "Snooze (min)",
    "Water Total (ml)",
    "Daily Goal (ml)",
  ];
  const rows = state.records.map((r) => [
    r.date,
    r.time,
    DRINKS[r.drinkType]?.label ?? r.drinkType,
    r.amount,
    r.type === "drink" ? "Drink" : r.type === "snooze" ? "Snoozed" : "Skipped",
    r.source === "manual" ? "Manual" : "Reminder",
    r.snoozeDuration ?? "",
    r.dailyWaterTotal,
    getGoalForDate(state, r.date),
  ]);
  const numCols = new Set([3, 7, 8]);

  const configRows: [string, string | number | boolean][] = [
    ["Daily Goal", state.dailyGoal],
    ["Reminder Interval", state.reminderInterval],
    ["Snooze Durations", state.snoozeDurations.join(",")],
    ["Reminder Enabled", state.reminderEnabled],
    ["Sound Choice", state.soundChoice],
    ["Sound Volume", state.soundVolume],
    ["Sound Enabled", state.soundEnabled],
    ["Theme", theme],
    ["Exported At", new Date().toLocaleString()],
  ];

  const goalRows = (state.dailyGoals ?? [])
    .map((g) => `<Row>${c(g.date)}${c(g.goal, true)}</Row>`)
    .join("\n");

  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFF"/><Interior ss:Color="#0284C7" ss:Pattern="Solid"/></Style>
  <Style ss:ID="s"><Font ss:Bold="1"/><Interior ss:Color="#E8F4FD" ss:Pattern="Solid"/></Style>
</Styles>
<Worksheet ss:Name="HYDRAA Log"><Table>
<Row>${hdrs.map(hdr).join("")}</Row>
${rows.map((r) => `<Row>${r.map((v, i) => c(v as string | number, numCols.has(i))).join("")}</Row>`).join("\n")}
</Table></Worksheet>
<Worksheet ss:Name="Summary"><Table>
<Row>${hdr("Metric")}${hdr("Value")}</Row>
${DRINK_KEYS.map(
  (dt) =>
    `<Row>${c(DRINKS[dt].label + " (ml)")}${c(
      state.records
        .filter((r) => r.type === "drink" && r.drinkType === dt)
        .reduce((s, r) => s + r.amount, 0),
      true,
    )}</Row>`,
).join("")}
<Row>${c("Total Drink Entries")}${c(state.records.filter((r) => r.type === "drink").length, true)}</Row>
<Row>${c("Snoozed")}${c(state.records.filter((r) => r.type === "snooze").length, true)}</Row>
<Row>${c("Skipped")}${c(state.records.filter((r) => r.type === "skip").length, true)}</Row>
<Row>${c("Default Daily Goal (ml)")}${c(state.dailyGoal, true)}</Row>
</Table></Worksheet>
<Worksheet ss:Name="HYDRAA Config"><Table>
<Row>${hdr("Setting")}${hdr("Value")}</Row>
${configRows.map(([k, v]) => `<Row>${c(k)}${c(v)}</Row>`).join("\n")}
</Table></Worksheet>
<Worksheet ss:Name="Daily Goals"><Table>
<Row>${hdr("Date")}${hdr("Goal (ml)")}</Row>
${goalRows}
</Table></Worksheet>
</Workbook>`;
}

function xlsLoad(): { state: AppState; theme: ThemeMode } {
  const parsedDefault = xlsToState(defaultHydraXls);
  if (parsedDefault) {
    return parsedDefault;
  }

  return { state: getDefaultState(), theme: "dark" };
}

// ─── Theme hook ───────────────────────────────────────────────────────────────

function useTheme() {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const el = document.documentElement;
    mode === "dark" ? el.classList.add("dark") : el.classList.remove("dark");
  }, [mode]);

  return { mode, setMode, isDark: mode === "dark" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toLocaleDateString("en-CA");
}
function toLocalISO(ts: number) {
  const d = new Date(ts),
    p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function extractParts(ts: number) {
  const d = new Date(ts);
  return {
    date: d.toLocaleDateString("en-CA"),
    time: d.toTimeString().slice(0, 8),
  };
}
function formatAgo(ms: number) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60),
    rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h ago`;
}

function downloadXls(text: string, filename = "HYDRAA.xls") {
  const blob = new Blob([text], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Chart helpers ────────────────────────────────────────────────────────────

function buildDailyData(records: HydrationRecord[], days = 7) {
  const result: Record<string, any>[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toLocaleDateString("en-CA");
    const label = d.toLocaleDateString("en-US", { weekday: "short" });
    const entry: Record<string, any> = { date, label };
    DRINK_KEYS.forEach((dt) => (entry[dt] = 0));
    result.push(entry);
  }
  const byDate = Object.fromEntries(result.map((r) => [r.date, r]));
  records
    .filter((r) => r.type === "drink" && byDate[r.date])
    .forEach((r) => {
      byDate[r.date][r.drinkType] += r.amount;
    });
  return result;
}

function buildMonthlyData(records: HydrationRecord[], months = 6) {
  const result: Record<string, any>[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    const entry: Record<string, any> = { key, label };
    DRINK_KEYS.forEach((dt) => (entry[dt] = 0));
    result.push(entry);
  }
  const byMonth = Object.fromEntries(result.map((r) => [r.key, r]));
  records
    .filter((r) => r.type === "drink")
    .forEach((r) => {
      const k = r.date.slice(0, 7);
      if (byMonth[k]) byMonth[k][r.drinkType] += r.amount;
    });
  return result;
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Num({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={`tabular-nums ${className}`} style={style}>
      {children}
    </span>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {(title || subtitle) && (
        <div className="px-5 py-4 border-b border-border">
          <p className="font-semibold text-foreground text-sm">{title}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
        {label}
      </p>
      <Num className="text-2xl font-bold text-foreground block leading-none">
        {value}
      </Num>
      {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
    </div>
  );
}

function DrinkDot({ type, isDark }: { type: DrinkType; isDark: boolean }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{
        background: isDark ? DRINKS[type].colorDark : DRINKS[type].colorLight,
      }}
    />
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
  return (
    <div className="rounded-lg border border-border bg-card shadow-lg px-3 py-2.5 text-xs min-w-[140px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload
        .filter((p: any) => p.value > 0)
        .map((p: any) => (
          <div
            key={p.dataKey}
            className="flex items-center justify-between gap-3 mb-1"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: p.fill }}
              />
              {DRINKS[p.dataKey as DrinkType]?.label}
            </span>
            <Num className="text-foreground font-medium">{p.value}ml</Num>
          </div>
        ))}
      {total > 0 && payload.filter((p: any) => p.value > 0).length > 1 && (
        <div className="flex justify-between border-t border-border mt-1.5 pt-1.5">
          <span className="text-muted-foreground">Total</span>
          <Num className="text-foreground font-semibold">{total}ml</Num>
        </div>
      )}
    </div>
  );
}

// ── Stacked Area Chart — Dashboard 7-day view
function DrinkAreaChart({
  data,
  isDark,
  height = 210,
  goalLine,
}: {
  data: Record<string, any>[];
  isDark: boolean;
  height?: number;
  goalLine?: number;
}) {
  const tickColor = isDark ? "#5F5F5F" : "#7C7C7C";
  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const activeDrinks = DRINK_KEYS.filter((dt) => data.some((d) => d[dt] > 0));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 8, right: 4, bottom: 0, left: -16 }}
      >
        <defs key="chart-defs">
          {DRINK_KEYS.map((dt) => {
            const color = isDark ? DRINKS[dt].colorDark : DRINKS[dt].colorLight;
            return (
              <linearGradient
                key={`grad-def-${dt}`}
                id={`grad-${dt}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                <stop offset="100%" stopColor={color} stopOpacity={0.04} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={gridColor}
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{
            fill: tickColor,
            fontSize: 11,
            fontFamily: "Inter, sans-serif",
          }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{
            fill: tickColor,
            fontSize: 11,
            fontFamily: "Inter, sans-serif",
          }}
          axisLine={false}
          tickLine={false}
          unit="ml"
          width={52}
        />
        <Tooltip content={<ChartTooltip />} />
        {goalLine && (
          <ReferenceLine
            y={goalLine}
            stroke={isDark ? "#38bdf8" : "#0284c7"}
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
        )}
        {DRINK_KEYS.map((dt) => {
          const color = isDark ? DRINKS[dt].colorDark : DRINKS[dt].colorLight;
          const isLast = activeDrinks[activeDrinks.length - 1] === dt;
          return (
            <Area
              key={`area-${dt}`}
              type="monotone"
              dataKey={dt}
              stackId="a"
              stroke={color}
              strokeWidth={isLast ? 1.5 : 0}
              fill={`url(#grad-${dt})`}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Grouped Bar Chart — Trends 7-day view
function DrinkGroupedBarChart({
  data,
  isDark,
  height = 220,
  goalLine,
}: {
  data: Record<string, any>[];
  isDark: boolean;
  height?: number;
  goalLine?: number;
}) {
  const tickColor = isDark ? "#5F5F5F" : "#7C7C7C";
  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const activeDrinks = DRINK_KEYS.filter((dt) => data.some((d) => d[dt] > 0));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 4, bottom: 0, left: -16 }}
        barCategoryGap="30%"
        barGap={2}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={gridColor}
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{
            fill: tickColor,
            fontSize: 11,
            fontFamily: "Inter, sans-serif",
          }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{
            fill: tickColor,
            fontSize: 11,
            fontFamily: "Inter, sans-serif",
          }}
          axisLine={false}
          tickLine={false}
          unit="ml"
          width={52}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{
            fill: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
          }}
        />
        {goalLine && (
          <ReferenceLine
            y={goalLine}
            stroke={isDark ? "#38bdf8" : "#0284c7"}
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
        )}
        {activeDrinks.map((dt) => (
          <Bar
            key={`bar-${dt}`}
            dataKey={dt}
            fill={isDark ? DRINKS[dt].colorDark : DRINKS[dt].colorLight}
            radius={[3, 3, 0, 0]}
            maxBarSize={18}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Multi-Line Chart — Trends 6-month view
function DrinkLineChart({
  data,
  isDark,
  height = 220,
}: {
  data: Record<string, any>[];
  isDark: boolean;
  height?: number;
}) {
  const tickColor = isDark ? "#5F5F5F" : "#7C7C7C";
  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const activeDrinks = DRINK_KEYS.filter((dt) => data.some((d) => d[dt] > 0));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={gridColor}
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{
            fill: tickColor,
            fontSize: 11,
            fontFamily: "Inter, sans-serif",
          }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{
            fill: tickColor,
            fontSize: 11,
            fontFamily: "Inter, sans-serif",
          }}
          axisLine={false}
          tickLine={false}
          unit="ml"
          width={52}
        />
        <Tooltip content={<ChartTooltip />} />
        {activeDrinks.map((dt) => {
          const color = isDark ? DRINKS[dt].colorDark : DRINKS[dt].colorLight;
          return (
            <Line
              key={`line-${dt}`}
              type="monotone"
              dataKey={dt}
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}

function DrinkLegend({
  data,
  isDark,
}: {
  data: Record<string, any>[];
  isDark: boolean;
}) {
  const active = DRINK_KEYS.filter((dt) => data.some((d) => d[dt] > 0));
  if (!active.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {active.map((dt) => (
        <div
          key={dt}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{
              background: isDark ? DRINKS[dt].colorDark : DRINKS[dt].colorLight,
            }}
          />
          {DRINKS[dt].label}
        </div>
      ))}
    </div>
  );
}

// ─── Record Drink Modal ───────────────────────────────────────────────────────

function RecordDrinkModal({
  onSave,
  onClose,
  initialValues,
}: {
  onSave: (r: {
    drinkType: DrinkType;
    amount: number;
    timestamp: number;
  }) => void;
  onClose: () => void;
  initialValues?: { drinkType: DrinkType; amount: number; timestamp: number };
}) {
  const isEditing = !!initialValues;
  const [drinkType, setDrinkType] = useState<DrinkType>(
    initialValues?.drinkType ?? "water",
  );
  const [preset, setPreset] = useState<number | null>(
    initialValues?.amount !== undefined &&
      ML_PRESETS.includes(initialValues.amount)
      ? initialValues.amount
      : null,
  );
  const [custom, setCustom] = useState(
    initialValues?.amount !== undefined &&
      !ML_PRESETS.includes(initialValues.amount)
      ? String(initialValues.amount)
      : "",
  );
  const [datetime, setDatetime] = useState(
    toLocalISO(initialValues?.timestamp ?? Date.now()),
  );

  const amount = preset ?? (custom ? parseInt(custom, 10) : null);
  const valid = amount && !isNaN(amount) && amount > 0;
  const d = DRINKS[drinkType];

  function handleSave() {
    if (!valid) return;
    onSave({
      drinkType,
      amount: amount!,
      timestamp: new Date(datetime).getTime(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-10">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm">
            {isEditing ? "Edit Drink Record" : "Record a Drink"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* drink type */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              Drink Type
            </p>
            <div className="grid grid-cols-5 gap-2">
              {DRINK_KEYS.map((dt) => {
                const selected = drinkType === dt;
                return (
                  <button
                    key={dt}
                    onClick={() => setDrinkType(dt)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-all"
                    style={{
                      borderColor: selected
                        ? DRINKS[dt].colorLight
                        : "var(--border)",
                      background: selected
                        ? DRINKS[dt].colorLight + "15"
                        : "transparent",
                    }}
                  >
                    <span className="text-xl leading-none">
                      {DRINKS[dt].emoji}
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{
                        color: selected
                          ? DRINKS[dt].colorLight
                          : "var(--muted-foreground)",
                      }}
                    >
                      {DRINKS[dt].label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* amount */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              Amount
            </p>
            <div className="grid grid-cols-5 gap-2 mb-2.5">
              {ML_PRESETS.map((ml) => {
                const selected = preset === ml;
                return (
                  <button
                    key={ml}
                    onClick={() => {
                      setPreset(ml);
                      setCustom("");
                    }}
                    className="flex flex-col items-center py-3 rounded-lg border-2 transition-all"
                    style={{
                      borderColor: selected ? d.colorLight : "var(--border)",
                      background: selected
                        ? d.colorLight + "15"
                        : "transparent",
                    }}
                  >
                    <Num
                      className="font-semibold text-sm leading-none"
                      style={{
                        color: selected ? d.colorLight : "var(--foreground)",
                      }}
                    >
                      {ml}
                    </Num>
                    <span
                      className="text-xs mt-0.5"
                      style={{
                        color: selected
                          ? d.colorLight
                          : "var(--muted-foreground)",
                      }}
                    >
                      ml
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Custom amount"
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value);
                  setPreset(null);
                }}
                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                style={{ fontFamily: "Inter, sans-serif" }}
              />
              <span className="text-sm text-muted-foreground shrink-0">ml</span>
            </div>
          </div>

          {/* date & time */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              Date & Time
            </p>
            <input
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              style={{ fontFamily: "Inter, sans-serif" }}
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              You can backdate this entry
            </p>
          </div>

          {/* save */}
          <button
            onClick={handleSave}
            disabled={!valid}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-35 disabled:cursor-not-allowed"
            style={{ background: d.colorLight }}
          >
            {valid
              ? isEditing
                ? `Save Changes · ${amount} ml · ${d.emoji} ${d.label}`
                : `Record ${amount} ml · ${d.emoji} ${d.label}`
              : "Select an amount to continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reminder Modal ───────────────────────────────────────────────────────────

function ReminderModal({
  onDrink,
  onSnooze,
  onSkip,
  snoozeDurations,
  todayWater,
  dailyGoal,
}: {
  onDrink: (ml: number) => void;
  onSnooze: (min: number) => void;
  onSkip: () => void;
  snoozeDurations: number[];
  todayWater: number;
  dailyGoal: number;
}) {
  const pct = Math.min((todayWater / dailyGoal) * 100, 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/25 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-10">
        {/* progress strip */}
        <div className="h-1 bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="px-5 pt-5 pb-4">
          {/* heading + progress label */}
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold text-foreground text-sm">
              Time to drink water
            </p>
            <Num className="text-xs text-muted-foreground">
              {Math.round(pct)}%
            </Num>
          </div>
          <Num className="text-xs text-muted-foreground block mb-5">
            {todayWater} / {dailyGoal} ml today
          </Num>

          {/* ── Drink Now ── */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Drink Now
          </p>
          <div className="grid grid-cols-5 gap-1.5 mb-5">
            {ML_PRESETS.map((ml) => (
              <button
                key={ml}
                onClick={() => onDrink(ml)}
                className="flex flex-col items-center py-3 rounded-lg border border-border hover:border-primary hover:bg-muted transition-all group"
              >
                <Num className="font-semibold text-sm text-foreground group-hover:text-primary leading-none">
                  {ml}
                </Num>
                <span className="text-xs text-muted-foreground mt-0.5">ml</span>
              </button>
            ))}
          </div>

          {/* ── Snooze ── */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Snooze
          </p>
          <div className="grid grid-cols-4 gap-1.5 mb-4">
            {snoozeDurations.map((min) => (
              <button
                key={min}
                onClick={() => onSnooze(min)}
                className="py-2.5 rounded-lg border border-border hover:border-primary hover:bg-muted text-foreground text-xs font-medium transition-all"
              >
                <Num>{min < 60 ? `${min}m` : `${min / 60}h`}</Num>
              </button>
            ))}
          </div>

          {/* ── Skip ── */}
          <button
            onClick={onSkip}
            className="w-full py-2 text-muted-foreground text-xs font-medium hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
          >
            <SkipForward className="w-3.5 h-3.5" /> Skip this reminder
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────

function SettingsPage({
  state,
  onSave,
  onTestReminder,
}: {
  state: AppState;
  onSave: (p: Partial<AppState>) => void;
  onTestReminder: () => void;
}) {
  const [goal, setGoal] = useState(state.dailyGoal);
  const [interval, setIntervalVal] = useState(state.reminderInterval);
  const [snoozes, setSnoozes] = useState(state.snoozeDurations.join(", "));
  const [enabled, setEnabled] = useState(state.reminderEnabled);
  const [soundChoice, setSoundChoice] = useState(state.soundChoice ?? "gentle");
  const [soundVolume, setSoundVolume] = useState(state.soundVolume ?? 0.7);
  const [soundEnabled, setSoundEnabled] = useState(state.soundEnabled ?? true);
  const [saved, setSaved] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied",
  );

  function save() {
    const parsed = snoozes
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
    onSave({
      dailyGoal: goal,
      reminderInterval: interval,
      snoozeDurations: parsed.length ? parsed : state.snoozeDurations,
      reminderEnabled: enabled,
      soundChoice,
      soundVolume,
      soundEnabled,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
      <button
        onClick={onToggle}
        className="relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0"
        style={{
          background: on ? "var(--primary)" : "var(--switch-background)",
        }}
      >
        <span
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
          style={{ left: on ? "24px" : "4px" }}
        />
      </button>
    );
  }

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <h2 className="font-semibold text-foreground text-base mb-0.5">
          Settings
        </h2>
        <p className="text-xs text-muted-foreground">
          Configure your hydration goals and reminder preferences
        </p>
      </div>

      {/* ── Hydration section ── */}
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {/* Goal */}
        <div className="px-5 py-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Daily Water Goal
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={goal}
              onChange={(e) => setGoal(Number(e.target.value))}
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              style={{ fontFamily: "Inter, sans-serif" }}
            />
            <span className="text-sm text-muted-foreground">ml / day</span>
          </div>
        </div>

        {/* Interval */}
        <div className="px-5 py-4">
          <label className="block text-sm font-medium text-foreground mb-3">
            Reminder Interval
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[15, 30, 45, 60].map((v) => (
              <button
                key={v}
                onClick={() => setIntervalVal(v)}
                className="py-2 rounded-lg border text-sm font-medium transition-all"
                style={{
                  borderColor:
                    interval === v ? "var(--primary)" : "var(--border)",
                  background: interval === v ? "var(--primary)" : "transparent",
                  color:
                    interval === v
                      ? "var(--primary-foreground)"
                      : "var(--muted-foreground)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {v}m
              </button>
            ))}
          </div>
        </div>

        {/* Snooze durations */}
        <div className="px-5 py-4">
          <label className="block text-sm font-medium text-foreground mb-1">
            Snooze Durations
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Comma-separated values in minutes
          </p>
          <input
            type="text"
            value={snoozes}
            onChange={(e) => setSnoozes(e.target.value)}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
            style={{ fontFamily: "Inter, sans-serif" }}
          />
        </div>

        {/* Reminders toggle */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Enable Reminders
            </p>
            <p className="text-xs text-muted-foreground">
              Show popup alerts on schedule
            </p>
          </div>
          <Toggle on={enabled} onToggle={() => setEnabled((e) => !e)} />
        </div>
      </div>

      {/* ── Sound section ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-0.5">
          Notification Sound
        </p>
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {/* Sound enabled toggle */}
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-primary" />
              ) : (
                <VolumeX className="w-4 h-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  Play Sound on Reminder
                </p>
                <p className="text-xs text-muted-foreground">
                  Plays audio when reminder popup appears
                </p>
              </div>
            </div>
            <Toggle
              on={soundEnabled}
              onToggle={() => setSoundEnabled((e) => !e)}
            />
          </div>

          {/* Sound picker */}
          <div className="px-5 py-4">
            <label className="block text-sm font-medium text-foreground mb-2.5">
              Sound
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SOUND_OPTIONS.map((s) => {
                const active = soundChoice === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSoundChoice(s.id)}
                    disabled={!soundEnabled}
                    className="py-2 px-3 rounded-lg border text-xs font-medium transition-all disabled:opacity-40"
                    style={{
                      borderColor: active ? "var(--primary)" : "var(--border)",
                      background: active ? "var(--primary)" : "transparent",
                      color: active
                        ? "var(--primary-foreground)"
                        : "var(--muted-foreground)",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Volume slider */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-sm font-medium text-foreground">
                Volume
              </label>
              <Num className="text-sm text-muted-foreground">
                {Math.round(soundVolume * 100)}%
              </Num>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={soundVolume}
              onChange={(e) => setSoundVolume(Number(e.target.value))}
              disabled={!soundEnabled}
              className="w-full accent-primary disabled:opacity-40"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={() => playTestSound(soundChoice, soundVolume)}
                disabled={!soundEnabled || soundChoice === "none"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Volume2 className="w-3.5 h-3.5" /> Test Sound
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Browser Notifications section ── */}
      {"Notification" in window && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-0.5">
            Browser Notifications
          </p>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {/* Permission row */}
            <div className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <Bell className="w-4 h-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    OS Notifications
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {notifPerm === "granted"
                      ? "Active — Chrome will show alerts even when tab is in background"
                      : notifPerm === "denied"
                        ? "Blocked — open browser Site Settings to allow"
                        : "Click Enable, then Allow in the browser prompt"}
                  </p>
                </div>
              </div>
              {notifPerm === "granted" ? (
                <span className="shrink-0 text-xs font-medium text-green-500 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
                  Allowed
                </span>
              ) : notifPerm === "denied" ? (
                <span className="shrink-0 text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 px-2.5 py-1 rounded-full">
                  Blocked
                </span>
              ) : (
                <button
                  onClick={async () => {
                    const granted = await requestNotificationPermission();
                    setNotifPerm(granted ? "granted" : "denied");
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all"
                >
                  Enable
                </button>
              )}
            </div>
            {/* Test row — only shown when granted */}
            {notifPerm === "granted" && (
              <div className="px-5 py-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Send a test notification right now
                </p>
                <button
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const timeStr = new Date().toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    });
                    try {
                      new Notification("Time to drink water 💧", {
                        body: `Test notification · ${timeStr}`,
                        tag: "hydraa-test",
                      });
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Bell className="w-3 h-3" /> Send Test
                </button>
              </div>
            )}
          </div>
          {notifPerm !== "granted" && (
            <p className="text-[11px] text-muted-foreground mt-2 px-0.5">
              ⚠️ Notifications only work when this tab is open. Chrome will show
              the alert even if you switch to another app or window.
            </p>
          )}
        </div>
      )}

      {/* Test reminder trigger */}
      <div className="bg-card border border-border rounded-xl px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            Test Reminder Popup
          </p>
          <p className="text-xs text-muted-foreground">
            Fires the reminder popup + OS notification immediately
          </p>
        </div>
        <button
          onClick={onTestReminder}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Bell className="w-3 h-3" /> Fire Now
        </button>
      </div>

      <button
        onClick={save}
        className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all"
      >
        {saved ? "Saved ✓" : "Save Changes"}
      </button>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  activeTab,
  setActiveTab,
  mode,
  setMode,
}: {
  activeTab: TabKey;
  setActiveTab: (t: TabKey) => void;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (themeRef.current && !themeRef.current.contains(e.target as Node))
        setThemeOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const THEME_OPTS: { key: ThemeMode; label: string; Icon: any }[] = [
    { key: "light", label: "Light", Icon: Sun },
    { key: "dark", label: "Dark", Icon: Moon },
  ];
  const CurrentIcon = mode === "light" ? Sun : Moon;

  const W = collapsed ? 60 : 220;

  return (
    <aside
      className="h-screen flex flex-col shrink-0 bg-card border-r border-border overflow-hidden relative z-20"
      style={{
        width: W,
        transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
        minWidth: W,
      }}
    >
      {/* Logo + collapse toggle */}
      <div
        className="flex items-center justify-between px-3 py-4 border-b border-border"
        style={{ minHeight: 56 }}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="text-xl shrink-0">💧</span>
          {!collapsed && (
            <span className="font-bold text-sm tracking-[0.15em] text-foreground whitespace-nowrap overflow-hidden">
              HYDRAA
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="p-1.5 rounded-lg transition-colors shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          title={collapsed ? "Expand menu" : "Collapse menu"}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-hidden">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              title={collapsed ? label : undefined}
              className={[
                "w-full flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors duration-150 relative",
                collapsed ? "justify-center px-0" : "px-2.5",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
              style={{ gap: collapsed ? 0 : 10 }}
            >
              {active && !collapsed && (
                <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary" />
              )}
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && (
                <span className="whitespace-nowrap overflow-hidden">
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Theme selector */}
      <div className="px-2 py-3 border-t border-border" ref={themeRef}>
        {collapsed ? (
          <div className="relative flex justify-center">
            <button
              onClick={() => setThemeOpen((o) => !o)}
              title="Theme"
              className="p-2.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <CurrentIcon className="w-4 h-4" />
            </button>
            {themeOpen && (
              <div
                className="absolute bottom-0 left-full ml-2 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50"
                style={{ minWidth: 130 }}
              >
                {THEME_OPTS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setMode(key);
                      setThemeOpen(false);
                    }}
                    className={[
                      "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-muted",
                      mode === key
                        ? "text-primary font-semibold"
                        : "text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground px-2 mb-1.5 uppercase tracking-wider font-medium">
              Theme
            </p>
            <div className="grid grid-cols-2 gap-1">
              {THEME_OPTS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  title={label}
                  className={[
                    "flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors duration-150",
                    mode === key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
let backupWriteQueue: Promise<void> = Promise.resolve();

export default function App() {
  const { mode, setMode, isDark } = useTheme();
  const [appState, setAppState] = useState<AppState>(() => getDefaultState());
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [showReminder, setShowReminder] = useState(false);
  const [showRecord, setShowRecord] = useState(false);
  const [dlFlash, setDlFlash] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HydrationRecord | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [snoozeTimer, setSnoozeTimer] = useState<{
    endsAt: number;
    pausedRemaining: number | null;
  } | null>(null);
  const [countdown, setCountdown] = useState("");
  const reminderRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snoozeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hydratedRef = useRef(false);
  // const exportQueuedRef = useRef(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const backupRootHandleRef = useRef<any>(null);
  // Always-fresh ref so callbacks closed in timeouts can read latest state
  const appStateRef = useRef(appState);
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  // ── Bootstrap: load from HYDRAA.xls (single source of truth)
  useEffect(() => {
    const saved = xlsLoad();
    setAppState(saved.state);
    setMode(saved.theme);
    hydratedRef.current = true;
    setLoaded(true);
    // Request notification permission after a user-trusted load event
    requestNotificationPermission();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Export updated HYDRAA.xls only after committed user actions.
  // useEffect(() => {
  //   if (!loaded || !hydratedRef.current || !exportQueuedRef.current) return;
  //   exportQueuedRef.current = false;
  //   void saveWorkbookToBackup(stateToXlsXml(appState, mode));
  // }, [appState, mode, loaded]);

  // function queueExport() {
  //   exportQueuedRef.current = true;
  // }

  let _backupWriteQueue: Promise<void> = Promise.resolve();

  async function saveWorkbookToBackup(xml: string): Promise<void> {
    const anyWindow = window as any;

    // Fallback for browsers that don't support File System Access API
    if (!anyWindow.showDirectoryPicker) {
      downloadXls(xml, "HYDRAA.xls");
      return;
    }

    // Queue writes so only one export happens at a time
    backupWriteQueue = backupWriteQueue
      .catch(() => {
        // Keep queue usable after a previous failure
      })
      .then(async () => {
        let root = backupRootHandleRef.current;

        // Ask for folder if we don't have one
        if (!root) {
          root = await anyWindow.showDirectoryPicker({
            mode: "readwrite",
          });

          backupRootHandleRef.current = root;
        }

        // Verify root permission
        let rootPermission = await root.queryPermission({
          mode: "readwrite",
        });

        if (rootPermission !== "granted") {
          rootPermission = await root.requestPermission({
            mode: "readwrite",
          });
        }

        if (rootPermission !== "granted") {
          throw new Error(
            "Permission to write to the selected folder was not granted.",
          );
        }

        // Open/create backup folder
        const backupDir = await root.getDirectoryHandle("backup", {
          create: true,
        });

        // Open/create HYDRAA.xls
        const fileHandle = await backupDir.getFileHandle("HYDRAA.xls", {
          create: true,
        });

        // Verify file permission
        let filePermission = await fileHandle.queryPermission({
          mode: "readwrite",
        });

        if (filePermission !== "granted") {
          filePermission = await fileHandle.requestPermission({
            mode: "readwrite",
          });
        }

        if (filePermission !== "granted") {
          throw new Error("Permission to write HYDRAA.xls was not granted.");
        }

        // Create writable stream
        const writable = await fileHandle.createWritable({
          keepExistingData: false,
        });

        try {
          await writable.write(xml);
        } finally {
          await writable.close();
        }

        console.log("HYDRAA.xls successfully exported to backup folder.");
      });

    return backupWriteQueue;
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const parsed = xlsToState(text);
      if (!parsed) {
        window.alert("That file could not be read as a HYDRAA.xls export.");
        return;
      }
      // exportQueuedRef.current = false;
      hydratedRef.current = true;
      setMode(parsed.theme);
      setAppState(parsed.state);
      setLoaded(true);
    } catch {
      window.alert("Could not import the selected file.");
    }
  }

  function openImportPicker() {
    importInputRef.current?.click();
  }

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Live countdown ticker for snooze timer
  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (!snoozeTimer) {
      setCountdown("");
      return;
    }
    const update = () => {
      setSnoozeTimer((st) => {
        if (!st) return st;
        if (st.pausedRemaining !== null) {
          const mm = Math.floor(st.pausedRemaining / 60000);
          const ss = Math.floor((st.pausedRemaining % 60000) / 1000);
          setCountdown(`${mm}:${String(ss).padStart(2, "0")}`);
          return st;
        }
        const rem = Math.max(0, st.endsAt - Date.now());
        const mm = Math.floor(rem / 60000);
        const ss = Math.floor((rem % 60000) / 1000);
        setCountdown(`${mm}:${String(ss).padStart(2, "0")}`);
        return st;
      });
    };
    update();
    countdownRef.current = setInterval(update, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [snoozeTimer]);

  // Play/stop sound when reminder modal shows/hides
  useEffect(() => {
    if (showReminder && appState.soundEnabled) {
      startReminderSound(appState.soundChoice, appState.soundVolume);
    } else {
      stopReminderSound();
    }
    return () => stopReminderSound();
  }, [
    showReminder,
    appState.soundEnabled,
    appState.soundChoice,
    appState.soundVolume,
  ]);

  const isHydratingFromExcelRef = useRef(true);

  useEffect(() => {
    if (isHydratingFromExcelRef.current) {
      return;
    }

    // queueExport();
  }, [appState]);

  const scheduleReminder = useCallback(
    (ms: number) => {
      if (reminderRef.current) clearTimeout(reminderRef.current);
      reminderRef.current = setTimeout(() => {
        const s = appStateRef.current;
        if (!s.reminderEnabled) return;
        setShowReminder(true);
        // setAppState((s) => {
        //   const today = new Date().toISOString().slice(0, 10);
        //   const todayWater = s.records
        //     .filter(
        //       (r) =>
        //         r.date === today &&
        //         r.type === "drink" &&
        //         r.drinkType === "water",
        //     )
        //     .reduce((sum, r) => sum + r.amount, 0);
        //   const goal = getGoalForDate(s, today);
        //   fireNativeNotification(todayWater, goal);
        //   setShowReminder(true);
        // });
      }, ms);
    },
    [appState.reminderEnabled],
  );

  useEffect(() => {
    if (appState.reminderEnabled)
      scheduleReminder(appState.reminderInterval * 60000);
    else if (reminderRef.current) clearTimeout(reminderRef.current);
    return () => {
      if (reminderRef.current) clearTimeout(reminderRef.current);
    };
  }, [appState.reminderEnabled, appState.reminderInterval, scheduleReminder]);

  // ── record helpers ────────────────────────────────────────────────────────

  function computeWaterTotal(date: string, amount: number, dt: DrinkType) {
    const prev = appState.records
      .filter(
        (r) => r.date === date && r.type === "drink" && r.drinkType === "water",
      )
      .reduce((s, r) => s + r.amount, 0);
    return dt === "water" ? prev + amount : prev;
  }

  function addRecord(patch: Omit<HydrationRecord, "id" | "dailyWaterTotal">) {
    const water =
      patch.type === "drink"
        ? computeWaterTotal(patch.date, patch.amount, patch.drinkType)
        : 0;
    const record: HydrationRecord = {
      id: patch.timestamp.toString(),
      dailyWaterTotal: water,
      ...patch,
    };
    setAppState((s) => ({
      ...s,
      records: [...s.records, record].sort((a, b) => b.timestamp - a.timestamp),
    }));
    // queueExport();
  }

  function clearSnoozeTimer() {
    if (snoozeRef.current) {
      clearTimeout(snoozeRef.current);
      snoozeRef.current = null;
    }
    setSnoozeTimer(null);
  }

  function handleReminderDrink(ml: number) {
    const ts = Date.now();
    const { date, time } = extractParts(ts);
    addRecord({
      date,
      time,
      timestamp: ts,
      amount: ml,
      drinkType: "water",
      type: "drink",
      source: "reminder",
    });
    clearSnoozeTimer();
    setShowReminder(false);
    scheduleReminder(appState.reminderInterval * 60000);
  }

  function handleManualRecord({
    drinkType,
    amount,
    timestamp,
  }: {
    drinkType: DrinkType;
    amount: number;
    timestamp: number;
  }) {
    const { date, time } = extractParts(timestamp);
    addRecord({
      date,
      time,
      timestamp,
      amount,
      drinkType,
      type: "drink",
      source: "manual",
    });
  }

  function handleUpdateRecord({
    drinkType,
    amount,
    timestamp,
  }: {
    drinkType: DrinkType;
    amount: number;
    timestamp: number;
  }) {
    if (!editingRecord) return;
    const { date, time } = extractParts(timestamp);
    const waterExcludingSelf = appState.records
      .filter(
        (r) =>
          r.date === date &&
          r.type === "drink" &&
          r.drinkType === "water" &&
          r.id !== editingRecord.id,
      )
      .reduce((s, r) => s + r.amount, 0);
    const dailyWaterTotal =
      drinkType === "water" ? waterExcludingSelf + amount : waterExcludingSelf;
    const updated: HydrationRecord = {
      ...editingRecord,
      date,
      time,
      timestamp,
      amount,
      drinkType,
      dailyWaterTotal,
    };
    setAppState((s) => ({
      ...s,
      records: s.records
        .map((r) => (r.id === editingRecord.id ? updated : r))
        .sort((a, b) => b.timestamp - a.timestamp),
    }));
    // queueExport();
    setEditingRecord(null);
  }

  function handleDeleteRecord(id: string) {
    setAppState((s) => ({
      ...s,
      records: s.records.filter((r) => r.id !== id),
    }));
    // queueExport();
    setDeletingId(null);
  }

  function handleSnooze(min: number) {
    const ts = Date.now();
    const { date, time } = extractParts(ts);
    addRecord({
      date,
      time,
      timestamp: ts,
      amount: 0,
      drinkType: "water",
      type: "snooze",
      source: "reminder",
      snoozeDuration: min,
    });
    setShowReminder(false);
    if (snoozeRef.current) clearTimeout(snoozeRef.current);
    const ms = min * 60000;
    snoozeRef.current = setTimeout(() => {
      setSnoozeTimer(null);
      setShowReminder(true);
    }, ms);
    setSnoozeTimer({ endsAt: Date.now() + ms, pausedRemaining: null });
  }

  function handlePauseSnooze() {
    if (!snoozeTimer || snoozeTimer.pausedRemaining !== null) return;
    const remaining = Math.max(0, snoozeTimer.endsAt - Date.now());
    if (snoozeRef.current) {
      clearTimeout(snoozeRef.current);
      snoozeRef.current = null;
    }
    setSnoozeTimer({ endsAt: snoozeTimer.endsAt, pausedRemaining: remaining });
  }

  function handleResumeSnooze() {
    if (!snoozeTimer || snoozeTimer.pausedRemaining === null) return;
    const ms = snoozeTimer.pausedRemaining;
    snoozeRef.current = setTimeout(() => {
      setSnoozeTimer(null);
      setShowReminder(true);
    }, ms);
    setSnoozeTimer({ endsAt: Date.now() + ms, pausedRemaining: null });
  }

  function handleCancelSnooze() {
    clearSnoozeTimer();
    scheduleReminder(appState.reminderInterval * 60000);
  }

  function handleSkip() {
    const ts = Date.now();
    const { date, time } = extractParts(ts);
    addRecord({
      date,
      time,
      timestamp: ts,
      amount: 0,
      drinkType: "water",
      type: "skip",
      source: "reminder",
    });
    clearSnoozeTimer();
    setShowReminder(false);
    scheduleReminder(appState.reminderInterval * 60000);
    // queueExport();
  }

  async function handleDownload() {
    const confirmed = window.confirm(
      "Do you want to export the current HYDRAA data and overwrite the existing HYDRAA.xls file?",
    );

    if (!confirmed) {
      return;
    }

    try {
      const xml = stateToXlsXml(appStateRef.current, mode);

      await saveWorkbookToBackup(xml);

      setDlFlash(true);

      setTimeout(() => {
        setDlFlash(false);
      }, 2000);

      console.log("HYDRAA export completed successfully.");
    } catch (error: any) {
      console.error("HYDRAA export failed:", error);

      if (error?.name === "AbortError") {
        window.alert(
          "Export cancelled. Please select the HYDRAA application folder to continue.",
        );
      } else {
        window.alert(
          `Unable to export HYDRAA.xls.\n\n${
            error?.message || "Unknown error occurred."
          }`,
        );
      }
    }
  }

  // ── derived ───────────────────────────────────────────────────────────────

  const today = todayStr();
  const todayGoal = getGoalForDate(appState, today);
  const todayRecs = appState.records.filter((r) => r.date === today);
  const todayDrinks = todayRecs.filter((r) => r.type === "drink");
  const todayWater = todayDrinks
    .filter((r) => r.drinkType === "water")
    .reduce((s, r) => s + r.amount, 0);
  const todayTotal = todayDrinks.reduce((s, r) => s + r.amount, 0);
  const drinkRecsAsc = [...todayDrinks].reverse();
  const firstDrink = drinkRecsAsc[0];
  const lastDrink = drinkRecsAsc[drinkRecsAsc.length - 1];
  const timeSinceLast = lastDrink
    ? formatAgo(Date.now() - lastDrink.timestamp)
    : "—";
  const pct = Math.min((todayWater / todayGoal) * 100, 100);
  const reminderRecs = todayRecs.filter((r) => r.source === "reminder");
  const todayByType = DRINK_KEYS.map((dt) => ({
    dt,
    amount: todayDrinks
      .filter((r) => r.drinkType === dt)
      .reduce((s, r) => s + r.amount, 0),
  })).filter((x) => x.amount > 0);

  const dailyData = buildDailyData(appState.records, 7);
  const monthlyData = buildMonthlyData(appState.records, 6);

  const allByType = DRINK_KEYS.map((dt) => ({
    dt,
    amount: appState.records
      .filter((r) => r.type === "drink" && r.drinkType === dt)
      .reduce((s, r) => s + r.amount, 0),
  }));
  const allTotal = allByType.reduce((s, x) => s + x.amount, 0);

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background font-sans">
        <div className="flex flex-col items-center gap-3">
          <span
            className="text-4xl"
            style={{ animation: "pulse 1.5s ease-in-out infinite" }}
          >
            💧
          </span>
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
            HYDRAA
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans">
      {/* ── SIDEBAR ── */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mode={mode}
        setMode={setMode}
      />

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* topBar */}
        <header className="h-14 shrink-0 bg-card border-b border-border flex items-center justify-between px-6 gap-3">
          {/* Snooze countdown widget */}
          <div className="flex items-center gap-2">
            {snoozeTimer ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border">
                <Bell className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Next reminder
                </span>
                <Num className="text-sm font-semibold text-foreground tabular-nums">
                  {countdown}
                </Num>
                {snoozeTimer.pausedRemaining !== null ? (
                  <button
                    onClick={handleResumeSnooze}
                    title="Resume snooze"
                    className="p-1 rounded hover:bg-border transition-colors text-primary"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handlePauseSnooze}
                    title="Pause snooze"
                    className="p-1 rounded hover:bg-border transition-colors text-muted-foreground"
                  >
                    <Pause className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={handleCancelSnooze}
                  title="Cancel snooze"
                  className="p-1 rounded hover:bg-border transition-colors text-muted-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRecord(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" /> Record Drink
            </button>
            <button
              onClick={openImportPicker}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors"
            >
              <Download className="w-3.5 h-3.5 rotate-180" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {dlFlash ? "Exported ✓" : "Export"}
              </span>
            </button>
            <button
              onClick={() => setShowReminder(true)}
              title="Preview reminder"
              className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <Bell className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </header>

        {/* scrollable content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* ─── DASHBOARD ─── */}
          {activeTab === "dashboard" && (
            <div className="space-y-5">
              {/* progress */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex flex-col md:flex-row md:items-end gap-5">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Total Intake · Today
                    </p>
                    <div className="flex items-baseline gap-2 mb-4">
                      <Num className="text-5xl font-bold text-foreground">
                        {todayTotal}
                      </Num>
                      <Num className="text-base text-muted-foreground">
                        / {todayGoal} ml
                      </Num>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden mb-1.5">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{
                          width: `${Math.min((todayTotal / todayGoal) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <Num>
                        {Math.round(
                          Math.min((todayTotal / todayGoal) * 100, 100),
                        )}
                        % of daily goal
                      </Num>
                      <Num>
                        {Math.max(todayGoal - todayTotal, 0)} ml remaining
                      </Num>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:w-48 shrink-0">
                    {[
                      { l: "Drinks", v: todayDrinks.length },
                      { l: "Since last", v: timeSinceLast },
                      {
                        l: "First",
                        v: firstDrink ? firstDrink.time.slice(0, 5) : "—",
                      },
                      {
                        l: "Last",
                        v: lastDrink ? lastDrink.time.slice(0, 5) : "—",
                      },
                    ].map(({ l, v }) => (
                      <div key={l} className="bg-muted rounded-lg px-3 py-2.5">
                        <p className="text-xs text-muted-foreground mb-0.5">
                          {l}
                        </p>
                        <Num className="text-sm font-semibold text-foreground">
                          {v}
                        </Num>
                      </div>
                    ))}
                  </div>
                </div>

                {todayByType.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
                    {todayByType.map(({ dt, amount }) => (
                      <div
                        key={dt}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-sm"
                      >
                        <DrinkDot type={dt} isDark={isDark} />
                        <span className="text-foreground font-medium">
                          {DRINKS[dt].label}
                        </span>
                        <Num className="text-muted-foreground">{amount} ml</Num>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* stat row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="Total today"
                  value={`${todayTotal} ml`}
                  sub={`${todayDrinks.length} entries`}
                />
                <StatCard
                  label="Today's goal"
                  value={`${todayGoal} ml`}
                  sub={
                    todayGoal !== appState.dailyGoal
                      ? `Default: ${appState.dailyGoal} ml`
                      : undefined
                  }
                />
                <StatCard
                  label="Reminder every"
                  value={`${appState.reminderInterval} min`}
                  sub={appState.reminderEnabled ? "Active" : "Paused"}
                />
                <StatCard
                  label="Reminders today"
                  value={String(reminderRecs.length)}
                  sub={`${reminderRecs.filter((r) => r.type === "drink").length} done · ${reminderRecs.filter((r) => r.type === "snooze").length} snoozed · ${reminderRecs.filter((r) => r.type === "skip").length} skipped`}
                />
              </div>

              {/* 7-day chart */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      Last 7 Days — All Beverages
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Stacked daily intake by drink type
                    </p>
                  </div>
                  <DrinkLegend data={dailyData} isDark={isDark} />
                </div>
                <DrinkAreaChart
                  data={dailyData}
                  isDark={isDark}
                  goalLine={todayGoal}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Dashed line = today's goal ({todayGoal} ml)
                </p>
              </div>
            </div>
          )}

          {/* ─── HISTORY ─── */}
          {activeTab === "history" && (
            <div className="max-w-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-foreground text-sm">
                    Drink History
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {appState.records.length} total records
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {DRINK_KEYS.map((dt) => {
                    const cnt = appState.records.filter(
                      (r) => r.type === "drink" && r.drinkType === dt,
                    ).length;
                    if (!cnt) return null;
                    return (
                      <span
                        key={dt}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <DrinkDot type={dt} isDark={isDark} />{" "}
                        {DRINKS[dt].label} ×{cnt}
                      </span>
                    );
                  })}
                </div>
              </div>

              {appState.records.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                  <p className="text-muted-foreground text-sm">
                    No records yet. Click{" "}
                    <strong className="text-foreground">Record Drink</strong> to
                    get started.
                  </p>
                </div>
              ) : (
                (() => {
                  const grouped: Record<string, HydrationRecord[]> = {};
                  appState.records.forEach((r) => {
                    if (!grouped[r.date]) grouped[r.date] = [];
                    grouped[r.date].push(r);
                  });
                  return (
                    <div className="space-y-3">
                      {Object.entries(grouped).map(([date, recs]) => {
                        const dayWater = recs
                          .filter(
                            (r) =>
                              r.type === "drink" && r.drinkType === "water",
                          )
                          .reduce((s, r) => s + r.amount, 0);
                        const dayTotal = recs
                          .filter((r) => r.type === "drink")
                          .reduce((s, r) => s + r.amount, 0);
                        return (
                          <div
                            key={date}
                            className="bg-card border border-border rounded-xl overflow-hidden"
                          >
                            <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
                              <p className="text-sm font-semibold text-foreground">
                                {new Date(
                                  date + "T12:00:00",
                                ).toLocaleDateString("en-US", {
                                  weekday: "long",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                              <div className="flex gap-3 text-xs text-muted-foreground">
                                <Num>💧 {dayWater} ml</Num>
                                {dayTotal !== dayWater && (
                                  <Num>Total {dayTotal} ml</Num>
                                )}
                              </div>
                            </div>
                            <div className="divide-y divide-border">
                              {recs.map((r) => {
                                if (r.type === "drink") {
                                  const d = DRINKS[r.drinkType];
                                  const isDeleting = deletingId === r.id;
                                  return (
                                    <div key={r.id}>
                                      <div className="flex items-center gap-3 px-4 py-3 group">
                                        <DrinkDot
                                          type={r.drinkType}
                                          isDark={isDark}
                                        />
                                        <div className="flex-1 flex items-center gap-2 min-w-0">
                                          <span className="text-sm font-medium text-foreground">
                                            {d.label}
                                          </span>
                                          {r.source === "manual" && (
                                            <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
                                              manual
                                            </span>
                                          )}
                                        </div>
                                        <Num
                                          className="text-sm font-semibold shrink-0"
                                          style={{
                                            color: isDark
                                              ? d.colorDark
                                              : d.colorLight,
                                          }}
                                        >
                                          +{r.amount} ml
                                        </Num>
                                        <Num className="text-xs text-muted-foreground w-10 text-right shrink-0">
                                          {r.time.slice(0, 5)}
                                        </Num>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                          <button
                                            onClick={() => {
                                              setEditingRecord(r);
                                              setShowRecord(true);
                                            }}
                                            title="Edit record"
                                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => setDeletingId(r.id)}
                                            title="Delete record"
                                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                      {isDeleting && (
                                        <div className="mx-4 mb-3 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-between gap-3">
                                          <p className="text-xs text-foreground">
                                            Delete this record permanently?
                                          </p>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <button
                                              onClick={() =>
                                                handleDeleteRecord(r.id)
                                              }
                                              className="px-3 py-1 rounded-md bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                                            >
                                              Delete
                                            </button>
                                            <button
                                              onClick={() =>
                                                setDeletingId(null)
                                              }
                                              className="px-3 py-1 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                const label =
                                  r.type === "snooze"
                                    ? `Snoozed${r.snoozeDuration ? ` ${r.snoozeDuration}m` : ""}`
                                    : "Skipped";
                                return (
                                  <div
                                    key={r.id}
                                    className="flex items-center gap-3 px-4 py-2.5 opacity-45"
                                  >
                                    <span className="w-2.5 h-2.5 rounded-full bg-border shrink-0" />
                                    <span className="text-sm text-muted-foreground flex-1">
                                      {label}
                                    </span>
                                    <Num className="text-xs text-muted-foreground">
                                      {r.time.slice(0, 5)}
                                    </Num>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* ─── TRENDS ─── */}
          {activeTab === "trends" && (
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold text-foreground text-sm">
                  Trends
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All beverages tracked over time
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="All-time water"
                  value={`${allByType.find((x) => x.dt === "water")?.amount ?? 0} ml`}
                />
                <StatCard
                  label="Total beverages"
                  value={`${allTotal} ml`}
                  sub={`${appState.records.filter((r) => r.type === "drink").length} entries`}
                />
                <StatCard
                  label="Reminders"
                  value={String(
                    appState.records.filter((r) => r.source === "reminder")
                      .length,
                  )}
                  sub={`${appState.records.filter((r) => r.type === "snooze").length} snoozed · ${appState.records.filter((r) => r.type === "skip").length} skipped`}
                />
                <StatCard
                  label="Manual entries"
                  value={String(
                    appState.records.filter(
                      (r) => r.type === "drink" && r.source === "manual",
                    ).length,
                  )}
                />
              </div>

              {/* 7-day */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      Last 7 Days — All Beverages
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Dashed line = water goal
                    </p>
                  </div>
                  <DrinkLegend data={dailyData} isDark={isDark} />
                </div>
                <DrinkGroupedBarChart
                  data={dailyData}
                  isDark={isDark}
                  height={220}
                  goalLine={todayGoal}
                />
              </div>

              {/* 6-month */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      Last 6 Months — All Beverages
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Monthly totals per drink type
                    </p>
                  </div>
                  <DrinkLegend data={monthlyData} isDark={isDark} />
                </div>
                <DrinkLineChart
                  data={monthlyData}
                  isDark={isDark}
                  height={220}
                />
              </div>

              {/* breakdown table */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <p className="font-semibold text-foreground text-sm">
                    All-Time Beverage Breakdown
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {allByType.map(({ dt, amount }) => {
                    const share = allTotal > 0 ? (amount / allTotal) * 100 : 0;
                    return (
                      <div
                        key={dt}
                        className="px-5 py-3.5 flex items-center gap-4"
                      >
                        <DrinkDot type={dt} isDark={isDark} />
                        <span className="text-sm font-medium text-foreground w-14">
                          {DRINKS[dt].label}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${share}%`,
                              background: isDark
                                ? DRINKS[dt].colorDark
                                : DRINKS[dt].colorLight,
                            }}
                          />
                        </div>
                        <Num className="text-sm text-foreground font-medium w-20 text-right">
                          {amount} ml
                        </Num>
                        <Num className="text-xs text-muted-foreground w-8 text-right">
                          {Math.round(share)}%
                        </Num>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── SETTINGS ─── */}
          {activeTab === "settings" && (
            <SettingsPage
              state={appState}
              onTestReminder={() => {
                const s = appStateRef.current;
                const todayDate = new Date().toISOString().slice(0, 10);
                const todayWater = s.records
                  .filter(
                    (r) =>
                      r.date === todayDate &&
                      r.type === "drink" &&
                      r.drinkType === "water",
                  )
                  .reduce((sum, r) => sum + r.amount, 0);
                const goal = getGoalForDate(s, todayDate);
                fireNativeNotification(todayWater, goal);
                setShowReminder(true);
              }}
              onSave={(p) =>
                setAppState((s) => {
                  const next = { ...s, ...p };
                  // If the default goal changed, also record it as today's goal
                  if (
                    p.dailyGoal !== undefined &&
                    p.dailyGoal !== s.dailyGoal
                  ) {
                    const existing = next.dailyGoals.filter(
                      (g) => g.date !== today,
                    );
                    next.dailyGoals = [
                      ...existing,
                      { date: today, goal: p.dailyGoal },
                    ];
                  }
                  // queueExport();
                  return next;
                })
              }
            />
          )}
        </main>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept=".xls,.xml,text/xml,application/vnd.ms-excel"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          await handleImportFile(file);
        }}
      />

      {/* ── MODALS ── */}
      {showRecord && (
        <RecordDrinkModal
          onSave={editingRecord ? handleUpdateRecord : handleManualRecord}
          onClose={() => {
            setShowRecord(false);
            setEditingRecord(null);
          }}
          initialValues={
            editingRecord
              ? {
                  drinkType: editingRecord.drinkType,
                  amount: editingRecord.amount,
                  timestamp: editingRecord.timestamp,
                }
              : undefined
          }
        />
      )}
      {showReminder && (
        <ReminderModal
          onDrink={handleReminderDrink}
          onSnooze={handleSnooze}
          onSkip={handleSkip}
          snoozeDurations={appState.snoozeDurations}
          todayWater={todayWater}
          dailyGoal={todayGoal}
        />
      )}
    </div>
  );
}
