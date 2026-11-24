import { useEffect, useRef, useState } from 'react';
import type { RunLanguage } from '../code/runner';
import { fitsEditorLimits, workbenchInputLimits } from '../code/runnerLimits';
import { withStorageLock } from '../state/storageLock';

interface Draft {
  code: string;
  input: string;
}
type DraftField = keyof Draft;
const fields = ['code', 'input'] as const;
type DraftKeys = Draft & { legacy: string };
type SavedDraft = { draft: Draft; oversized: DraftField[] };
type PendingEdit = { value: string; base: string; reset?: boolean };
type ConflictResolution = 'keep-mine' | 'use-saved';

function keysFor(key: string): DraftKeys {
  // Individual keys make distinct-field writes independent, including without Web Locks.
  return { legacy: key, code: 'learnverse:code-draft-field:code:' + key, input: 'learnverse:code-draft-field:input:' + key };
}

export function draftFieldFits(field: DraftField, value: string, limits: Record<DraftField, number>) {
  return field === 'code' ? fitsEditorLimits(value, limits.code) : value.length <= limits.input;
}

function readDraft(keys: DraftKeys, initial: Draft, limits: Record<DraftField, number>): SavedDraft | undefined {
  try {
    const raw: { code: string | null; input: string | null } = {
      code: localStorage.getItem(keys.code),
      input: localStorage.getItem(keys.input),
    };
    const legacy = raw.code === null || raw.input === null ? localStorage.getItem(keys.legacy) : null;
    const legacyOverLimit = Boolean(legacy && legacy.length > (limits.code + limits.input) * 6 + 256);
    let original: Partial<Draft> | undefined;
    if (legacy && !legacyOverLimit) {
      try {
        const saved = JSON.parse(legacy) as Partial<Draft> | null;
        if (typeof saved?.code === 'string' && typeof saved.input === 'string') original = saved;
      } catch {
        // An invalid record is treated as an absent draft.
      }
    }
    const draft = { ...initial };
    const oversized: DraftField[] = [];
    for (const field of fields) {
      const separate = raw[field];
      // The empty marker means "use the current example" and masks a legacy value.
      if (separate !== null && separate.length > limits[field] + 1) {
        oversized.push(field);
        continue;
      }
      if (separate === null && legacyOverLimit) {
        oversized.push(field);
        continue;
      }
      const value = separate === null ? original?.[field] : separate.startsWith('1') ? separate.slice(1) : undefined;
      if (value === undefined) continue;
      if (draftFieldFits(field, value, limits)) draft[field] = value;
      else oversized.push(field);
    }
    return { draft, oversized };
  } catch {
    return undefined;
  }
}

export function useCodeDraft(storageKey: string | undefined, language: RunLanguage, starter: string, stdin: string) {
  const initial = { code: starter, input: stdin };
  const [first] = useState<SavedDraft>(() => (
    (storageKey && readDraft(keysFor(storageKey), initial, workbenchInputLimits(language))) || { draft: initial, oversized: [] }
  ));
  const [state, setState] = useState({
    draft: first.draft, pending: false, blocked: false, conflict: false, oversized: first.oversized.length > 0, synced: false,
  });
  const current = useRef(first.draft);
  const saved = useRef(first);
  const pending = useRef<Partial<Record<DraftField, PendingEdit>>>({});
  const blocked = useRef(false);
  const queued = useRef(false);

  function publish(latest = saved.current, synced = false) {
    saved.current = latest;
    const draft = {
      code: pending.current.code?.value ?? latest.draft.code,
      input: pending.current.input?.value ?? latest.draft.input,
    };
    current.current = draft;
    setState({
      draft,
      pending: Object.keys(pending.current).length > 0,
      blocked: blocked.current,
      conflict: fields.some((field) => {
        const edit = pending.current[field];
        return edit && edit.base !== latest.draft[field];
      }),
      oversized: latest.oversized.length > 0,
      synced,
    });
  }

  useEffect(() => {
    if (!storageKey) return;
    const keys = keysFor(storageKey);
    function synchronize(event: StorageEvent) {
      if (event.key !== null && !Object.values(keys).includes(event.key)) return;
      const latest = readDraft(keys, { code: starter, input: stdin }, workbenchInputLimits(language));
      if (latest) publish(latest, true);
    }
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, [storageKey, language, starter, stdin]);

  function retry(resolution?: ConflictResolution) {
    if (!storageKey || (queued.current && !resolution)) return;
    const keys = keysFor(storageKey);
    queued.current = true;
    void withStorageLock(storageKey, () => {
      queued.current = false;
      const latest = readDraft(keys, initial, workbenchInputLimits(language));
      if (!latest) {
        blocked.current = true;
        publish();
        return;
      }
      for (const field of fields) {
        const edit = pending.current[field];
        if (!edit) continue;
        const conflict = edit.base !== latest.draft[field];
        if (conflict && resolution === 'use-saved') {
          delete pending.current[field];
          continue;
        }
        if (resolution !== 'keep-mine' && (conflict || latest.oversized.includes(field))) continue;
        try {
          localStorage.setItem(keys[field], edit.reset ? '' : '1' + edit.value);
          latest.draft[field] = edit.value;
          latest.oversized = latest.oversized.filter((item) => item !== field);
          delete pending.current[field];
        } catch {
          // Preserve unsaved edits and try again on demand.
        }
      }
      blocked.current = Object.keys(pending.current).length > 0;
      publish(latest);
    });
  }

  function edit(field: DraftField, value: string) {
    if (!storageKey) {
      publish({ ...saved.current, draft: { ...current.current, [field]: value } });
      return;
    }
    const base = pending.current[field]?.base ?? saved.current.draft[field];
    pending.current[field] = { value, base };
    publish();
    retry();
  }

  function restore() {
    if (!storageKey) {
      publish({ draft: initial, oversized: [] });
      return;
    }
    pending.current = {
      code: { value: starter, base: saved.current.draft.code, reset: true },
      input: { value: stdin, base: saved.current.draft.input, reset: true },
    };
    publish();
    retry('keep-mine');
  }

  function savedText() {
    if (!storageKey) return [];
    const keys = keysFor(storageKey);
    try {
      return (['legacy', ...fields] as const).flatMap((field) => {
        const raw = localStorage.getItem(keys[field]);
        if (raw === null) return [];
        return ['\n--- ' + field + ' ---\n', field === 'legacy' ? raw : raw.slice(1)];
      });
    } catch {
      return [];
    }
  }

  return { ...state, current, edit, restore, retry, savedText };
}
