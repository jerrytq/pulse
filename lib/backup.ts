import { Bytes, DocumentReference, GeoPoint, Timestamp } from "firebase/firestore";

type BackupValue = null | boolean | string | number
  | { type: "timestamp"; seconds: number; nanoseconds: number }
  | { type: "geopoint"; latitude: number; longitude: number }
  | { type: "bytes"; base64: string }
  | { type: "reference"; projectId: string; databaseId: string; path: string }
  | { type: "number"; value: "NaN" | "Infinity" | "-Infinity" | "-0" }
  | { type: "array"; values: BackupValue[] }
  | { type: "map"; fields: Record<string, BackupValue> };

// Encode before JSON.stringify: converting timestamps to Date would lose precision.
function encodeValue(value: unknown): BackupValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Object.is(value, -0)) return { type: "number", value: "-0" };
    if (Number.isNaN(value)) return { type: "number", value: "NaN" };
    if (!Number.isFinite(value)) return { type: "number", value: value > 0 ? "Infinity" : "-Infinity" };
    return value;
  }
  if (value instanceof Timestamp) return { type: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof GeoPoint) return { type: "geopoint", latitude: value.latitude, longitude: value.longitude };
  if (value instanceof Bytes) return { type: "bytes", base64: value.toBase64() };
  if (value instanceof DocumentReference) {
    const database = (value.firestore.toJSON() as { databaseId: { projectId: string; database: string } }).databaseId;
    return { type: "reference", projectId: database.projectId, databaseId: database.database, path: value.path };
  }
  if (Array.isArray(value)) return { type: "array", values: value.map(encodeValue) };
  if (typeof value === "object" && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    // Tag ordinary maps too, so user field names cannot masquerade as typed values.
    return { type: "map", fields: encodeFields(value as Record<string, unknown>) };
  }
  throw new TypeError("Backup contains a value this export format cannot preserve. No file was created.");
}

function encodeFields(data: Record<string, unknown>): Record<string, BackupValue> {
  return Object.fromEntries(Object.entries(data).map(([name, value]) => [name, encodeValue(value)]));
}

type Source = { projectId: string; userId: string; email: string | null; displayName: string | null };
type SourceDocument = { id: string; path: string; data: Record<string, unknown> };
type Scale = readonly { score: number; label: string; description: string }[];

export function createMoodBackup(source: Source, documents: SourceDocument[], scale: Scale, now = new Date()) {
  const collectionPath = `users/${source.userId}/moods`;
  for (const document of documents) {
    if (document.path !== `${collectionPath}/${document.id}` || document.id.includes("/")) {
      throw new Error("Backup document does not belong to this account’s mood collection.");
    }
  }
  return {
    format: "pulse-mood-backup",
    schemaVersion: 1,
    exportedAt: now.toISOString(),
    source: { ...source, databaseId: "(default)", collectionPath },
    scope: "All documents in this user’s moods collection; no date-range or graph filters.",
    dateSemantics: "YYYY-MM-DD is the device-local calendar date recorded at entry time. Entry timezone was not stored.",
    moodScale: scale.map(({ score, label, description }) => ({ score, label, description })),
    documentCount: documents.length,
    documents: [...documents].sort((a, b) => a.id.localeCompare(b.id)).map(document => ({
      id: document.id, path: document.path, data: encodeFields(document.data),
    })),
  };
}

export function backupFilename(exportedAt: string) {
  return `pulse-backup-${exportedAt.replace(/[:.]/g, "-")}.json`;
}
