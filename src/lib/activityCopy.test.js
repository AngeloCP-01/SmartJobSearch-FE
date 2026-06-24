import { activityCopy, relativeTime, dayBucket } from './activityCopy';

test('renders a sentence + icon per action', () => {
  expect(activityCopy('ApplicationCreated', { position: 'Backend Engineer' }).text).toBe('Created Backend Engineer');
  expect(activityCopy('ApplicationStatusChanged', { position: 'BE', from: 'Applied', to: 'Technical_Interview' }).text)
    .toBe('Moved BE from Applied to Technical Interview');
  expect(activityCopy('InterviewScheduled', { position: 'BE', type: 'Technical' }).text)
    .toBe('Scheduled a Technical interview for BE');
  expect(activityCopy('InterviewResultRecorded', { position: 'BE', type: 'HR', result: 'Passed' }).text)
    .toMatch(/Recorded Passed/);
  expect(activityCopy('DocumentLinked', { position: 'BE', name: 'Resume v2' }).text).toBe('Attached Resume v2 to BE');
  expect(activityCopy('ContactLinked', { position: 'BE', name: 'Jane' }).text).toBe('Added Jane to BE');
  expect(activityCopy('ApplicationDeleted', { position: 'BE' }).text).toBe('Deleted BE');
  expect(activityCopy('ApplicationCreated', {}).icon).toBeTruthy(); // a renderable lucide component
});

test('relativeTime formats recent timestamps', () => {
  const now = new Date('2026-06-24T12:00:00Z').getTime();
  expect(relativeTime('2026-06-24T11:59:30Z', now)).toBe('just now');
  expect(relativeTime('2026-06-24T11:30:00Z', now)).toBe('30m ago');
  expect(relativeTime('2026-06-24T09:00:00Z', now)).toBe('3h ago');
});

test('dayBucket labels today/yesterday', () => {
  const now = new Date('2026-06-24T12:00:00Z');
  expect(dayBucket('2026-06-24T08:00:00Z', now)).toBe('Today');
  expect(dayBucket('2026-06-23T08:00:00Z', now)).toBe('Yesterday');
});
