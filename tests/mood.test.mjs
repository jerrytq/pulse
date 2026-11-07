import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarSeries, localDate, shiftDate } from '../lib/mood.ts';

test('missing days stay null and recorded low scores remain one', () => {
  assert.deepEqual(calendarSeries([
    { date: '2026-11-01', score: 1 }, { date: '2026-11-03', score: 5 },
  ], '2026-11-01', '2026-11-03'), [
    { date: '2026-11-01', score: 1 }, { date: '2026-11-02', score: null }, { date: '2026-11-03', score: 5 },
  ]);
});

test('calendar arithmetic crosses DST, leap day, and year boundaries', () => {
  assert.equal(shiftDate('2026-11-01', 1), '2026-11-02');
  assert.equal(shiftDate('2026-03-08', 1), '2026-03-09');
  assert.equal(shiftDate('2024-03-01', -1), '2024-02-29');
  assert.equal(shiftDate('2026-01-01', -1), '2025-12-31');
});

test('today follows the local calendar rather than the UTC date', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'America/Toronto';
    assert.equal(localDate(new Date('2026-11-08T02:30:00Z')), '2026-11-07');
    assert.equal(localDate(new Date('2026-11-08T05:30:00Z')), '2026-11-08');
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('a first entry produces a single point and an empty history stays empty', () => {
  assert.deepEqual(calendarSeries([{ date: '2026-11-07', score: 3 }], '2026-11-07', '2026-11-07'), [{ date: '2026-11-07', score: 3 }]);
  assert.deepEqual(calendarSeries([], '2026-11-07', '2026-11-07'), [{ date: '2026-11-07', score: null }]);
});
