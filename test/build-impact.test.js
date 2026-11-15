import { test, expect } from 'bun:test';
import { buildImpactLines, summarizeBuildImpact } from '../world/decision/build-impact.js';
import { createBuildingProposal } from '../world/buildings/proposal.js';
test('cost preview preserves inputs and distinguishes pending estimates from spending', () => {
 const p=createBuildingProposal({status:'approved',finance:{estimatedCost:100,publicSubsidy:0}});
 const before={projects:[]}, after={projects:[p]}, original=JSON.stringify({before,after});
 const lines=buildImpactLines(before,after).join(' ');
 expect(lines).toContain('Committed project estimates: $0');
 expect(lines).toContain('Pending project estimates after approval: $100');
 expect(lines).toContain('$0 public subsidy');
 expect(lines).toContain('permit 8 months + build 30 months');
 expect(lines).toContain('Remaining budget unavailable');
 expect(JSON.stringify({before,after})).toBe(original);
 expect(buildImpactLines(after,before).join(' ')).toContain('Estimated change: -$100');
});
test('empty, cancelled and unavailable estimates are explicit', () => {
 expect(summarizeBuildImpact({projects:[createBuildingProposal(),createBuildingProposal({status:'cancelled'})]})).toEqual({projects:0,estimatedCost:0,publicSubsidy:0});
 expect(buildImpactLines({},{}).join(' ')).toContain('Pending project estimates after approval: $0');
 expect(buildImpactLines({},null)).toEqual(['Pending estimates unavailable until this proposal validates.']);
});
