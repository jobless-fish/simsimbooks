// Spring motion for wheels and mouse drags; touch keeps native momentum.
export function elasticShelf(track,onChange=()=>{}){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let target=track.scrollLeft,velocity=0,frame=0,lastTime=0,lastWheel=0,drag=null,suppressClick=false;
 const max=()=>Math.max(0,track.scrollWidth-track.clientWidth),clamp=x=>Math.max(0,Math.min(x,max()));
 function stop(){cancelAnimationFrame(frame);frame=0;velocity=0;target=track.scrollLeft}
 function move(delta){
  if(!frame)target=track.scrollLeft;target=clamp(target+delta);
  if(reduced.matches){track.scrollLeft=target;onChange();return}
  if(frame)return;let position=track.scrollLeft;lastTime=performance.now();
  function tick(now){const dt=Math.min(.032,(now-lastTime)/1000);lastTime=now;velocity+=(160*(target-position)-23*velocity)*dt;position=clamp(position+velocity*dt);track.scrollLeft=position;onChange();if(Math.abs(target-position)<.7&&Math.abs(velocity)<5){track.scrollLeft=target;frame=0;velocity=0;onChange();return}frame=requestAnimationFrame(tick)}
  frame=requestAnimationFrame(tick);
 }
 function wheel(e){
  if(e.ctrlKey||e.metaKey||!max())return false;
  const delta=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*(e.deltaMode===1?18:e.deltaMode===2?innerHeight:1);
  if(!delta)return false;const outward=delta>0?track.scrollLeft>=max()-1:track.scrollLeft<=1;
  if(outward&&!frame&&performance.now()-lastWheel>180)return false;
  e.preventDefault();lastWheel=performance.now();move(delta);return true;
 }
 track.addEventListener('scroll',()=>{if(!frame&&!drag)target=track.scrollLeft;onChange()},{passive:true});
 track.addEventListener('dragstart',e=>e.preventDefault());
 track.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||!e.isPrimary||e.button!==0)return;stop();suppressClick=false;drag={id:e.pointerId,x:e.clientX,lastX:e.clientX,start:track.scrollLeft,time:performance.now(),speed:0,active:false}});
 track.addEventListener('pointermove',e=>{const d=drag;if(!d||e.pointerId!==d.id)return;const dx=e.clientX-d.x;if(!d.active){if(Math.abs(dx)<6)return;d.active=true;suppressClick=true;track.setPointerCapture(d.id);track.classList.add('dragging')}e.preventDefault();const now=performance.now();d.speed=.35*d.speed+.65*(d.lastX-e.clientX)/Math.max(1,now-d.time)*1000;track.scrollLeft=clamp(d.start-dx);target=track.scrollLeft;d.lastX=e.clientX;d.time=now;onChange()});
 function finish(e){const d=drag;if(!d||e.pointerId!==d.id)return;drag=null;track.classList.remove('dragging');if(track.hasPointerCapture(d.id))track.releasePointerCapture(d.id);if(d.active&&e.type==='pointerup'&&performance.now()-d.time<100)move(Math.max(-2200,Math.min(2200,d.speed))*.18)}
 for(const name of ['pointerup','pointercancel','lostpointercapture'])track.addEventListener(name,finish);
 track.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation();suppressClick=false}},true);
 let touch=null;
 track.addEventListener('touchstart',e=>{stop();suppressClick=false;const t=e.touches[0];touch=t?{x:t.clientX,y:t.clientY}:null},{passive:true});
 track.addEventListener('touchmove',e=>{const t=e.touches[0];if(t&&touch&&Math.hypot(t.clientX-touch.x,t.clientY-touch.y)>8)suppressClick=true},{passive:true});
 track.addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft'].includes(e.key)||e.target!==track)return;e.preventDefault();move((e.key==='ArrowRight'?1:-1)*track.clientWidth*.8)});
 new ResizeObserver(()=>{stop();track.scrollLeft=clamp(track.scrollLeft);onChange()}).observe(track);
 reduced.addEventListener('change',stop);
 return {move,wheel,stop};
}
