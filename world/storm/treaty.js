export const TREATY_VERSION = 'storm-mutual-aid.v1';
export const AID_TERMS = Object.freeze({
  responseBudget: 200000,
  localCrews: 1,
  neighborFunds: 150000,
  neighborCrews: 4,
  neighborReserve: 2,
  maxRequest: 2,
  maxOffer: 150000,
  dispatchFee: 15000,
  crewFee: 40000,
});

export function negotiateAid({ crews = 0, offer = 0 } = {}) {
  if (!Number.isInteger(crews) || crews < 0 || crews > AID_TERMS.maxRequest ||
      !Number.isInteger(offer) || offer < 0 || offer > AID_TERMS.maxOffer) {
    throw new Error('Choose 0 to 2 aid crews and a whole-dollar offer from 0 to 150,000.');
  }

  const before = {
    requester: { funds: AID_TERMS.responseBudget, crews: AID_TERMS.localCrews },
    neighbor: { funds: AID_TERMS.neighborFunds, crews: AID_TERMS.neighborCrews },
  };
  const minimumPrice = crews ? AID_TERMS.dispatchFee + crews * AID_TERMS.crewFee : 0;
  const canSpare = before.neighbor.crews - crews >= AID_TERMS.neighborReserve;
  const accepted = crews > 0 && canSpare && offer >= minimumPrice &&
    before.requester.funds >= minimumPrice;
  const reason = !crews ? 'No mutual aid requested.' : !canSpare ? 'The neighbor must retain its reserve crews.'
    : offer < minimumPrice ? 'The offer is below the neighbor’s dispatch price.'
    : before.requester.funds < minimumPrice ? 'The dispatch price exceeds the requesting city’s budget.'
    : 'The offer meets the dispatch price and the neighbor retains its reserve.';
  const transfer = { funds: accepted ? minimumPrice : 0, crews: accepted ? crews : 0 };
  const after = {
    requester: {
      funds: before.requester.funds - transfer.funds,
      crews: before.requester.crews + transfer.crews,
    },
    neighbor: {
      funds: before.neighbor.funds + transfer.funds,
      crews: before.neighbor.crews - transfer.crews,
    },
  };

  return {
    version: TREATY_VERSION, accepted, requestedCrews: crews, offer, crews: transfer.crews,
    price: transfer.funds, minimumPrice, reason, ledger: { before, after, transfer },
  };
}

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const money = value => '$' + number.format(value);

function element(parent, tag, text) {
  const node = parent.ownerDocument.createElement(tag);
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}

function appendLedger(table, { before, after }) {
  const body = element(table, 'tbody');
  for (const [label, id] of [['Requesting city', 'requester'], ['Neighboring city', 'neighbor']]) {
    const row = element(body, 'tr');
    element(row, 'th', label).scope = 'row';
    element(row, 'td', `${before[id].crews} → ${after[id].crews}`);
    element(row, 'td', `${money(before[id].funds)} → ${money(after[id].funds)}`);
  }
}

export function mountTreaty(host, { onChange }) {
  const root = element(host, 'section');
  root.className = 'storm-treaty';
  element(root, 'h3', 'Treaty Room');
  element(root, 'p', 'Negotiate temporary storm-response aid between two fictional cities. The neighboring city keeps at least two crews in reserve.');
  element(root, 'p', `Dispatch costs ${money(AID_TERMS.dispatchFee)} plus ${money(AID_TERMS.crewFee)} per crew. The offer is a spending limit in modeled dollars.`);
  const controls = element(root, 'div');
  controls.className = 'treaty-inputs';
  const crews = element(element(controls, 'label', 'Requested aid crews'), 'select');
  for (let count = 0; count <= AID_TERMS.maxRequest; count++) {
    element(crews, 'option', String(count)).value = String(count);
  }
  const offer = element(element(controls, 'label', 'Maximum offer (modeled USD)'), 'input');
  Object.assign(offer, { type: 'number', min: '0', max: String(AID_TERMS.maxOffer), step: '1', required: true });
  const summary = element(root, 'p');
  summary.setAttribute('role', 'status');
  const table = element(root, 'table');
  element(table, 'caption', 'Treaty ledger · before → after');
  const header = element(element(table, 'thead'), 'tr');
  for (const text of ['City', 'Crew count', 'Treasury (modeled USD)']) element(header, 'th', text).scope = 'col';

  function render({ crews: count = 0, offer: amount = 0 } = {}) {
    const outcome = negotiateAid({ crews: count, offer: amount });
    crews.value = String(count);
    offer.value = String(amount);
    if (outcome.accepted) {
      const units = outcome.crews === 1 ? 'crew' : 'crews';
      summary.textContent = `Aid accepted · ${outcome.crews} ${units} for ${money(outcome.price)} modeled USD. ${outcome.reason}`;
    } else {
      summary.textContent = outcome.reason +
        (outcome.minimumPrice ? ` Minimum offer ${money(outcome.minimumPrice)} modeled USD.` : '');
    }
    table.tBodies[0]?.remove();
    appendLedger(table, outcome.ledger);
  }

  function change() {
    if (!offer.reportValidity()) return;
    const terms = { crews: Number(crews.value), offer: offer.valueAsNumber };
    render(terms);
    onChange?.(terms);
  }

  crews.addEventListener('change', change);
  offer.addEventListener('change', change);
  render();
  return { render, destroy() { root.remove(); } };
}
