import {createWeatherSimulation} from '../weather/weather-simulation.js';
import {setPopulationWeather} from './model.js';
import {validateWeatherTimeline} from '../weather/weather-inputs.js';
export {validateWeatherTimeline,MAX_WEATHER_COMMANDS} from '../weather/weather-inputs.js';
/** Worker-only input owner. Replay the same bounded commands on the same clock;
 * never move residents, run the economy, or create a UI-side weather authority. */
export function createPopulationWeatherInput(model,initialTimeline=[],saved=null){
 let simulation=createWeatherSimulation({seed:model.config.seed,initialMinute:0}),timeline=validateWeatherTimeline(initialTimeline),applied=0,lastMinute=0;
 if(saved){simulation.restore(saved.weather);timeline=validateWeatherTimeline(saved.timeline);lastMinute=saved.weather.minute;applied=saved.applied;if(!Number.isInteger(applied)||applied<0||applied>timeline.length||lastMinute!==model.minute)throw new Error("Invalid weather checkpoint");}
 return{
  setTimeline(next){const validated=validateWeatherTimeline(next);const common=Math.min(timeline.length,validated.length);for(let i=0;i<common;i++)if(JSON.stringify(timeline[i])!==JSON.stringify(validated[i]))throw new Error('Weather history changed; reset is required for another timeline');if(validated.length>timeline.length)timeline=validated;},
  sync(minute=model.minute){if(minute<lastMinute)throw new Error('Weather input owner requires a fresh instance for replay');while(applied<timeline.length&&timeline[applied].minute<=minute){const command=timeline[applied++];simulation.stepTo(Math.max(lastMinute,command.minute));simulation.configure(command.parameters);}simulation.stepTo(minute);lastMinute=minute;const snapshot=simulation.snapshot();setPopulationWeather(model,snapshot);return snapshot;},
  serialize:()=>({timeline:structuredClone(timeline),weather:simulation.serialize(),applied}),
 };
}
