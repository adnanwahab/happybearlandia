// Compact reusable silhouette kits, dimensions in metres. Tiny surface details
// belong in the material. Consumers instance these parts by material family.
const part=(position,scale,material='metal')=>({position,scale,material});
export const PROP_KITS=Object.freeze({
 hvac:[part([0,.6,0],[2,1.2,1.5]),part([0,1.25,0],[1.7,.1,1.2],'dark')],
 vent:[part([0,.6,0],[.45,1.2,.45]),part([0,1.25,0],[.7,.15,.7])],
 antenna:[part([0,2,0],[.08,4,.08]),part([0,3,0],[1.5,.08,.08])],
 solar:[part([0,.6,0],[3,.1,1.8],'solar'),part([0,.3,0],[.1,.6,1.6])],
 'water-tank':[part([0,1,0],[1.5,2,1.5]),part([0,.25,0],[2,.5,2])],
 bench:[part([0,.45,0],[1.8,.15,.5],'wood'),part([0,.9,-.2],[1.8,.7,.12],'wood'),part([-.65,.2,0],[.12,.4,.4]),part([.65,.2,0],[.12,.4,.4])],
 bollard:[part([0,.5,0],[.18,1,.18])],
 hydrant:[part([0,.4,0],[.3,.8,.3],'red'),part([0,.6,0],[.7,.15,.15],'red')],
 bin:[part([0,.45,0],[.6,.9,.6],'dark')],
 streetlight:[part([0,3.5,0],[.14,7,.14]),part([.7,7,0],[1.5,.12,.15]),part([1.4,6.9,0],[.5,.12,.35],'lamp')],
 sign:[part([0,1.6,0],[.08,3.2,.08]),part([0,2.8,0],[1.4,.45,.08],'sign')],
 'traffic-light':[part([0,2.5,0],[.12,5,.12]),part([0,4.4,0],[.4,1,.35],'dark'),part([0,4.65,.19],[.18,.18,.06],'red')],
});
export function getPropKit(name){if(!PROP_KITS[name])throw new RangeError(`Unknown prop kit: ${name}`);return structuredClone(PROP_KITS[name]);}
