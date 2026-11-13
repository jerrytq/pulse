import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase/app';
import { Bytes, doc, GeoPoint, getFirestore, Timestamp } from 'firebase/firestore';
import { backupFilename, createMoodBackup } from '../lib/backup.ts';
import { moods } from '../lib/mood.ts';

const source = { projectId: 'backup-test', userId: 'owner', email: 'owner@example.test', displayName: 'Owner' };
const now = new Date('2026-11-07T21:12:34.567Z');
const firestore = getFirestore(initializeApp({ projectId: 'backup-test' }, 'backup-tests'));

// Independent reader demonstrating that the exported format retains native types.
// This is a test helper, not an import UI or a database write operation.
function decode(value) {
  if (value === null || typeof value !== 'object') return value;
  switch (value.type) {
    case 'timestamp': return new Timestamp(value.seconds, value.nanoseconds);
    case 'geopoint': return new GeoPoint(value.latitude, value.longitude);
    case 'bytes': return Bytes.fromBase64String(value.base64);
    case 'reference': return value;
    case 'number': return value.value === '-0' ? -0 : Number(value.value);
    case 'array': return value.values.map(decode);
    case 'map': return Object.fromEntries(Object.entries(value.fields).map(([key, item]) => [key, decode(item)]));
    default: throw new Error('Unknown backup value type');
  }
}

test('JSON backup retains every supplied document, all fields, IDs, and exact timestamps', () => {
  const updatedAt = new Timestamp(1794080000, 123456789);
  const documents = [
    { id: '2026-11-07', path: 'users/owner/moods/2026-11-07', data: { date: '2026-11-07', score: 5, updatedAt, note: 'Walked by the lake.\nA calmer day. 🌿' } },
    { id: '2020-01-01', path: 'users/owner/moods/2020-01-01', data: { date: '2020-01-01', score: 1, updatedAt, extra: { type: 'timestamp', note: 'keep this field' } } },
    { id: 'unusual-record', path: 'users/owner/moods/unusual-record', data: { note: 'not visible on the graph, but still backed up' } },
  ];
  const backup = JSON.parse(JSON.stringify(createMoodBackup(source, documents, moods, now)));
  assert.equal(backup.format, 'pulse-mood-backup');
  assert.equal(backup.schemaVersion, 1);
  assert.equal(backup.exportedAt, now.toISOString());
  assert.equal(backup.source.userId, source.userId);
  assert.equal(backup.source.email, source.email);
  assert.equal(backup.source.databaseId, '(default)');
  assert.equal(backup.source.collectionPath, 'users/owner/moods');
  assert.equal(backup.documentCount, 3);
  assert.deepEqual(backup.moodScale.map(mood => mood.score), [1, 2, 3, 4, 5]);
  for (const original of documents) {
    const exported = backup.documents.find(item => item.id === original.id);
    assert.equal(exported.path, original.path);
    const restored = Object.fromEntries(Object.entries(exported.data).map(([name, value]) => [name, decode(value)]));
    assert.deepEqual(restored, original.data);
  }
  assert.equal(documents[0].id, '2026-11-07', 'export must not reorder the original input');
  assert.equal(backup.documents[0].id, '2020-01-01');
});

test('encoding preserves nested values and special Firestore values through JSON', () => {
  const data = {
    zero: 0, negativeZero: -0, nan: NaN, infinity: Infinity, negativeInfinity: -Infinity,
    values: [false, null, '', { type: 'bytes', fields: { seconds: 99 } }],
    location: new GeoPoint(43.6, -79.4), bytes: Bytes.fromUint8Array(new Uint8Array([0, 1, 255])),
    reference: doc(firestore, 'users/owner/moods/2026-11-07'),
  };
  const backup = JSON.parse(JSON.stringify(createMoodBackup(source, [{ id: 'one', path: 'users/owner/moods/one', data }], moods, now)));
  for (const [key, original] of Object.entries(data)) {
    const restored = decode(backup.documents[0].data[key]);
    if (key === 'reference') {
      assert.deepEqual(restored, { type: 'reference', projectId: 'backup-test', databaseId: '(default)', path: original.path });
    } else assert.deepEqual(restored, original);
  }
});

test('empty backups are explicit and filenames retain the full export date and time', () => {
  const backup = createMoodBackup(source, [], moods, now);
  assert.equal(backup.documentCount, 0);
  assert.deepEqual(backup.documents, []);
  assert.equal(backupFilename(backup.exportedAt), 'pulse-backup-2026-11-07T21-12-34-567Z.json');
});

test('unrecognized values and another account’s documents fail instead of creating incomplete backups', () => {
  assert.throws(() => createMoodBackup(source, [{ id: 'one', path: 'users/owner/moods/one', data: { unsupported: new Date() } }], moods, now), /cannot preserve/);
  assert.throws(() => createMoodBackup(source, [{ id: 'one', path: 'users/someone-else/moods/one', data: {} }], moods, now), /does not belong/);
});
