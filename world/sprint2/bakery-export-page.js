import {
  bakeryExportLimitations, buildBakeryEvidence, serializeBakeryEvidence,
} from './bakery-export.js';

const find = id => document.getElementById(id);
const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'long', year: 'numeric', timeZone: 'UTC',
});

function monthDate(row) {
  return dateFormat.format(new Date(Date.UTC(row.year, row.month % 12, 1)));
}

function outcome(row) {
  return `bakery ${row.bakeryOpen ? 'open' : 'closed'}, ${row.workerHours} shift hours`;
}

for (const limitation of bakeryExportLimitations) {
  const item = document.createElement('li');
  item.textContent = limitation;
  find('limitations').append(item);
}

async function openEvidence() {
  const status = find('export-status');
  try {
    const recipe = new URLSearchParams(location.search).get('recipe');
    const evidence = await buildBakeryEvidence(recipe);
    const { baseline, intervention } = evidence.runs;
    const { reopenMonth } = intervention.recipe;
    const original = baseline.months[reopenMonth];
    const changed = intervention.months[reopenMonth];
    const action = reopenMonth === baseline.decisionMonth ? 'Keep the road open' : 'Reopen the road';
    find('recipe-details').textContent =
      `${action} in ${monthDate(changed)} (month ${reopenMonth}) · ${intervention.version} · seed ${intervention.seed}`;
    find('intervention-summary').textContent =
      `In that month, the baseline delivered ${original.delivered} flour units and the intervention delivered ${changed.delivered}.`;
    find('final-summary').textContent =
      `By ${monthDate(intervention.months.at(-1))}, the baseline shows ${outcome(baseline.months.at(-1))}. The intervention shows ${outcome(intervention.months.at(-1))}.`;
    find('journey-link').href = intervention.provenance.replayPath;

    const download = find('download');
    const blob = new Blob([serializeBakeryEvidence(evidence)], { type: 'application/json' });
    download.href = URL.createObjectURL(blob);
    download.download = `bakery-evidence-${intervention.provenance.recipeId}.json`;
    find('evidence-comparison').hidden = false;
    status.hidden = true;
  } catch (error) {
    status.textContent = `The comparison could not be exported. ${error.message}`;
  }
}

openEvidence();
