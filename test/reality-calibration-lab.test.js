import { describe, expect, test } from 'bun:test';
import { runCalibrationLab, validateRecipe } from '../world/calibration/lab.js';
import { syntheticRecipe } from '../world/calibration/example.js';

describe('Reality Calibration Lab', () => {
  test('replays deterministically, leaves parents immutable and records metric/horizon errors', async () => {
    const recipe=syntheticRecipe(), before=structuredClone(recipe);
    const report=await runCalibrationLab(recipe);
    expect(await runCalibrationLab(recipe)).toEqual(report);
    expect(recipe).toEqual(before);
    expect(report.parameters[0].fitted).toBe(1.2);
    expect(report.parameters[0].evidenceLinks).toEqual(['#evidence-demo-response']);
    expect(report.parameters[0].applied).toBe(false);
    expect(report.validation.fitted.rows).toHaveLength(4);
    expect(new Set(report.validation.fitted.rows.map(row=>row.horizonYears))).toEqual(new Set([1,3]));
    expect(report.validation.fitted.rows.every(row=>row.resultLabel==='synthetic' && Number.isFinite(row.absoluteError))).toBe(true);
    expect(report.model.version).toBe('1.2.0');
    expect(report.answers.validation).toContain('no empirical predictive validation');
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });
  test('changing holdouts cannot change the fitted parameter or trials', async () => {
    const recipe=syntheticRecipe(), a=await runCalibrationLab(recipe);
    for(const item of recipe.origins[1].observations)item.metrics.median_rent=99999;
    const b=await runCalibrationLab(recipe);
    expect(b.trials).toEqual(a.trials);
    expect(b.parameters).toEqual(a.parameters);
    expect(b.tuning).toEqual(a.tuning);
    expect(b.validation.fitted.rows[0].absoluteError).not.toBe(a.validation.fitted.rows[0].absoluteError);
  });
  test('rejects future input vintages and late tuning observations', () => {
    const recipe=syntheticRecipe(); recipe.origins[0].inputsAvailableAt='2001-01-01';
    expect(()=>validateRecipe(recipe)).toThrow('available by');
    recipe.origins[0].inputsAvailableAt='2000-01-01'; recipe.origins[0].observations[0].availableAt='2006-01-01';
    expect(()=>validateRecipe(recipe)).toThrow('Tuning outcomes');
  });
  test('rejects missing, late and wrong-parameter evidence', () => {
    const recipe=syntheticRecipe(); recipe.evidence=[];
    expect(()=>validateRecipe(recipe)).toThrow('Research Library');
    recipe.evidence=syntheticRecipe().evidence; recipe.evidence[0].availableAt='2006-01-01';
    expect(()=>validateRecipe(recipe)).toThrow('pre-cutoff');
    recipe.evidence=syntheticRecipe().evidence; recipe.evidence[0].parameterId='migration';
    expect(()=>validateRecipe(recipe)).toThrow('Research Library');
  });
  test('rejects units, invalid dates, overlapping splits and unknown parameters', () => {
    for(const mutate of [
      r=>r.origins[0].observations[0].units.median_rent='USD/year',
      r=>r.origins[0].startDate='2000-02-30',
      r=>r.origins[1].split='tuning',
      r=>r.origins[0].parameters.secret_future_value=1,
      r=>r.tuning.values=[-1,3],
      r=>r.tuning.parameterId='initial_rent',
    ]) {const recipe=syntheticRecipe(); mutate(recipe); expect(()=>validateRecipe(recipe)).toThrow();}
  });
  test('reports missing observations without treating them as zeros', async () => {
    const recipe=syntheticRecipe(); recipe.origins[1].observations[0].metrics.median_rent=null;
    const report=await runCalibrationLab(recipe), missing=report.validation.fitted.rows[0];
    expect(missing.status).toBe('unavailable'); expect(missing.observed).toBeNull(); expect(missing.absoluteError).toBeUndefined();
  });
  test('does not force a worse grid value or claim tuning without evidence', async () => {
    const recipe=syntheticRecipe();
    for(const origin of recipe.origins)origin.parameters.rent_response=1.2;
    recipe.tuning.values=[0.1,0.2];
    expect((await runCalibrationLab(recipe)).parameters).toEqual([]);
    delete recipe.tuning; recipe.evidence=[];
    const report=await runCalibrationLab(recipe);
    expect(report.parameters).toEqual([]); expect(report.trials).toEqual([]);
  });
  test('preserves measured labels while all model outputs remain synthetic', async () => {
    const recipe=syntheticRecipe(); recipe.origins[1].observations[0].label='measured';
    const report=await runCalibrationLab(recipe);
    expect(report.validation.fitted.rows[0].observedLabel).toBe('measured');
    expect(report.validation.fitted.rows[0].resultLabel).toBe('synthetic');
    expect(report.answers.validation).toContain('user-declared measured');
  });
});
