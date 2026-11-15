"""Export real V8 samples inside the longest page frame as an SVG flame graph.
Usage: python3 scripts/performance/trace-flame.py TRACE.json OUTPUT.svg
"""
import collections, html, json, pathlib, sys
trace=json.loads(pathlib.Path(sys.argv[1]).read_text())['traceEvents']
frame=max((e for e in trace if e.get('name')=='FunctionCall' and e.get('args',{}).get('data',{}).get('functionName')=='frame'),key=lambda e:e.get('dur',0))
profile=next(e for e in trace if e.get('name')=='Profile' and e['pid']==frame['pid'] and e['tid']==frame['tid'])
chunks=[e for e in trace if e.get('name')=='ProfileChunk' and e['pid']==profile['pid'] and e.get('id')==profile.get('id')]
nodes={node['id']:node for e in chunks for node in e.get('args',{}).get('data',{}).get('cpuProfile',{}).get('nodes',[])}
root={'name':'Main page sampled CPU during longest frame','value':0,'children':{}}
clock=profile['args']['data']['startTime'];stacks=collections.Counter()
for event in chunks:
 data=event.get('args',{}).get('data',{})
 for sample,delta in zip(data.get('cpuProfile',{}).get('samples',[]),data.get('timeDeltas',[])):
  previous=clock;clock+=delta
  weight=max(0,min(clock,frame['ts']+frame['dur'])-max(previous,frame['ts']))
  if not weight:continue
  stack=[];node=nodes.get(sample)
  while node:
   cf=node.get('callFrame',{});stack.append((cf.get('functionName') or '(anonymous)')+(' · '+cf['url'].rsplit('/',1)[-1] if cf.get('url') else ''));node=nodes.get(node.get('parent'))
  stack=list(reversed(stack))[1:];stacks[' → '.join(stack)]+=weight
  root['value']+=weight;node=root
  for name in stack:node=node['children'].setdefault(name,{'name':name,'value':0,'children':{}});node['value']+=weight
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="800" viewBox="0 0 1400 800"><rect width="1400" height="800" fill="#111820"/><style>text{font:11px sans-serif;fill:#edf1f5}</style><text x="16" y="26" style="font-size:20px">Legacy World · V8 sampled CPU flame graph · longest frame</text>',f'<text x="16" y="48">Actual Chrome trace: frame {frame["dur"]/1000:.3f} ms · sampled stack widths inside that frame, not illustrative proportions · worker threads excluded</text>']
def draw(node,x,y,width,depth):
 if width<1 or depth>28:return
 title=html.escape(f'{node["name"]}: {node["value"]/1000:.3f} sampled ms')
 svg.append(f'<g><title>{title}</title><rect x="{x:.2f}" y="{y}" width="{width:.2f}" height="23" fill="hsl({(depth*31+22)%360},47%,38%)" stroke="#111820"/>')
 if width>40:svg.append(f'<text x="{x+3:.2f}" y="{y+15}">{html.escape(node["name"][:max(3,int(width/6)-2)])}</text>')
 svg.append('</g>');offset=x
 for child in sorted(node['children'].values(),key=lambda c:-c['value']):
  size=width*child['value']/max(1,node['value']);draw(child,offset,y+24,size,depth+1);offset+=size
draw(root,16,68,1368,0);svg.append('</svg>');pathlib.Path(sys.argv[2]).write_text(''.join(svg))
pathlib.Path(sys.argv[2]+'.json').write_text(json.dumps({'frame':frame,'sampledMs':root['value']/1000,'topStacksMs':[(k,v/1000)for k,v in stacks.most_common(20)]},indent=2))
print(json.dumps({'frameMs':frame['dur']/1000,'sampledMs':root['value']/1000,'svg':sys.argv[2]}))
