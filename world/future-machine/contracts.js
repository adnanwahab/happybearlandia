/** Frozen Future Machine v1 interfaces. Monthly City is the sole state authority. */
import { VERSION } from '../city/contracts.js';
export const CONTRACT_VERSION = 'future-machine.v1';
export const MODEL_VERSION = VERSION;
export const MONTHS = 120;
export const START_YEAR = 2026;
export const DEFAULT_RECIPE = Object.freeze({schemaVersion:CONTRACT_VERSION,modelVersion:VERSION,seed:42,households:30,months:120,intervention:Object.freeze({type:'housing',districtId:'d1',amount:24,cost:1000000,delay:0,compliance:1})});
export const ENTITY_COLLECTIONS = Object.freeze(['buildings','units','households','workers','businesses','jobs','links','projects','policies','utilities','facilities','parcels']);
export const METRIC_UNITS = Object.freeze({population:'people',households:'households',housingUnits:'homes',availableUnits:'homes',meanRent:'USD/month',unhoused:'households',employed:'workers',jobs:'jobs',businesses:'businesses',meanTravelMinutes:'minutes/link',balance:'USD',debt:'USD',capitalSpending:'USD cumulative',completedProjects:'projects'});
export function assertMonth(month) { if(!Number.isInteger(month)||month<0||month>MONTHS)throw new Error('Month must be an integer from 0 through 120');return month; }
export function calendarLabel(month) {assertMonth(month);return `${START_YEAR+Math.floor(month/12)}-${String(month%12+1).padStart(2,'0')}`;}
