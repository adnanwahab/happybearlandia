import {assertHistoryIntegrity} from '../integrity.js';
import {assertMonth} from '../contracts.js';

/** Ten held observations, one second each. Never interpolate a model state. */
export function clipFrames(history, month) {
  assertMonth(month);assertHistoryIntegrity(history);
  const start=Math.max(0,month-9);
  return Array.from({length:10},(_,i)=>{
    const m=Math.min(month,start+i);
    return {month:m,baseline:history.baseline[m],plan:history.plan[m]};
  });
}

/** Small fixed-palette GIF89a. Clear each 200 literals so codes stay nine bits.
 * No audio, interpolation, looping extension, remote assets or metadata URLs. */
export function encodeGIF(width,height,frames) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>640||height>480||frames.length!==10)throw Error('Invalid bounded clip');
  const out=[];const byte=n=>out.push(n&255),word=n=>{byte(n);byte(n>>8);};
  for(const c of 'GIF89a')byte(c.charCodeAt(0));word(width);word(height);byte(247);byte(0);byte(0);
  for(let i=0;i<256;i++){byte(((i>>5)&7)*255/7);byte(((i>>2)&7)*255/7);byte((i&3)*255/3);}
  for(const pixels of frames){
    if(pixels.length!==width*height)throw Error('Missing clip pixels');
    out.push(33,249,4,0,100,0,0,0,44);word(0);word(0);word(width);word(height);byte(0);byte(8);
    const data=[];let bits=0,count=0;
    const code=n=>{bits|=n<<count;count+=9;while(count>=8){data.push(bits&255);bits>>>=8;count-=8;}};
    for(let i=0;i<pixels.length;i++){if(i%200===0)code(256);code(pixels[i]);}code(257);if(count)data.push(bits&255);
    for(let i=0;i<data.length;i+=255){byte(Math.min(255,data.length-i));for(const n of data.slice(i,i+255))byte(n);}byte(0);
  }byte(59);return new Uint8Array(out);
}
export function palettePixels(rgba){const result=new Uint8Array(rgba.length/4);for(let i=0;i<result.length;i++)result[i]=(rgba[i*4]>>5)<<5|(rgba[i*4+1]>>5)<<2|(rgba[i*4+2]>>6);return result;}
