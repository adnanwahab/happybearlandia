import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {footprintLayout} from './scene/footprint.js';
import {inferredRoomTransforms,houseObjectSitePositions} from './site-positions.js';
const records=['bedroom','kitchen','living','study','bathroom'].map(id=>({id}));
test('worker-side site anchors match exact renderer anchors for rectangular concave and courtyard footprints',()=>{for(const outer of [[[-10,-8],[10,-8],[10,8],[-10,8]],[[-10,-8],[10,-8],[10,0],[0,0],[0,8],[-10,8]],[[-10,-8],[10,-8],[10,8],[-10,8]]]){const holes=outer.length===4?[[[-1,-1],[1,-1],[1,1],[-1,1]]]:[],site={status:'mapped',footprint:{outer,holes,bounds:{minX:-10,maxX:10,minZ:-8,maxZ:8}}},expected=footprintLayout(THREE,site,records).rooms,actual=inferredRoomTransforms(site,records);expect(actual.map(r=>({x:r.x,z:r.z,scale:r.scale,zone:r.zone}))).toEqual(expected.map(r=>({x:r.x,z:r.z,scale:r.scale,zone:r.zone})));const home={rooms:records,objects:[{id:'bed',type:'bed',roomId:'bedroom',placement:{x:1,z:2,rotation:0}}]},object=houseObjectSitePositions(site,home)[0];expect(object.sitePosition).toEqual({x:expected[0].x+expected[0].scale,z:expected[0].z+expected[0].scale*2});}});
