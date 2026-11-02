// Cross-section in metres: raised sidewalks and 15cm curb faces.
export function sidewalkProfile({width=9,sidewalkWidth=2,curbHeight=.15}={}) {
 if(![width,sidewalkWidth,curbHeight].every(Number.isFinite)||width<=0||sidewalkWidth<0||curbHeight<0)throw new RangeError('Invalid road cross-section');
 const half=width/2;return [
  {from:-half-sidewalkWidth,to:-half,y:curbHeight+.03,surface:1},
  {from:-half,to:half,y:.03,surface:0},
  {from:half,to:half+sidewalkWidth,y:curbHeight+.03,surface:1},
 ];
}
