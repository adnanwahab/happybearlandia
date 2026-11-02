import {createWeatherSimulation} from './weather-simulation.js';
export const MAX_WEATHER_COMMANDS=128;
export function validateWeatherTimeline(timeline=[]){
 if(!Array.isArray(timeline)||timeline.length>MAX_WEATHER_COMMANDS)throw new Error('Weather input history is limited to 128 explicit commands; reset or start a new run.');
 let previous=-1;return timeline.map(command=>{if(!Number.isFinite(command?.minute)||command.minute<previous||command.minute<0)throw new Error('Weather commands need monotonic model minutes');previous=command.minute;const checker=createWeatherSimulation();checker.configure(command.parameters);return{minute:command.minute,parameters:structuredClone(command.parameters)};});
}
