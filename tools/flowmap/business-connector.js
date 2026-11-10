import { VERSION } from './logistics.js';

/** Explicit demand selection prevents unrelated destinations from changing a business. */
export function logisticsBusinessInputs(result, demandIds) {
  if (result.version !== VERSION || !Array.isArray(demandIds) || !demandIds.length) throw Error('Version and explicit demand IDs required');
  const selected = [...new Set(demandIds)].map(id => {
    const demand = result.deliveries.find(d => d.demandId === id);
    if (!demand) throw Error(`Unknown logistics demand: ${id}`);
    return demand;
  });
  const delivered = selected.reduce((sum, d) => sum + d.delivered, 0);
  const requested = selected.reduce((sum, d) => sum + d.delivered + d.unserved, 0);
  const shipmentHours = selected.reduce((sum, d) => sum + d.shipments.reduce((s, shipment) => s + shipment.units * shipment.hours, 0), 0);
  return {
    externalInputs: { deliveredSupplyFraction: requested ? delivered / requested : 1, deliveryDelayDays: delivered ? shipmentHours / delivered / 24 : 0 },
    context: result.context,
    provenance: { modelVersion: VERSION, inputHash: result.inputHash, demandIds: [...new Set(demandIds)], classification: 'synthetic', delayDefinition: 'delivered-volume weighted transit hours / 24; unavailable supply represented by fraction' },
  };
}
