import * as THREE from 'three';

/** CPU presentation adapter. Draws projected bounds of the SAME scene geometry.
 * No town generation, simulation, geographic inference, or outcome calculation. */
export function createCanvasRenderer({canvas=document.createElement('canvas')}={}) {
  const context=canvas.getContext('2d');
  if(!context)throw new Error('Canvas2D is unavailable');
  canvas.setAttribute('aria-label','Low-fidelity World Canvas2D; scene geometry bounds, drag to orbit and zoom');
  canvas.dataset.renderer='canvas2d';
  let width=1,height=1,disposed=false,last=-Infinity;
  const info={render:{drawCalls:0,triangles:0},memory:{textures:0,geometries:0}};
  const matrix=new THREE.Matrix4(),instance=new THREE.Matrix4();
  const renderer={isCanvasRenderer:true,domElement:canvas,info,shadowMap:{enabled:false},
    setPixelRatio(){},getPixelRatio:()=>1,hasFeature:()=>false,
    setSize(w,h){width=Math.max(1,Math.round(w));height=Math.max(1,Math.round(h));canvas.width=width;canvas.height=height;canvas.style.width=width+'px';canvas.style.height=height+'px';},
    render(scene,camera){
      if(disposed)return;const now=performance.now();if(now-last<66)return;last=now;
      scene.updateMatrixWorld();camera.updateMatrixWorld();const shapes=[];
      scene.traverseVisible(object=>{
        if(!object.isMesh||!object.geometry?.attributes?.position)return;
        const materials=Array.isArray(object.material)?object.material:[object.material],material=materials.find(m=>m?.visible!==false&&m?.opacity!==0);
        if(!material)return;
        object.geometry.computeBoundingBox();const box=object.geometry.boundingBox;if(!box||box.isEmpty())return;
        const count=object.isInstancedMesh?object.count:1;
        // Dense decorative GPU vegetation is omitted in this disclosed coarse view.
        if(count>3500)return;
        for(let i=0;i<count;i++) {
          matrix.copy(object.matrixWorld);if(object.isInstancedMesh){object.getMatrixAt(i,instance);matrix.multiply(instance);}
          const points=[];let depth=0;
          for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const v=new THREE.Vector3(x,y,z).applyMatrix4(matrix).project(camera);points.push({x:(v.x+1)*width/2,y:(1-v.y)*height/2});depth+=v.z/8;}
          if(depth< -1||depth>1||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))continue;
          const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
          if(Math.max(...xs)<0||Math.min(...xs)>width||Math.max(...ys)<0||Math.min(...ys)>height||Math.max(...xs)-Math.min(...xs)>width*3)continue;
          const color=material.color?.clone()||new THREE.Color(0x79a6b8);
          if(object.isInstancedMesh&&object.instanceColor){const tint=new THREE.Color();object.getColorAt(i,tint);color.multiply(tint);}
          shapes.push({points:hull(points),depth,color:'#'+color.getHexString(),opacity:material.opacity??1});
        }
      });
      context.fillStyle='#10242e';context.fillRect(0,0,width,height);
      shapes.sort((a,b)=>b.depth-a.depth);
      for(const shape of shapes){if(shape.points.length<3)continue;context.globalAlpha=Math.max(.15,Math.min(1,shape.opacity));context.fillStyle=shape.color;context.strokeStyle='#b0d6df55';context.beginPath();shape.points.forEach((p,i)=>i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y));context.closePath();context.fill();context.stroke();}
      context.globalAlpha=1;context.fillStyle='#e2f0fa';context.font='12px system-ui';context.fillText('Canvas2D · low fidelity · projected scene bounds · decorative detail omitted',16,height-16);
      info.render.drawCalls=shapes.length;info.render.triangles=0;
    },dispose(){disposed=true;canvas.remove();},
  };
  return {renderer,mode:'canvas2d'};
}
export function hull(points){
  const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y),cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const lower=[],upper=[];for(const p of sorted){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}for(const p of [...sorted].reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
