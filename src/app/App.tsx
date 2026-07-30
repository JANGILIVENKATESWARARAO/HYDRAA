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
  ChevronDown,
  Martini,
  Menu,
} from "lucide-react";
import { Toaster, toast } from "sonner";

// ─── Google Sheets Integration Setup ──────────────────────────────────────────
const GOOGLE_SHEET_ID = "1AA1bEa8v-qe6LFiwcc6l6pFsaJH1cfOHCgrTtakNVyA";
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxYPPams6SOWQrgKGP7SmInZ8Eu-QPBm42UXgtX-zOAhZhIaVXu7zY1hUAX3cbTX1eJ/exec";

// Public CSV export endpoint from Google Sheets
const GOOGLE_FETCH_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv`;

interface GoogleSheetStatePayload {
  state?: unknown;
  theme?: unknown;
  data?: {
    state?: unknown;
    theme?: unknown;
  };
  xml?: string;
}

function decodeSingleCellCsv(csv: string): string | null {
  const text = csv.trim();
  if (!text) return null;

  // If it is not a quoted CSV cell, return raw text.
  if (!text.startsWith('"')) return text;

  let i = 1;
  let out = "";
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      if (text[i + 1] === '"') {
        out += '"';
        i += 2;
        continue;
      }
      return out;
    }
    out += ch;
    i += 1;
  }

  return out;
}

// ─── Sound System ────────────────────────────────────────────────────────────

const SOUND_FILE_BY_ID = Object.fromEntries(
  Object.entries(
    import.meta.glob("../assets/sounds/*.{mp3,wav,ogg,m4a}", {
      eager: true,
      import: "default",
    }) as Record<string, string>,
  )
    .map(([path, src]) => [path.split("/").pop() ?? path, src])
    .sort(([a], [b]) => a.localeCompare(b)),
) as Record<string, string>;

function getDefaultSoundChoice() {
  return Object.keys(SOUND_FILE_BY_ID)[0] ?? "none";
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}

export const SOUND_OPTIONS = [
  ...Object.keys(SOUND_FILE_BY_ID).map((fileName) => ({
    id: fileName,
    label: stripFileExtension(fileName),
  })),
  { id: "none", label: "silent" },
];
const SOUND_OPTION_IDS = new Set(SOUND_OPTIONS.map((s) => s.id));

let _soundLoopId: ReturnType<typeof setInterval> | null = null;

function _soundRepeatMs() {
  return 2000;
}

let _activeSoundAudio: HTMLAudioElement | null = null;

function playAssetSound(type: string, volume: number) {
  const src = SOUND_FILE_BY_ID[type];
  if (!src) return;

  try {
    if (!_activeSoundAudio) {
      _activeSoundAudio = new Audio(src);
    } else if (_activeSoundAudio.src !== src) {
      _activeSoundAudio.src = src;
    }

    _activeSoundAudio.pause();
    _activeSoundAudio.currentTime = 0;

    _activeSoundAudio.volume = Math.max(0, Math.min(1, volume));

    void _activeSoundAudio.play();
  } catch (error) {
    console.error("Unable to play reminder sound:", error);
  }
}

function startReminderSound(type: string, volume: number) {
  stopReminderSound();
  if (type === "none") return;

  playAssetSound(type, volume);

  _soundLoopId = setInterval(() => {
    playAssetSound(type, volume);
  }, _soundRepeatMs());
}

function stopReminderSound() {
  if (_soundLoopId !== null) {
    clearInterval(_soundLoopId);
    _soundLoopId = null;
  }

  if (_activeSoundAudio) {
    _activeSoundAudio.pause();
    _activeSoundAudio.currentTime = 0;
  }
}

async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function getNotificationIconUrl() {
  return `${window.location.origin}/favicon.ico`;
}

const DEFAULT_NOTIFICATION_DRINK_AMOUNT = 100;
const DEFAULT_NOTIFICATION_SNOOZE_MINUTES = 10;

function normalizeNotificationQuickDrinkAmount(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) {
    return DEFAULT_NOTIFICATION_DRINK_AMOUNT;
  }
  return Math.min(n, 2000);
}

function normalizeNotificationQuickSnoozeMinutes(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) {
    return DEFAULT_NOTIFICATION_SNOOZE_MINUTES;
  }
  return Math.min(n, 240);
}

type ReminderNotificationAction =
  | "hydraa-open-reminder"
  | "hydraa-skip"
  | `hydraa-drink-${number}`
  | `hydraa-snooze-${number}`;

const REMINDER_NOTIFICATION_EVENT = "hydraa:notification-action";

function getReminderNotificationActions(
  drinkAmount: number,
  snoozeMinutes: number,
): NotificationAction[] {
  return [
    {
      action: `hydraa-drink-${drinkAmount}`,
      title: `Drink ${drinkAmount} ml`,
    },
    {
      action: `hydraa-snooze-${snoozeMinutes}`,
      title: `Snooze ${snoozeMinutes}m`,
    },
    { action: "hydraa-skip", title: "Skip" },
  ];
}

async function sendOsNotification({
  title,
  body,
  tagPrefix,
  allowReminderActions = false,
  reminderActionSettings,
}: {
  title: string;
  body: string;
  tagPrefix: string;
  allowReminderActions?: boolean;
  reminderActionSettings?: {
    drinkAmount: number;
    snoozeMinutes: number;
  };
}) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const notificationId = `${tagPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const icon = getNotificationIconUrl();
  const drinkAmount = normalizeNotificationQuickDrinkAmount(
    reminderActionSettings?.drinkAmount,
  );
  const snoozeMinutes = normalizeNotificationQuickSnoozeMinutes(
    reminderActionSettings?.snoozeMinutes,
  );

  // 1) Preferred path for browsers that support SW notifications.
  try {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.showNotification) {
        await registration.showNotification(title, {
          body,
          icon,
          tag: notificationId,
          requireInteraction: true,
          renotify: true,
          data: {
            kind: "hydraa-reminder",
            action: "hydraa-open-reminder",
          },
          actions: allowReminderActions
            ? getReminderNotificationActions(drinkAmount, snoozeMinutes)
            : [],
        });
        return;
      }
    }
  } catch {
    // Fall through to standard Notification API.
  }

  // 2) Broad fallback for browsers that support window notifications.
  try {
    const notification = new Notification(title, {
      body,
      icon,
      tag: notificationId,
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      window.dispatchEvent(
        new CustomEvent(REMINDER_NOTIFICATION_EVENT, {
          detail: {
            action: "hydraa-open-reminder" as ReminderNotificationAction,
          },
        }),
      );
      notification.close();
    };

    // Prevent an endless pile-up while still allowing repeated alerts.
    setTimeout(() => notification.close(), 15000);
  } catch {
    // No further fallback available at runtime.
  }
}

async function fireNativeNotification(
  todayWater: number,
  goal: number,
  reminderActionSettings: {
    drinkAmount: number;
    snoozeMinutes: number;
  },
) {
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

  await sendOsNotification({
    title,
    body,
    tagPrefix: "hydraa-reminder",
    allowReminderActions: true,
    reminderActionSettings,
  });
}

function playTestSound(type: string, volume: number) {
  if (type === "none") return;
  playAssetSound(type, volume);
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
  notificationQuickDrinkAmount: number;
  notificationQuickSnoozeMinutes: number;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function normalizeSoundChoice(value: unknown): string {
  return typeof value === "string" && SOUND_OPTION_IDS.has(value)
    ? value
    : getDefaultSoundChoice();
}

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
    soundChoice: getDefaultSoundChoice(),
    soundVolume: 0.7,
    soundEnabled: true,
    notificationQuickDrinkAmount: DEFAULT_NOTIFICATION_DRINK_AMOUNT,
    notificationQuickSnoozeMinutes: DEFAULT_NOTIFICATION_SNOOZE_MINUTES,
  };
}

function mergeDefaults(partial: any): AppState {
  return { ...getDefaultState(), ...(partial ?? {}) };
}

function normalizeDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-CA");
  }

  const fallback = new Date(`1970-01-01T${trimmed}`);
  if (!isNaN(fallback.getTime())) {
    return fallback.toLocaleDateString("en-CA");
  }

  return trimmed;
}

function normalizeTime(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toTimeString().slice(0, 8);
  }

  const fallback = new Date(`1970-01-01T${trimmed}`);
  if (!isNaN(fallback.getTime())) {
    return fallback.toTimeString().slice(0, 8);
  }

  return trimmed;
}

function ensureUniqueRecordIds(records: HydrationRecord[]): HydrationRecord[] {
  const seen = new Map<string, number>();

  return records.map((record) => {
    const baseId = String(record.id || record.timestamp);
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);

    const nextId = count === 0 ? baseId : `${baseId}-${count + 1}`;
    if (nextId === record.id) return record;

    return {
      ...record,
      id: nextId,
    };
  });
}

function normalizeSheetState(state: any): AppState {
  const normalized = mergeDefaults(state);
  normalized.soundChoice = normalizeSoundChoice(normalized.soundChoice);
  normalized.soundVolume = Math.max(
    0,
    Math.min(1, Number(normalized.soundVolume) || 0.7),
  );
  normalized.notificationQuickDrinkAmount =
    normalizeNotificationQuickDrinkAmount(
      normalized.notificationQuickDrinkAmount,
    );
  normalized.notificationQuickSnoozeMinutes =
    normalizeNotificationQuickSnoozeMinutes(
      normalized.notificationQuickSnoozeMinutes,
    );

  normalized.records = Array.isArray(state?.records)
    ? ensureUniqueRecordIds(
        state.records
          .map((record: any, index: number) => {
            const date = normalizeDate(record?.date);
            const time = normalizeTime(record?.time);
            const timestamp = Number(record?.timestamp) || Date.now() + index;

            return {
              ...record,
              id: record?.id ? String(record.id) : String(timestamp),
              date: date || normalizeDate(new Date(timestamp).toString()),
              time: time || normalizeTime(new Date(timestamp).toTimeString()),
              timestamp,
              amount: Number(record?.amount) || 0,
              drinkType:
                typeof record?.drinkType === "string" && record.drinkType
                  ? record.drinkType
                  : "water",
              type:
                record?.type === "snooze" || record?.type === "skip"
                  ? record.type
                  : "drink",
              source: record?.source === "reminder" ? "reminder" : "manual",
              snoozeDuration: Number(record?.snoozeDuration) || undefined,
              dailyWaterTotal: Number(record?.dailyWaterTotal) || 0,
            };
          })
          .sort((a, b) => b.timestamp - a.timestamp),
      )
    : [];

  normalized.dailyGoals = Array.isArray(state?.dailyGoals)
    ? state.dailyGoals.map((goal: any) => ({
        date: normalizeDate(goal?.date),
        goal: Number(goal?.goal) || 0,
      }))
    : [];

  return normalized;
}

function parseTheme(theme: unknown): ThemeMode {
  return theme === "light" || theme === "dark" ? theme : "dark";
}

function parseSheetResponseToState(
  text: string,
  contentType: string | null,
): { state: AppState; theme: ThemeMode } | null {
  const trimmed = text.trim();

  // Public Google Sheet endpoint may return a single quoted CSV cell containing JSON.
  if (contentType?.includes("text/csv")) {
    const decoded = decodeSingleCellCsv(trimmed) ?? trimmed;
    if (decoded !== trimmed) {
      return parseSheetResponseToState(decoded, null);
    }
  }

  if (
    trimmed.startsWith('"') &&
    trimmed.endsWith('"') &&
    !trimmed.includes("\n")
  ) {
    const decoded = decodeSingleCellCsv(trimmed);
    if (decoded !== null && decoded !== trimmed) {
      return parseSheetResponseToState(decoded, null);
    }
  }

  // Apps Script JSON response path
  if (
    contentType?.includes("application/json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[")
  ) {
    try {
      const payload = JSON.parse(trimmed) as GoogleSheetStatePayload;
      const maybeState = payload?.state ?? payload?.data?.state;
      if (maybeState && typeof maybeState === "object") {
        return {
          state: normalizeSheetState(maybeState),
          theme: parseTheme(payload?.theme ?? payload?.data?.theme),
        };
      }
    } catch {
      // Ignore invalid JSON; no local fallback.
    }
  }

  return null;
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

function downloadBlob(blob: Blob, filename: string) {
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

function getAverageConsumptionMinutesForRecords(records: HydrationRecord[]) {
  const drinks = records
    .filter((r) => r.type === "drink")
    .sort((a, b) => {
      const aTime = new Date(`${a.date}T${a.time}`).getTime();
      const bTime = new Date(`${b.date}T${b.time}`).getTime();
      return aTime - bTime;
    });

  if (drinks.length < 2) {
    return null;
  }

  let totalMinutes = 0;
  for (let i = 1; i < drinks.length; i++) {
    const previous = new Date(
      `${drinks[i - 1].date}T${drinks[i - 1].time}`,
    ).getTime();
    const current = new Date(`${drinks[i].date}T${drinks[i].time}`).getTime();
    totalMinutes += (current - previous) / 60000;
  }

  return Math.round(totalMinutes / (drinks.length - 1));
}

function formatMinutesAsDuration(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes)) return "--";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function buildDailyAverageIntervalData(records: HydrationRecord[], days = 7) {
  const result: Array<{
    date: string;
    label: string;
    avgMinutes: number | null;
    drinksCount: number;
  }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toLocaleDateString("en-CA");
    const dayRecords = records.filter(
      (r) => r.type === "drink" && r.date === date,
    );

    result.push({
      date,
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      avgMinutes: getAverageConsumptionMinutesForRecords(dayRecords),
      drinksCount: dayRecords.length,
    });
  }

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

function ChartTooltip({ active, payload, label, isDark }: any) {
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
              {(() => {
                const drinkType = p.dataKey as DrinkType;
                const markerColor = DRINKS[drinkType]
                  ? isDark
                    ? DRINKS[drinkType].colorDark
                    : DRINKS[drinkType].colorLight
                  : p.stroke || p.fill;
                return (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: markerColor }}
                  />
                );
              })()}
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
  const gridColor = isDark ? "#FFFFFF0D" : "#0000000D";
  const hoverFill = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
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
        <Tooltip
          content={<ChartTooltip isDark={isDark} />}
          cursor={{ fill: hoverFill }}
        />
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
          const isActive = activeDrinks.includes(dt);
          return (
            <Area
              key={`area-${dt}`}
              type="monotone"
              dataKey={dt}
              stackId="a"
              stroke={color}
              strokeWidth={isActive ? 1.5 : 0}
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
  const gridColor = isDark ? "#FFFFFF0D" : "#0000000D";
  const hoverFill = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
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
          content={<ChartTooltip isDark={isDark} />}
          cursor={{
            fill: hoverFill,
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
  const gridColor = isDark ? "#FFFFFF0D" : "#0000000D";
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
        <Tooltip content={<ChartTooltip isDark={isDark} />} />
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

function AvgIntervalTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value as number | null;
  const count = payload[0]?.payload?.drinksCount as number;

  return (
    <div className="rounded-lg border border-border bg-card shadow-lg px-3 py-2.5 text-xs min-w-[160px]">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="text-muted-foreground">Avg interval</span>
        <Num className="text-foreground font-semibold">
          {formatMinutesAsDuration(value)}
        </Num>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Drink entries</span>
        <Num className="text-foreground">{count ?? 0}</Num>
      </div>
    </div>
  );
}

function AvgConsumptionIntervalChart({
  data,
  isDark,
  height = 220,
}: {
  data: Array<{
    date: string;
    label: string;
    avgMinutes: number | null;
    drinksCount: number;
  }>;
  isDark: boolean;
  height?: number;
}) {
  const tickColor = isDark ? "#5F5F5F" : "#7C7C7C";
  const gridColor = isDark ? "#FFFFFF0D" : "#0000000D";
  const lineColor = isDark ? "#38bdf8" : "#0284c7";

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
          width={52}
          unit="m"
        />
        <Tooltip content={<AvgIntervalTooltip />} />
        <Line
          type="monotone"
          dataKey="avgMinutes"
          stroke={lineColor}
          strokeWidth={2.25}
          connectNulls={false}
          dot={{ fill: lineColor, r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
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
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
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
  isSaving,
}: {
  state: AppState;
  onSave: (p: Partial<AppState>) => Promise<boolean>;
  onTestReminder: () => void;
  isSaving: boolean;
}) {
  const today = todayStr();
  const [goal, setGoal] = useState(getGoalForDate(state, today));
  const [interval, setIntervalVal] = useState(state.reminderInterval);
  const [snoozes, setSnoozes] = useState(state.snoozeDurations.join(", "));
  const [enabled, setEnabled] = useState(state.reminderEnabled);
  const [soundChoice, setSoundChoice] = useState(
    normalizeSoundChoice(state.soundChoice),
  );
  const [soundVolume, setSoundVolume] = useState(state.soundVolume ?? 0.7);
  const [soundEnabled, setSoundEnabled] = useState(state.soundEnabled ?? true);
  const [notificationQuickDrinkAmount, setNotificationQuickDrinkAmount] =
    useState(state.notificationQuickDrinkAmount);
  const [notificationQuickSnoozeMinutes, setNotificationQuickSnoozeMinutes] =
    useState(state.notificationQuickSnoozeMinutes);
  const [saved, setSaved] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied",
  );
  const browserUserAgent =
    typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
  const isEdgeBrowser = browserUserAgent.includes("edg/");
  const notificationApiAvailable = "Notification" in window;
  const serviceWorkerNotificationAvailable =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    window.isSecureContext;

  useEffect(() => {
    setGoal(getGoalForDate(state, today));
  }, [state.dailyGoals, state.dailyGoal, today]);

  async function save() {
    if (isSaving) return;
    const parsed = snoozes
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
    const ok = await onSave({
      dailyGoal: goal,
      reminderInterval: interval,
      snoozeDurations: parsed.length ? parsed : state.snoozeDurations,
      reminderEnabled: enabled,
      soundChoice,
      soundVolume,
      soundEnabled,
      notificationQuickDrinkAmount: normalizeNotificationQuickDrinkAmount(
        notificationQuickDrinkAmount,
      ),
      notificationQuickSnoozeMinutes: normalizeNotificationQuickSnoozeMinutes(
        notificationQuickSnoozeMinutes,
      ),
    });
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
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
            Today's Water Goal
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <input
              type="number"
              value={goal}
              onChange={(e) => setGoal(Number(e.target.value))}
              className="w-full sm:flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:border-primary"
              style={{ fontFamily: "Inter, sans-serif" }}
            />
            <span className="text-sm text-muted-foreground sm:shrink-0">
              ml / day
            </span>
          </div>
        </div>

        {/* Interval */}
        <div className="px-5 py-4">
          <label className="block text-sm font-medium text-foreground mb-3">
            Reminder Interval
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:border-primary"
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
          <div className="px-5 py-4 flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-primary" />
              ) : (
                <VolumeX className="w-4 h-4 text-muted-foreground" />
              )}
              <div className="min-w-0">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
          <p className="text-[11px] text-muted-foreground mb-2 px-0.5">
            Status: Permission{" "}
            <span
              className={
                notifPerm === "granted"
                  ? "font-semibold text-green-500"
                  : "font-semibold text-red-500"
              }
            >
              {notifPerm}
            </span>{" "}
            · Web Notification API{" "}
            <span
              className={
                notificationApiAvailable
                  ? "font-semibold text-green-500"
                  : "font-semibold text-red-500"
              }
            >
              {notificationApiAvailable ? "available" : "unavailable"}
            </span>{" "}
            · Service Worker notifications{" "}
            <span
              className={
                serviceWorkerNotificationAvailable
                  ? "font-semibold text-green-500"
                  : "font-semibold text-red-500"
              }
            >
              {serviceWorkerNotificationAvailable ? "available" : "unavailable"}
            </span>
          </p>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm font-medium text-foreground">
                Reminder Quick Actions
              </p>
              <p className="text-xs text-muted-foreground">
                Configure buttons shown in OS notification. Skip is always
                included.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">
                    Drink Amount (ml)
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={notificationQuickDrinkAmount}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setNotificationQuickDrinkAmount(
                        Number.isFinite(next) ? next : 0,
                      );
                    }}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:border-primary"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">
                    Snooze (minutes)
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={notificationQuickSnoozeMinutes}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setNotificationQuickSnoozeMinutes(
                        Number.isFinite(next) ? next : 0,
                      );
                    }}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:border-primary"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  />
                </label>
              </div>
            </div>
            {/* Permission row */}
            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <Bell className="w-4 h-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    OS Notifications
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {notifPerm === "granted"
                      ? "Active — notifications should appear even when the tab is in background"
                      : notifPerm === "denied"
                        ? isEdgeBrowser
                          ? "Blocked — in Edge, click the lock icon in the address bar, open Site permissions, and allow Notifications"
                          : "Blocked — open site permissions in your browser and allow Notifications"
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
              <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Send a test notification right now
                </p>
                <button
                  onClick={async () => {
                    const timeStr = new Date().toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    });
                    await sendOsNotification({
                      title: "Time to drink water 💧",
                      body: `Test notification · ${timeStr}`,
                      tagPrefix: "hydraa-test",
                      allowReminderActions: true,
                      reminderActionSettings: {
                        drinkAmount: normalizeNotificationQuickDrinkAmount(
                          notificationQuickDrinkAmount,
                        ),
                        snoozeMinutes: normalizeNotificationQuickSnoozeMinutes(
                          notificationQuickSnoozeMinutes,
                        ),
                      },
                    });
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
              {isEdgeBrowser
                ? "For Edge: if status is Blocked, open the lock icon near the address bar, go to Site permissions, then allow Notifications and refresh this page."
                : "If status is Blocked, open your browser site permissions, allow Notifications for this site, and refresh this page."}
            </p>
          )}
        </div>
      )}

      {/* Test reminder trigger */}
      <div className="bg-card border border-border rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
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
          className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Bell className="w-3 h-3" /> Fire Now
        </button>
      </div>

      <button
        onClick={save}
        disabled={isSaving}
        className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSaving ? "Saving..." : saved ? "Saved ✓" : "Save Changes"}
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
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  });
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

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 768) {
        setCollapsed(true);
        setThemeOpen(false);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const THEME_OPTS: { key: ThemeMode; label: string; Icon: any }[] = [
    { key: "light", label: "Light", Icon: Sun },
    { key: "dark", label: "Dark", Icon: Moon },
  ];
  const CurrentIcon = mode === "light" ? Sun : Moon;

  const W = collapsed ? 60 : 220;

  return (
    <aside
      className="h-dvh flex flex-col shrink-0 bg-card border-r border-border overflow-hidden relative z-20"
      style={{
        width: W,
        transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
        minWidth: W,
      }}
    >
      {/* Logo + collapse toggle */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-border">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <Martini className="w-5 h-5" />
          {!collapsed && (
            <span className="font-bold text-md tracking-[0.15em] text-foreground whitespace-nowrap overflow-hidden">
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
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
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
              onClick={() => setMode(mode === "light" ? "dark" : "light")}
              title={`Switch to ${mode === "light" ? "dark" : "light"} theme`}
              className="p-2.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <CurrentIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div>
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
                      : "text-muted-foreground hover:bg-muted hover:text-primary",
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
export default function App() {
  const { mode, setMode, isDark } = useTheme();
  const [appState, setAppState] = useState<AppState>(() => getDefaultState());
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [showReminder, setShowReminder] = useState(false);
  const [showRecord, setShowRecord] = useState(false);
  const [dlFlash, setDlFlash] = useState(false);
  const [loadingAction, setLoadingAction] = useState<
    "backup" | "export" | "settings" | null
  >(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [autoBackupLoading, setAutoBackupLoading] = useState(false);
  const [autoBackupProgress, setAutoBackupProgress] = useState(0);
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
  const [nextReminderEndsAt, setNextReminderEndsAt] = useState<number | null>(
    null,
  );
  const [nextReminderCountdown, setNextReminderCountdown] = useState("");
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const reminderRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snoozeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mobileActionsRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);
  const autoBackupInFlightRef = useRef(false);
  const pendingAutoBackupStateRef = useRef<AppState | null>(null);
  // const exportQueuedRef = useRef(false);
  const [expandedHistoryDates, setExpandedHistoryDates] = useState<Set<string>>(
    new Set([todayStr()]),
  );
  // Always-fresh ref so callbacks closed in timeouts can read latest state
  const appStateRef = useRef(appState);
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    const uniqueRecords = ensureUniqueRecordIds(appState.records);
    const changed = uniqueRecords.some((record, index) => {
      return record.id !== appState.records[index]?.id;
    });

    if (!changed) return;

    const nextState: AppState = {
      ...appStateRef.current,
      records: uniqueRecords,
    };
    appStateRef.current = nextState;
    setAppState(nextState);
  }, [appState.records]);

  useEffect(() => {
    if (!loadingAction) {
      setLoadingProgress(0);
      return;
    }
    setLoadingProgress(14);
    const id = setInterval(() => {
      setLoadingProgress((prev) =>
        Math.min(prev + Math.max((95 - prev) * 0.12, 2), 95),
      );
    }, 180);
    return () => clearInterval(id);
  }, [loadingAction]);

  useEffect(() => {
    if (!autoBackupLoading) {
      setAutoBackupProgress(0);
      return;
    }
    setAutoBackupProgress(14);
    const id = setInterval(() => {
      setAutoBackupProgress((prev) =>
        Math.min(prev + Math.max((95 - prev) * 0.12, 2), 95),
      );
    }, 180);
    return () => clearInterval(id);
  }, [autoBackupLoading]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        mobileActionsRef.current &&
        !mobileActionsRef.current.contains(e.target as Node)
      ) {
        setMobileActionsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (loadingAction) {
      setMobileActionsOpen(false);
    }
  }, [loadingAction]);

  const fetchGoogleSheetState = useCallback(async () => {
    // Read state from Google Apps Script JSON endpoint first.
    try {
      const jsonUrl = `${APPS_SCRIPT_URL}?action=getState&_=${Date.now()}`;
      const response = await fetch(jsonUrl, {
        cache: "no-store",
        mode: "cors",
        redirect: "follow",
        credentials: "omit",
      });
      if (response.ok) {
        const textData = await response.text();
        try {
          const payload = JSON.parse(textData) as {
            ok?: boolean;
            state?: unknown;
            theme?: unknown;
          };
          if (
            payload?.ok &&
            payload.state &&
            typeof payload.state === "object"
          ) {
            return {
              state: mergeDefaults(payload.state),
              theme: parseTheme(payload.theme),
            };
          }
        } catch (parseError) {
          console.warn("Failed to parse getState JSON response:", parseError);
        }
      }
    } catch (error) {
      console.error(
        "Error loading data from Google Sheet JSON endpoint:",
        error,
      );
    }

    // Fallback to public Google Sheet CSV if Apps Script endpoint fails.
    try {
      const response = await fetch(`${GOOGLE_FETCH_URL}&_=${Date.now()}`, {
        cache: "no-store",
      });
      if (response.ok) {
        const textData = await response.text();
        const parsed = parseSheetResponseToState(
          textData,
          response.headers.get("content-type"),
        );
        if (parsed) return parsed;
      } else {
        console.warn(
          "Google Sheet CSV fetch failed with status:",
          response.status,
        );
      }
    } catch (error) {
      console.error(
        "Error loading data from Google Sheet CSV endpoint:",
        error,
      );
    }

    return null;
  }, []);

  function finishLoading() {
    setLoadingProgress(100);
    setTimeout(() => {
      setLoadingAction(null);
      setLoadingProgress(0);
    }, 250);
  }

  function finishAutoBackupLoading() {
    setAutoBackupProgress(100);
    setTimeout(() => {
      setAutoBackupLoading(false);
      setAutoBackupProgress(0);
    }, 250);
  }

  async function saveStateToGoogleSheet(
    stateToSave: AppState,
    themeToSave: ThemeMode,
  ) {
    const payload = {
      action: "saveState",
      sheetId: GOOGLE_SHEET_ID,
      state: stateToSave,
      theme: themeToSave,
      exportedAt: new Date().toISOString(),
    };

    const formData = new URLSearchParams({
      action: "saveState",
      sheetId: GOOGLE_SHEET_ID,
      payload: JSON.stringify(payload),
    });

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      redirect: "follow",
      credentials: "omit",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`Google Sheet save failed: ${response.status}`);
    }

    const parsed = await fetchGoogleSheetState();
    if (parsed) {
      setAppState(parsed.state);
      setMode(parsed.theme);
      return;
    }

    setAppState(stateToSave);
    setMode(themeToSave);
  }

  async function runAutoBackup(
    stateSnapshot: AppState,
    successMessage = "Backup saved to Google Sheet.",
  ) {
    pendingAutoBackupStateRef.current = stateSnapshot;
    if (autoBackupInFlightRef.current) return;

    setAutoBackupLoading(true);
    autoBackupInFlightRef.current = true;
    let didSave = false;
    try {
      while (pendingAutoBackupStateRef.current) {
        const nextSnapshot = pendingAutoBackupStateRef.current;
        pendingAutoBackupStateRef.current = null;
        await saveStateToGoogleSheet(nextSnapshot, mode);
        didSave = true;
      }
      if (didSave) {
        toast.success(successMessage);
      }
    } catch (error) {
      console.error("Auto backup failed:", error);
      toast.error("Auto backup failed. You can use Backup manually.");
    } finally {
      autoBackupInFlightRef.current = false;
      finishAutoBackupLoading();
    }
  }

  // Load application state from Google Sheet.
  useEffect(() => {
    async function fetchDriveData() {
      try {
        const parsed = await fetchGoogleSheetState();
        if (parsed) {
          setAppState(parsed.state);
          setMode(parsed.theme);
        }
      } catch (err) {
        console.error("Error fetching data from Google Sheet:", err);
      } finally {
        hydratedRef.current = true;
        setLoaded(true);
        requestNotificationPermission();
      }
    }

    fetchDriveData();
  }, [fetchGoogleSheetState, setMode]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
      return;
    }

    navigator.serviceWorker
      .register("/hydraa-sw.js")
      .catch((error) =>
        console.warn("Service worker registration failed:", error),
      );
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
    if (!appState.reminderEnabled || showReminder || snoozeTimer) {
      setNextReminderCountdown("");
      return;
    }

    const update = () => {
      if (!nextReminderEndsAt) {
        setNextReminderCountdown("");
        return;
      }
      const rem = Math.max(0, nextReminderEndsAt - Date.now());
      const mm = Math.floor(rem / 60000);
      const ss = Math.floor((rem % 60000) / 1000);
      setNextReminderCountdown(`${mm}:${String(ss).padStart(2, "0")}`);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [appState.reminderEnabled, nextReminderEndsAt, showReminder, snoozeTimer]);

  useEffect(() => {
    if (isHydratingFromExcelRef.current) {
      return;
    }

    // queueExport();
  }, [appState]);

  function openReminderAlert() {
    const s = appStateRef.current;
    const todayDate = new Date().toISOString().slice(0, 10);
    const todayWaterAmount = s.records
      .filter(
        (r) =>
          r.date === todayDate && r.type === "drink" && r.drinkType === "water",
      )
      .reduce((sum, r) => sum + r.amount, 0);
    const goal = getGoalForDate(s, todayDate);
    void fireNativeNotification(todayWaterAmount, goal, {
      drinkAmount: s.notificationQuickDrinkAmount,
      snoozeMinutes: s.notificationQuickSnoozeMinutes,
    });
    setShowReminder(true);
  }

  const scheduleReminder = useCallback(
    (ms: number) => {
      if (reminderRef.current) clearTimeout(reminderRef.current);
      setNextReminderEndsAt(Date.now() + ms);
      reminderRef.current = setTimeout(() => {
        const s = appStateRef.current;
        if (!s.reminderEnabled) return;
        setNextReminderEndsAt(null);
        openReminderAlert();
      }, ms);
    },
    [appState.reminderEnabled],
  );

  useEffect(() => {
    if (appState.reminderEnabled)
      scheduleReminder(appState.reminderInterval * 60000);
    else if (reminderRef.current) {
      clearTimeout(reminderRef.current);
      setNextReminderEndsAt(null);
      setNextReminderCountdown("");
    }
    return () => {
      if (reminderRef.current) clearTimeout(reminderRef.current);
    };
  }, [appState.reminderEnabled, appState.reminderInterval, scheduleReminder]);

  // ── record helpers ────────────────────────────────────────────────────────

  function computeWaterTotal(date: string, amount: number, dt: DrinkType) {
    const prev = appStateRef.current.records
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
    const current = appStateRef.current;
    const nextState: AppState = {
      ...current,
      records: [...current.records, record].sort(
        (a, b) => b.timestamp - a.timestamp,
      ),
    };
    appStateRef.current = nextState;
    setAppState(nextState);
    return nextState;
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
    const nextState = addRecord({
      date,
      time,
      timestamp: ts,
      amount: ml,
      drinkType: "water",
      type: "drink",
      source: "reminder",
    });
    void runAutoBackup(nextState);
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
    const nextState = addRecord({
      date,
      time,
      timestamp,
      amount,
      drinkType,
      type: "drink",
      source: "manual",
    });

    if (snoozeTimer) {
      const skipTs = Date.now();
      const skipParts = extractParts(skipTs);
      addRecord({
        date: skipParts.date,
        time: skipParts.time,
        timestamp: skipTs,
        amount: 0,
        drinkType: "water",
        type: "skip",
        source: "manual",
      });
      clearSnoozeTimer();
      toast.info("Snooze stopped after manual drink.");
    }

    if (appStateRef.current.reminderEnabled) {
      scheduleReminder(appStateRef.current.reminderInterval * 60000);
    }

    void runAutoBackup(nextState);
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
    const waterExcludingSelf = appStateRef.current.records
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
    const current = appStateRef.current;
    const nextState: AppState = {
      ...current,
      records: current.records
        .map((r) => (r.id === editingRecord.id ? updated : r))
        .sort((a, b) => b.timestamp - a.timestamp),
    };
    appStateRef.current = nextState;
    setAppState(nextState);
    void runAutoBackup(nextState, "Record modified and saved to Google Sheet.");
    setEditingRecord(null);
  }

  function handleDeleteRecord(id: string) {
    const current = appStateRef.current;
    const nextState: AppState = {
      ...current,
      records: current.records.filter((r) => r.id !== id),
    };
    appStateRef.current = nextState;
    setAppState(nextState);
    void runAutoBackup(nextState, "Record deleted and saved to Google Sheet.");
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
      openReminderAlert();
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
      openReminderAlert();
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

  const handleReminderNotificationAction = useCallback(
    (rawAction: string | undefined) => {
      const action = (rawAction ??
        "hydraa-open-reminder") as ReminderNotificationAction;

      if (action.startsWith("hydraa-drink-")) {
        const amount = normalizeNotificationQuickDrinkAmount(
          Number(action.replace("hydraa-drink-", "")),
        );
        handleReminderDrink(amount);
        toast.success(`Recorded ${amount} ml from reminder notification.`);
        return;
      }

      if (action.startsWith("hydraa-snooze-")) {
        const minutes = normalizeNotificationQuickSnoozeMinutes(
          Number(action.replace("hydraa-snooze-", "")),
        );
        handleSnooze(minutes);
        toast.info(`Reminder snoozed for ${minutes} minutes.`);
        return;
      }

      if (action === "hydraa-skip") {
        handleSkip();
        toast.info("Reminder skipped from notification.");
        return;
      }

      setShowReminder(true);
    },
    [handleReminderDrink, handleSkip, handleSnooze],
  );

  useEffect(() => {
    const onWindowNotificationAction = (event: Event) => {
      const custom = event as CustomEvent<{ action?: string }>;
      handleReminderNotificationAction(custom.detail?.action);
    };

    const onServiceWorkerMessage = (event: MessageEvent) => {
      const payload = event.data as
        | { type?: string; action?: string }
        | undefined;
      if (!payload || payload.type !== "HYDRAA_NOTIFICATION_ACTION") {
        return;
      }
      handleReminderNotificationAction(payload.action);
    };

    window.addEventListener(
      REMINDER_NOTIFICATION_EVENT,
      onWindowNotificationAction as EventListener,
    );

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "message",
        onServiceWorkerMessage,
      );
    }

    return () => {
      window.removeEventListener(
        REMINDER_NOTIFICATION_EVENT,
        onWindowNotificationAction as EventListener,
      );
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "message",
          onServiceWorkerMessage,
        );
      }
    };
  }, [handleReminderNotificationAction]);

  async function handleDownload() {
    setLoadingAction("export");
    setDlFlash(true);
    try {
      const response = await fetch(
        `${APPS_SCRIPT_URL}?action=getXml&_=${Date.now()}`,
        {
          cache: "no-store",
          mode: "cors",
          redirect: "follow",
          credentials: "omit",
        },
      );
      if (!response.ok) {
        throw new Error(
          `Google Sheet workbook export failed: ${response.status}`,
        );
      }

      const workbookXml = await response.text();
      if (!workbookXml.trim()) {
        throw new Error("Received empty workbook export from Google Sheet");
      }

      const blob = new Blob([workbookXml], {
        type: "application/vnd.ms-excel",
      });
      downloadBlob(blob, "HYDRAA.xls");
      toast.success("Export completed successfully.");
    } catch (error: any) {
      console.error("Export failed:", error);
      toast.error("Failed to download workbook export from Google Sheet.");
    } finally {
      finishLoading();
      setTimeout(() => setDlFlash(false), 2000);
    }
  }

  async function handleBackup() {
    setLoadingAction("backup");
    try {
      await saveStateToGoogleSheet(appStateRef.current, mode);

      toast.success("Backup saved to Google Sheet.");
    } catch (error: any) {
      console.error("Backup failed:", error);
      toast.error("Failed to save backup to Google Sheet.");
    } finally {
      finishLoading();
    }
  }

  async function handleSettingsSave(p: Partial<AppState>): Promise<boolean> {
    setLoadingAction("settings");
    try {
      const current = appStateRef.current;
      const today = todayStr();
      const { dailyGoal: todayGoalInput, ...rest } = p;
      const next: AppState = { ...current, ...rest };

      if (todayGoalInput !== undefined) {
        const existing = next.dailyGoals.filter((g) => g.date !== today);
        next.dailyGoals = [...existing, { date: today, goal: todayGoalInput }];
      }

      setAppState(next);
      await saveStateToGoogleSheet(next, mode);
      toast.success("Settings saved to Google Sheet.");
      return true;
    } catch (error: any) {
      console.error("Settings save failed:", error);
      toast.error("Failed to save settings to Google Sheet.");
      return false;
    } finally {
      finishLoading();
    }
  }

  function toggleHistoryDate(date: string) {
    setExpandedHistoryDates((prev) => {
      const next = new Set(prev);

      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }

      return next;
    });
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
  const pct = todayGoal > 0 ? Math.min((todayWater / todayGoal) * 100, 100) : 0;
  const todayGoalPct =
    todayGoal > 0 ? Math.min((todayTotal / todayGoal) * 100, 100) : 0;
  const reminderRecs = todayRecs.filter((r) => r.source === "reminder");
  const todayByType = DRINK_KEYS.map((dt) => ({
    dt,
    amount: todayDrinks
      .filter((r) => r.drinkType === dt)
      .reduce((s, r) => s + r.amount, 0),
  })).filter((x) => x.amount > 0);

  const dailyData = buildDailyData(appState.records, 7);
  const avgIntervalDailyData = buildDailyAverageIntervalData(
    appState.records,
    7,
  );
  const monthlyData = buildMonthlyData(appState.records, 6);
  const todayAvgConsumptionMinutes =
    getAverageConsumptionMinutesForRecords(todayDrinks);

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
          <Martini className="w-10 h-10" />
          <p className="text-2xl font-semibold tracking-[0.18em] text-foreground">
            HYDRAA
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "flex h-dvh overflow-x-auto overflow-y-hidden bg-background font-sans",
        loadingAction ? "pointer-events-none select-none" : "",
      ].join(" ")}
    >
      {loadingAction && (
        <div className="fixed left-0 top-0 z-[100] h-1 w-full bg-primary/20">
          <div
            className="h-full bg-primary transition-[width] duration-150 ease-out"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>
      )}
      {autoBackupLoading && !loadingAction && (
        <div className="fixed left-0 top-0 z-[99] h-1 w-full bg-primary/15">
          <div
            className="h-full bg-primary transition-[width] duration-150 ease-out"
            style={{ width: `${autoBackupProgress}%` }}
          />
        </div>
      )}
      {/* ── SIDEBAR ── */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mode={mode}
        setMode={setMode}
      />

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col min-w-[320px] sm:min-w-0 overflow-hidden">
        {/* topBar */}
        <header className="shrink-0 bg-card border-b border-border flex h-14 items-center justify-between px-3 sm:px-6 gap-2 sm:gap-3">
          {/* Snooze countdown widget */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {snoozeTimer ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
                <Bell className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs text-foreground hidden sm:inline">
                  Next reminder
                </span>
                <Num className="text-sm font-semibold text-black tabular-nums">
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
                    className="p-1 rounded hover:bg-border transition-colors text-foreground"
                  >
                    <Pause className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={handleCancelSnooze}
                  title="Cancel snooze"
                  className="p-1 rounded hover:bg-border transition-colors text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="min-w-0">
                {appState.reminderEnabled && nextReminderCountdown && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border">
                    <Bell className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      Next reminder:
                    </span>
                    <Num className="text-sm font-semibold text-black tabular-nums">
                      {nextReminderCountdown}
                    </Num>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => setShowRecord(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Record Drink</span>
            </button>
            <button
              onClick={handleBackup}
              disabled={!!loadingAction}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {loadingAction === "backup" ? "Backing up..." : "Backup"}
              </span>
            </button>
            <button
              onClick={handleDownload}
              disabled={!!loadingAction}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {loadingAction === "export"
                  ? "Exporting..."
                  : dlFlash
                    ? "Exported ✓"
                    : "Export"}
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

          <div
            className="sm:hidden flex items-center shrink-0"
            ref={mobileActionsRef}
          >
            <div className="relative">
              <button
                onClick={() => setMobileActionsOpen((v) => !v)}
                className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                title="Actions"
              >
                <Menu className="w-4 h-4 text-muted-foreground" />
              </button>

              {mobileActionsOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      setShowRecord(true);
                      setMobileActionsOpen(false);
                    }}
                    className="w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" /> Record Drink
                  </button>
                  <button
                    onClick={() => {
                      handleBackup();
                      setMobileActionsOpen(false);
                    }}
                    disabled={!!loadingAction}
                    className="w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2 disabled:opacity-60"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    {loadingAction === "backup" ? "Backing up..." : "Backup"}
                  </button>
                  <button
                    onClick={() => {
                      handleDownload();
                      setMobileActionsOpen(false);
                    }}
                    disabled={!!loadingAction}
                    className="w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2 disabled:opacity-60"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {loadingAction === "export"
                      ? "Exporting..."
                      : dlFlash
                        ? "Exported ✓"
                        : "Export"}
                  </button>
                  <button
                    onClick={() => {
                      setShowReminder(true);
                      setMobileActionsOpen(false);
                    }}
                    className="w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
                  >
                    <Bell className="w-3.5 h-3.5" /> Preview reminder
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* scrollable content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          {/* ─── DASHBOARD ─── */}
          {activeTab === "dashboard" && (
            <div className="space-y-5">
              {/* progress */}
              <div className="bg-card border border-border rounded-xl p-3 sm:p-5">
                <div className="flex flex-col md:flex-row md:items-end gap-5">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Total Intake · Today
                    </p>
                    <div className="flex items-baseline gap-2 mb-4">
                      <Num className="text-4xl sm:text-5xl font-bold text-foreground">
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
                          width: `${todayGoalPct}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <Num>
                        <span className="font-semibold text-foreground">
                          {Math.round(todayGoalPct)}%
                        </span>{" "}
                        of daily goal
                      </Num>
                      <Num>
                        <span className="font-semibold text-foreground">
                          {Math.max(todayGoal - todayTotal, 0)} ml
                        </span>{" "}
                        remaining
                      </Num>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:w-48 shrink-0 w-full md:w-auto">
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
                  label="Avg interval today"
                  value={formatMinutesAsDuration(todayAvgConsumptionMinutes)}
                  sub={
                    todayAvgConsumptionMinutes === null
                      ? "Need at least 2 drink entries"
                      : `${todayDrinks.length} drink entries today`
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

              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      Average Consumption Interval — Last 7 Days
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Average minutes between consecutive drink entries per day
                    </p>
                  </div>
                </div>
                <AvgConsumptionIntervalChart
                  data={avgIntervalDailyData}
                  isDark={isDark}
                />
              </div>
            </div>
          )}

          {/* ─── HISTORY ─── */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-foreground text-md">
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
                        const isExpanded = expandedHistoryDates.has(date);
                        return (
                          <div
                            key={date}
                            className="bg-card border border-border rounded-xl overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() => toggleHistoryDate(date)}
                              className="w-full px-3 sm:px-4 py-3 bg-muted-foreground/40 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 text-left hover:bg-muted-foreground/50 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                                )}

                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-foreground">
                                    {new Date(
                                      date + "T12:00:00",
                                    ).toLocaleDateString("en-US", {
                                      weekday: "long",
                                      month: "short",
                                      day: "numeric",
                                    })}

                                    {date === today && (
                                      <span className="text-[11px] text-primary font-medium ml-1">
                                        Today
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-xs text-secondary-foreground">
                                <Num>💧 {dayWater} ml</Num>

                                {dayTotal !== dayWater && (
                                  <Num>Total {dayTotal} ml</Num>
                                )}

                                <span>
                                  {
                                    recs.filter((r) => r.type === "drink")
                                      .length
                                  }{" "}
                                  drinks
                                </span>
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="divide-y divide-border">
                                {recs.map((r) => {
                                  if (r.type === "drink") {
                                    const d = DRINKS[r.drinkType];
                                    const isDeleting = deletingId === r.id;
                                    return (
                                      <div key={r.id}>
                                        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 group hover:bg-muted/40 transition-colors">
                                          <DrinkDot
                                            type={r.drinkType}
                                            isDark={isDark}
                                          />
                                          <div className="flex-1 flex items-center gap-2 min-w-0">
                                            <span className="text-sm font-medium text-secondary-foreground">
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
                                          <Num className="text-xs text-muted-foreground w-10 text-right shrink-0 hidden sm:block">
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
                                              onClick={() =>
                                                setDeletingId(r.id)
                                              }
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
                                      ? `Snoozed${r.snoozeDuration ? ` ${Number(r.snoozeDuration).toFixed(2)}m` : ""}`
                                      : "Skipped";
                                  return (
                                    <div
                                      key={r.id}
                                      className="flex items-center gap-3 px-4 py-2.5 opacity-80"
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
                            )}
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
                <h2 className="font-semibold text-foreground text-md">
                  Trends
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All beverages tracked over time
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="All-time water"
                  value={`${((allByType.find((x) => x.dt === "water")?.amount ?? 0) / 1000).toFixed(2)} L`}
                />
                <StatCard
                  label="Total beverages"
                  value={`${(allTotal / 1000).toFixed(2)} L`}
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
                          {amount >= 1000
                            ? `${(amount / 1000).toFixed(2)} L`
                            : `${amount} ml`}
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
                void fireNativeNotification(todayWater, goal, {
                  drinkAmount: s.notificationQuickDrinkAmount,
                  snoozeMinutes: s.notificationQuickSnoozeMinutes,
                });
                setShowReminder(true);
              }}
              onSave={handleSettingsSave}
              isSaving={loadingAction === "settings"}
            />
          )}
        </main>
      </div>

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
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
