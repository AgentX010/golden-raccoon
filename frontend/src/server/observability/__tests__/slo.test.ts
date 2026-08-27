import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateSlo, slos } from '../slo';
import { generateIncidentTimeline } from '../incidentTimeline';

describe('SLO Error Budgets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates SLO with burn rate', () => {
    const def = slos[0];
    const result = calculateSlo(def, 98, 100, 98, 100);
    expect(result.sli).toBe(98);
    expect(result.burnRateLong).toBe(2.0);
    expect(result.burnRateShort).toBe(2.0);
    expect(result.insufficientData).toBe(false);
  });

  it('handles minimum sample size correctly', () => {
    const def = slos[0];
    const result = calculateSlo(def, 9, 10, 9, 10);
    expect(result.insufficientData).toBe(true);
    expect(result.sli).toBeNull();
    expect(result.burnRateLong).toBeNull();
  });
});

describe('Incident Timeline Deduplication & Redaction', () => {
  it('deduplicates open/update/recover events and redacts sensitive data', () => {
    const rawEvents = [
      { id: 'inc-1', timestamp: 1000, type: 'open', description: 'wallet 0x1234567890123456789012345678901234567890 issue' },
      { id: 'inc-1', timestamp: 2000, type: 'update', description: 'still issue with 0x1234567890123456789012345678901234567890' },
      { id: 'inc-1', timestamp: 3000, type: 'recover', description: 'resolved wallet 0x1234567890123456789012345678901234567890 asset=USDC "payload": {"foo": "bar"}' }
    ];

    const timeline = generateIncidentTimeline(rawEvents);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].type).toBe('recover');
    expect(timeline[0].timestamp).toBe(3000);
    expect(timeline[0].description).not.toContain('0x1234');
    expect(timeline[0].description).toContain('[REDACTED_WALLET]');
    expect(timeline[0].description).toContain('[REDACTED]');
  });
});
