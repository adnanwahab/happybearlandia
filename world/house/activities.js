/** Added activities share the existing household people, clock and need meters. */
export const HOUSE_SCREEN_ACTIONS=Object.freeze(['watchTV','watchMovie','computerPlay','computerBrowse','computerStudy']);
export const HOUSE_ADDITIONAL_ACTIONS=Object.freeze({
 conversation:{durationMinutes:30,minAge:0,roomId:'living',requires:['exactly two actual home residents','both available or explicitly interrupted'],mechanism:'Both residents commit actual conversation minutes; social need changes over time and the existing relationship engine records a completion memory without an instant need bonus.'},
 watchTV:{durationMinutes:30,minAge:2,roomId:'living',requires:['installed TV','free viewing capacity','remaining child screen allowance'],mechanism:'Elapsed screen viewing replenishes fun with actual child screen minutes and room conditions; no happiness offset.'},
 watchMovie:{durationMinutes:90,minAge:2,roomId:'living',requires:['installed TV','free viewing capacity','remaining child screen allowance'],mechanism:'Elapsed movie viewing replenishes fun; the longer duration consumes real time and child screen allowance.'},
 computerPlay:{durationMinutes:30,minAge:6,roomId:'study',requires:['installed computer','free workstation','remaining child screen allowance'],mechanism:'Actual gaming time replenishes fun while using energy, social time and child screen allowance.'},
 computerBrowse:{durationMinutes:30,minAge:6,roomId:'study',requires:['installed computer','free workstation','remaining child screen allowance'],mechanism:'Actual browsing is a moderate leisure activity, not work or wages.'},
 computerStudy:{durationMinutes:30,minAge:6,roomId:'study',requires:['installed computer','free workstation','remaining child screen allowance'],mechanism:'Actual study exposure consumes time and screen allowance; it creates no grades, credentials, job or wage payment.'},
});
export const ACTIVITY_OBJECT_FOOTPRINTS=Object.freeze({tv:{width:2.2,depth:.65},computer:{width:2.1,depth:1.9}});
export const ACTIVITY_OBJECT_PLACEMENTS=Object.freeze({tv:{x:0,z:-2.1,rotation:0},computer:{x:-2.1,z:-.6,rotation:0}});
