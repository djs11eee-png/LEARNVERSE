import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { withStorageLock } from './storageLock';

const storageKey = 'learnverse.learning-progress.v1';
const maxRecentActivity = 30;

export type Activity =
  | { type: 'course-started' | 'course-completed' | 'course-reopened' | 'route-selected'; id: string; timestamp: string }
  | { type: 'time-logged'; minutes: number; timestamp: string };

interface Progress {
  completed: string[];
  started: string[];
  favorites: string[];
  minutes: number;
  activity: Activity[];
  activeCourse: string | null;
  activeRoute: string | null;
  studyDays: string[];
}

interface ProgressContextValue extends Progress {
  streak: number;
  startCourse: (id: string) => void;
  completeCourse: (id: string) => void;
  uncompleteCourse: (id: string) => void;
  toggleFavorite: (id: string) => void;
  chooseRoute: (id: string) => void;
  logMinutes: (minutes: number) => Promise<boolean>;
  hasUnsavedProgress: boolean;
  retryProgress: () => Promise<boolean>;
}

type ProgressChange = (previous: Progress) => Progress;

const emptyProgress: Progress = {
  completed: [],
  started: [],
  favorites: [],
  minutes: 0,
  activity: [],
  activeCourse: null,
  activeRoute: null,
  studyDays: [],
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    : [];
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function wholeMinutes(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function readActivity(value: unknown): Activity[] {
  if (!Array.isArray(value)) return [];

  const result: Activity[] = [];
  for (const item of value) {
    const entry = record(item);
    if (!entry || typeof entry.timestamp !== 'string' || !Number.isFinite(Date.parse(entry.timestamp))) continue;

    const { type, id, timestamp } = entry;
    if (type === 'time-logged' && wholeMinutes(entry.minutes)) {
      result.push({ type, minutes: wholeMinutes(entry.minutes), timestamp });
    }
    if (typeof id === 'string' && (
      type === 'course-started' || type === 'course-completed' ||
      type === 'course-reopened' || type === 'route-selected'
    )) {
      result.push({ type, id, timestamp });
    }
    if (result.length === maxRecentActivity) break;
  }
  return result;
}

function readProgress(): Progress | undefined {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    return undefined;
  }
  if (!raw) return emptyProgress;

  try {
    const value = record(JSON.parse(raw));
    if (!value) return emptyProgress;

    const activeCourse = typeof value.activeCourse === 'string' ? value.activeCourse : null;
    return {
      completed: strings(value.completed),
      started: value.started ? strings(value.started) : activeCourse ? [activeCourse] : [],
      favorites: strings(value.favorites),
      minutes: wholeMinutes(value.minutes),
      activity: readActivity(value.activity),
      activeCourse,
      activeRoute: typeof value.activeRoute === 'string' ? value.activeRoute : null,
      studyDays: strings(value.studyDays).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)),
    };
  } catch {
    return emptyProgress;
  }
}

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function currentStreak(studyDays: string[]): number {
  const dates = new Set(studyDays);
  const day = new Date();
  day.setHours(12, 0, 0, 0);
  if (!dates.has(dayKey(day))) day.setDate(day.getDate() - 1);

  let streak = 0;
  while (dates.has(dayKey(day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

function addActivity(progress: Progress, activity: Activity, studyDate?: Date): Progress {
  const today = studyDate ? dayKey(studyDate) : undefined;
  return {
    ...progress,
    activity: [activity, ...progress.activity]
      .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
      .slice(0, maxRecentActivity),
    studyDays: today && !progress.studyDays.includes(today)
      ? [today, ...progress.studyDays]
      : progress.studyDays,
  };
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(() => readProgress() ?? emptyProgress);
  const [hasUnsavedProgress, setHasUnsavedProgress] = useState(false);
  const durable = useRef(progress);
  const pending = useRef<ProgressChange[]>([]);

  function applyPending(base: Progress) {
    return pending.current.reduce((current, change) => change(current), base);
  }

  useEffect(() => {
    function reloadStored() {
      const next = readProgress();
      if (!next) return;
      durable.current = next;
      setProgress(applyPending(next));
    }
    function syncProgress(event: StorageEvent) {
      if (event.key !== storageKey && event.key !== null) return;
      reloadStored();
    }

    window.addEventListener('storage', syncProgress);
    window.addEventListener('learnverse:progress-synced', reloadStored);
    return () => {
      window.removeEventListener('storage', syncProgress);
      window.removeEventListener('learnverse:progress-synced', reloadStored);
    };
  }, []);

  function update(change?: ProgressChange) {
    if (change) pending.current.push(change);
    return withStorageLock(storageKey, () => {
      if (!pending.current.length) return true;

      // Replay only local changes against the latest durable value under the lock.
      const stored = readProgress();
      if (stored) durable.current = stored;
      const next = applyPending(durable.current);
      setProgress(next);
      if (stored) {
        try {
          const changed = next !== stored;
          if (changed) window.localStorage.setItem(storageKey, JSON.stringify(next));
          durable.current = next;
          pending.current = [];
          setHasUnsavedProgress(false);
          if (changed) {
            window.dispatchEvent(new CustomEvent('learnverse:local-mutated', { detail: { scope: 'progress' } }));
          }
          return true;
        } catch {
          // Keep the operations for a subsequent retry or update.
        }
      }
      setHasUnsavedProgress(true);
      return false;
    });
  }

  function startCourse(id: string) {
    const now = new Date();
    void update((previous) => {
      const timestamp = now.toISOString();
      const last = previous.activity[0];
      if (last?.type === 'course-started' && last.id === id && dayKey(new Date(last.timestamp)) === dayKey(now) &&
        (previous.completed.includes(id) || previous.activeCourse === id)) {
        return previous;
      }

      const activeCourse = previous.completed.includes(id) ? previous.activeCourse : id;
      const started = [id, ...previous.started.filter((course) => course !== id)];
      return addActivity({ ...previous, activeCourse, started }, { type: 'course-started', id, timestamp }, now);
    });
  }

  function completeCourse(id: string) {
    const now = new Date();
    void update((previous) => {
      if (previous.completed.includes(id)) return previous;
      const completed = [...previous.completed, id];
      const activeCourse = previous.activeCourse === id
        ? previous.started.find((course) => !completed.includes(course)) ?? null
        : previous.activeCourse;
      return addActivity({
        ...previous,
        completed,
        activeCourse,
      }, { type: 'course-completed', id, timestamp: now.toISOString() }, now);
    });
  }

  function uncompleteCourse(id: string) {
    const timestamp = new Date().toISOString();
    void update((previous) => {
      if (!previous.completed.includes(id)) return previous;
      return addActivity({
        ...previous,
        completed: previous.completed.filter((course) => course !== id),
        activeCourse: previous.activeCourse ?? (previous.started.includes(id) ? id : null),
      }, { type: 'course-reopened', id, timestamp });
    });
  }

  function toggleFavorite(id: string) {
    const favorite = !applyPending(durable.current).favorites.includes(id);
    void update((previous) => {
      if (previous.favorites.includes(id) === favorite) return previous;
      return {
        ...previous,
        favorites: favorite
          ? [...previous.favorites, id]
          : previous.favorites.filter((resource) => resource !== id),
      };
    });
  }

  function chooseRoute(id: string) {
    const timestamp = new Date().toISOString();
    void update((previous) => {
      if (previous.activeRoute === id) return previous;
      return addActivity({ ...previous, activeRoute: id }, { type: 'route-selected', id, timestamp });
    });
  }

  async function logMinutes(minutes: number) {
    if (!wholeMinutes(minutes) || minutes > 1440) return false;
    const now = new Date();
    return update((previous) => {
      return addActivity({ ...previous, minutes: Math.min(Number.MAX_SAFE_INTEGER, previous.minutes + minutes) }, {
        type: 'time-logged', minutes, timestamp: now.toISOString(),
      }, now);
    });
  }

  return (
    <ProgressContext.Provider value={{
      ...progress,
      streak: currentStreak(progress.studyDays),
      startCourse,
      completeCourse,
      uncompleteCourse,
      toggleFavorite,
      chooseRoute,
      logMinutes,
      hasUnsavedProgress,
      retryProgress: () => update(),
    }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext);
  if (!context) throw new Error('useProgress must be used inside ProgressProvider');
  return context;
}
