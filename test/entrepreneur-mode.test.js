import {test,expect} from 'bun:test';
import {entrepreneurMilestones} from '../world/entrepreneur-mode.js';
import {createDefinition} from '../world/models/business-v1/content.js';
import {approveDefinition} from '../world/models/business-v1/schema.js';
import {createBusinessState,defaultPlan,simulatePeriod} from '../world/models/business-v1/index.js';
test('founder milestones read actual approved ledger, not projections or starting cash',()=>{expect(entrepreneurMilestones(null).every(g=>!g.complete)).toBe(true);const def=approveDefinition(createDefinition('local-retail'),1),state=createBusinessState(def,42);expect(entrepreneurMilestones(state)[0].complete).toBe(true);expect(entrepreneurMilestones(state)[1].complete).toBe(false);expect(entrepreneurMilestones(state)[2].complete).toBe(false);let next=state;for(let i=0;i<3;i++)next=simulatePeriod(next,defaultPlan(def)).state;expect(entrepreneurMilestones(next)[1].complete).toBe(next.cash>0&&!next.bankrupt);expect(entrepreneurMilestones(next)[2].complete).toBe(next.totalProfit>0);expect(state.period).toBe(0);});
