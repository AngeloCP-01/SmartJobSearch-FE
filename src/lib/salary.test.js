import { describe, test, expect } from 'vitest';
import { formatSalaryRange } from './salary';

describe('formatSalaryRange', () => {
  test('returns null when both bounds are missing', () => {
    expect(formatSalaryRange(null, null)).toBe(null);
    expect(formatSalaryRange(undefined, undefined)).toBe(null);
  });

  test('abbreviates round thousands without a decimal', () => {
    expect(formatSalaryRange(35000, 45000)).toBe('$35k–$45k');
    expect(formatSalaryRange(90000, 110000)).toBe('$90k–$110k');
  });

  test('keeps one decimal for non-round thousands', () => {
    expect(formatSalaryRange(1500, 2500)).toBe('$1.5k–$2.5k');
  });

  test('shows values under 1000 in full instead of "$0k"', () => {
    expect(formatSalaryRange(0, 1000)).toBe('$0–$1k');
    expect(formatSalaryRange(500, 800)).toBe('$500–$800');
  });

  test('handles a single bound', () => {
    expect(formatSalaryRange(60000, null)).toBe('$60k');
    expect(formatSalaryRange(null, 80000)).toBe('$80k');
  });

  test('collapses an equal range to one value', () => {
    expect(formatSalaryRange(50000, 50000)).toBe('$50k');
  });
});
