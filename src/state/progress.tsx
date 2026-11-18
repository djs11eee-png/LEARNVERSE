import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

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
  logMinutes: (minutes: number) => void;
}

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
    activity: [activity, ...progress.activity].slice(0, maxRecentActivity),
    studyDays: today && !progress.studyDays.includes(today)
      ? [today, ...progress.studyDays]
      : progress.studyDays,
  };
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState(() => readProgress() ?? emptyProgress);
  const memory = useRef(progress);
  const storageAvailable = useRef(true);

  useEffect(() => {
    function syncProgress(event: StorageEvent) {
      if (!storageAvailable.current || (event.key !== storageKey && event.key !== null)) return;
      const next = readProgress() ?? emptyProgress;
      memory.current = next;
      setProgress(next);
    }

    window.addEventListener('storage', syncProgress);
    return () => window.removeEventListener('storage', syncProgress);
  }, []);

  function commit(change: (previous: Progress) => Progress) {
    const previous = (storageAvailable.current ? readProgress() : undefined) ?? memory.current;
    const next = change(previous);
    memory.current = next;
    setProgress(next);

    if (next === previous) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      storageAvailable.current = true;
    } catch {
      storageAvailable.current = false;
    }
  }

  function update(change: (previous: Progress) => Progress) {
    // Storage operations are atomic individually. The lock covers the full update across tabs.
    if (navigator.locks) {
      void navigator.locks.request(storageKey, () => commit(change)).catch(() => commit(change));
    } else {
      commit(change);
    }
  }

  function startCourse(id: string) {
    update((previous) => {
      const now = new Date();
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
    update((previous) => {
      if (previous.completed.includes(id)) return previous;
      const now = new Date();
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
    update((previous) => {
      if (!previous.completed.includes(id)) return previous;
      return addActivity({
        ...previous,
        completed: previous.completed.filter((course) => course !== id),
        activeCourse: previous.activeCourse ?? (previous.started.includes(id) ? id : null),
      }, { type: 'course-reopened', id, timestamp: new Date().toISOString() });
    });
  }

  function toggleFavorite(id: string) {
    update((previous) => ({
      ...previous,
      favorites: previous.favorites.includes(id)
        ? previous.favorites.filter((resource) => resource !== id)
        : [...previous.favorites, id],
    }));
  }

  function chooseRoute(id: string) {
    update((previous) => {
      if (previous.activeRoute === id) return previous;
      return addActivity({ ...previous, activeRoute: id }, { type: 'route-selected', id, timestamp: new Date().toISOString() });
    });
  }

  function logMinutes(minutes: number) {
    if (!wholeMinutes(minutes) || minutes > 1440) return;
    update((previous) => {
      const now = new Date();
      return addActivity({ ...previous, minutes: previous.minutes + minutes }, {
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
