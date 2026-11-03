export const HOUSE_FLOORING=Object.freeze({
 oak:{label:'Oak planks',color:'#c6a073',accent:'#9e7954',pattern:'wood'},
 walnut:{label:'Walnut planks',color:'#77533c',accent:'#543a2b',pattern:'wood'},
 whitewood:{label:'Whitewashed wood',color:'#e4decc',accent:'#bcb6a3',pattern:'wood'},
 creamTile:{label:'Cream tiles',color:'#e8dfcb',accent:'#bcb7a8',pattern:'tile'},
 slateTile:{label:'Slate tiles',color:'#6f7d7b',accent:'#454f50',pattern:'tile'},
 terracotta:{label:'Terracotta tiles',color:'#be8061',accent:'#8c5a45',pattern:'tile'},
 checkerTile:{label:'Checkerboard tiles',color:'#ece8da',accent:'#55615d',pattern:'checker'},
 carpet:{label:'Sage carpet',color:'#8d9c7b',accent:'#7d8b6b',pattern:'carpet'}
});
export function validateFlooring(roomId,style){if(!['bedroom','kitchen','living','study','bathroom'].includes(roomId))throw Error('Choose an indoor room');if(style!==null&&style!=='default'&&!Object.hasOwn(HOUSE_FLOORING,style))throw Error('Choose a supported floor style');return style;}

export function validateFloorTile(tile){if(!tile||Array.isArray(tile)||Object.keys(tile).length!==2||!Number.isInteger(tile.x)||!Number.isInteger(tile.z)||Math.abs(tile.x)>1000||Math.abs(tile.z)>1000)throw Error('Choose a valid 1 × 1 floor square');return{x:tile.x,z:tile.z};}
export const floorTileKey=(roomId,tile)=>`${roomId}:${tile.x}:${tile.z}`;
