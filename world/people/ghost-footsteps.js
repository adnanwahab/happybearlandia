/** DOM-only markers; never added to simulation state, picking, or physics. */
export function mountGhostFootsteps({container,project}){
 const doc=container.ownerDocument,win=doc.defaultView,layer=doc.createElement('div');layer.className='ghost-footsteps';layer.setAttribute('aria-hidden','true');container.append(layer);
 let points=[],nodes=[],frame=null,last=null,disposed=false;
 const stats={frames:0,maxFrameGapMs:0,drawMs:0,markers:0};
 function draw(now){frame=null;if(disposed||!points.length)return;const start=win.performance.now();if(last!==null)stats.maxFrameGapMs=Math.max(stats.maxFrameGapMs,now-last);last=now;stats.frames++;
  points.forEach((p,i)=>{const at=project(p);nodes[i].hidden=!at;if(at)nodes[i].style.transform=`translate(${at.x}px,${at.y}px)`;});stats.drawMs=win.performance.now()-start;
  frame=win.requestAnimationFrame(draw);
 }
 function clear(){if(frame!==null)win.cancelAnimationFrame(frame);frame=null;last=null;points=[];nodes=[];layer.replaceChildren();stats.markers=0;}
 return{show(waypoints){clear();let distance=0;for(let i=1;i<waypoints.length;i++)distance+=Math.hypot(waypoints[i][0]-waypoints[i-1][0],waypoints[i][1]-waypoints[i-1][1]);const step=Math.max(2,distance/160);let carry=0;
  for(let i=1;i<waypoints.length;i++){const a=waypoints[i-1],b=waypoints[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let d=carry;d<length;d+=step){points.push([a[0]+(b[0]-a[0])*d/length,a[1]+(b[1]-a[1])*d/length]);if(points.length>=180)break;}carry=(carry-length)%step;if(carry<0)carry+=step;if(points.length>=180)break;}
  nodes=points.map((p,i)=>{const node=doc.createElement('span');node.textContent='👣';node.style.animationDelay=`${i*45}ms`;layer.append(node);return node;});stats.markers=points.length;frame=win.requestAnimationFrame(draw);
 },clear,getStats:()=>({...stats,active:frame!==null}),destroy(){disposed=true;clear();layer.remove();}};
}
