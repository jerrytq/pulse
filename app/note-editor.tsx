"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { dateLabel, MAX_NOTE_LENGTH, moods, normalizeNote, type Entry } from "@/lib/mood";
import styles from "./notes.module.css";

export default function NoteEditor({ entry, demo, onSave, onClose }: {
  entry: Entry; demo: boolean; onSave: (note: string) => Promise<void>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const fieldId = useId();
  const [draft, setDraft] = useState(entry.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const modal = dialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    modal.showModal();
    modal.querySelector("textarea")?.focus();
    return () => { modal.close(); trigger?.focus(); };
  }, []);

  async function submit() {
    setError(""); setSaving(true);
    try { await onSave(normalizeNote(draft)); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : "Couldn’t save your note. Please try again."); }
    finally { setSaving(false); }
  }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); if (!saving) void submit(); }}>
      <div className={styles.heading}><div><p className="eyebrow">A NOTE FOR YOUR DAY</p><h2 id={titleId}>{dateLabel(entry.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</h2></div>
        <button type="button" className="icon-button" disabled={saving} aria-label="Close note editor" onClick={onClose}><X size={19} /></button>
      </div>
      <p id={descriptionId} className={styles.description}>{entry.score} / 5 ({moods[entry.score - 1].label}){demo ? " · Demo note, kept only in this preview." : " · A little context to remember this day."}</p>
      <label htmlFor={fieldId} className={styles.label}>Your note</label>
      <textarea id={fieldId} className={styles.textarea} autoFocus rows={5} maxLength={MAX_NOTE_LENGTH} value={draft} disabled={saving}
        placeholder="What made this day feel this way?" onChange={event => setDraft(event.target.value)} aria-describedby={`${fieldId}-hint`} />
      <div id={`${fieldId}-hint`} className={styles.hint}><span>Leave blank to remove an existing note.</span><span>{draft.length}/{MAX_NOTE_LENGTH}</span></div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}><button type="button" className={styles.secondary} disabled={saving} onClick={onClose}>Cancel</button>
        <button className="primary-button" disabled={saving || draft.trim() === (entry.note ?? "")} type="submit">{saving ? "Saving…" : "Save note"}</button>
      </div>
    </form>
  </dialog>;
}
