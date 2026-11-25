import { describe, expect, it } from 'test-anywhere';

import { checkRequirements } from '../../scripts/check-requirements.mjs';

describe('requirements gate', () => {
  it('reports every requirement as done or blocked with a reason', async () => {
    const results = await checkRequirements();
    expect(results.length).toBeGreaterThan(10);
    for (const { id, status, problems } of results) {
      expect([id, ...problems]).toEqual([id]);
      expect(['done', 'blocked']).toContain(status);
    }
  });
});
