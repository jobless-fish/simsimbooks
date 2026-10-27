import {createMarqueeMotion,wrapMarquee} from './marquee-motion.js';
const info=document.querySelector('#info');
const scene=info.querySelector('.info-scene');
const card=scene.querySelector('.introduction');
const footer=document.querySelector('#garden');
const flowerBed=document.querySelector('#garden-flowers');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
let density=1;
let seed=27183;
const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const colors=['#fff9e9','#e6bd57','#91adc8','#e5acb5','#b8a5cf','#e5a184','#f3e0a8'];
const ellipse=(rx,ry,angle)=>`<ellipse cy="-11" rx="${rx}" ry="${ry}" transform="rotate(${angle})" fill="currentColor"/>`;
function head(kind){
 switch(kind){
  case 0:return Array.from({length:8},(_,i)=>ellipse(4,10,i*45)).join('')+'<circle r="5" fill="#d7a743"/>';
  case 1:return '<path d="M-15 -18 L-7 -12 L0 -23 L7 -12 L15 -18 Q18 7 0 7 Q-18 7 -15 -18Z" fill="currentColor"/>';
  case 2:return Array.from({length:5},(_,i)=>ellipse(7,12,i*72)).join('')+'<circle r="4" fill="#e4ba55"/>';
  case 3:return '<path d="M-14 -12 Q-18 -25 -7 -23 Q0 -31 7 -23 Q18 -25 14 -12 Q13 2 0 7 Q-13 2 -14 -12Z" fill="currentColor"/><path d="M0 5 V-8 M-4 -2 L0 -8 L4 -2" stroke="#d8aa43" stroke-width="2" fill="none"/>';
  case 4:return Array.from({length:10},(_,i)=>ellipse(3.5,8,i*36)).join('')+'<circle r="7" fill="#aa8144"/><circle r="4" fill="#caa047"/>';
  case 5:return '<path d="M-13 -9 Q-17 -22 -6 -22 Q0 -30 6 -22 Q17 -22 13 -9 Q20 0 8 5 Q0 15 -8 5 Q-20 0 -13 -9Z" fill="currentColor"/><circle r="4" fill="#e2b94e"/>';
  default:return '<path d="M-14 -6 Q-20 -21 -6 -19 Q0 -31 6 -19 Q20 -21 14 -6 Q20 7 5 6 Q0 16 -5 6 Q-20 7 -14 -6Z" fill="currentColor"/><circle r="5" fill="#f5d573"/>';
 }
}
// Jittered, seeded positions keep the meadow irregular without changing on resize.
const mobileGarden=matchMedia('(max-width:640px)').matches,flowerCount=mobileGarden?48:96,horizonCount=mobileGarden?24:36;
const flowers=Array.from({length:flowerCount},(_,i)=>{
 const horizon=i<horizonCount;
 const x=horizon?(i+random())/horizonCount:random();
 const depth=horizon?4+random()*27:60+random()*330;
 const height=50+random()*61;
 const kind=Math.floor(random()*7);
 const lean=-12+random()*24;
 const plant=document.createElement('div');plant.className='garden-flower';
 plant.style.left='0';plant.style.top='0';
 const width=44+random()*22;plant.style.width=width+'px';
 plant.style.height=(height+28)+'px';
 plant.style.color=colors[Math.floor(random()*colors.length)];
 plant.style.opacity=horizon?'.9':'.42';
 plant.style.setProperty('--wind-duration',(3.8+random()*2.6)+'s');
 plant.style.setProperty('--wind-delay',(-random()*6)+'s');
 plant.innerHTML=`<svg viewBox="-30 -145 60 150" aria-hidden="true" class="flower-sprout"><g transform="rotate(${lean} 0 0)"><path d="M0 0 Q-8 -${height*.48} 0 -${height}" stroke="#799261" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M-2 -20 Q-22 -39 -18 -47 Q0 -42 -2 -20 M-2 -34 Q18 -55 20 -46 Q16 -32 -2 -34" fill="#96af78"/><g transform="translate(0 -${height})">${head(kind)}</g></g></svg>`;
 const wind=document.createElement('div');wind.className='flower-wind';
 wind.append(plant.firstElementChild);plant.append(wind);
 flowerBed.append(plant);
 return {plant,x,depth,width,height,delay:.44+random()*.38};
});
let cardShift=0,sceneHeight=0,frame=0,startedAt=0,progress=0,initialCardHeight=0,finalCardHeight=0;
let revealed=false,playing=false;
let groundTop=0,groundHeight=500,drift=0,ambientFrame=0,ambientLast=0;
const duration=3000;
// Sample the actual SVG horizon so paws and plants share the same ground.
function horizon(x){
 let target=Math.min(x,1-x)*1440,lo=0,hi=1;
 const bez=(t,a,b,c,d)=>a*(1-t)**3+3*b*(1-t)**2*t+3*c*(1-t)*t*t+d*t*t*t;
 for(let i=0;i<20;i++){const t=(lo+hi)/2;if(bez(t,-50,220,430,720)<target)lo=t;else hi=t}
 return groundTop+bez((lo+hi)/2,scene.clientWidth<=760?24:110,scene.clientWidth<=760?4:16,0,0)*groundHeight/500;
}
let horizonSamples=[];
function cacheHorizon(){horizonSamples=Array.from({length:257},(_,i)=>horizon(i/256))}
function cachedHorizon(x){const value=clamp(x)*256,i=Math.min(255,Math.floor(value));return horizonSamples[i]+(horizonSamples[i+1]-horizonSamples[i])*(value-i)}
function positionFlowers(){
 const width=scene.clientWidth,span=width+160*density;
 flowers.forEach(({plant,x,depth})=>{
  const px=((x*span-drift)%span+span)%span-80*density;
  plant.style.transform=`translate3d(${px}px,${cachedHorizon(px/width)+depth*density}px,0) translate(-50%,-100%)`;
 });
}
let gardenVisible=false,neighborsVisible=false;
function ambient(now){
 ambientFrame=0;
 const dt=ambientLast?Math.min(.05,(now-ambientLast)/1000):0;ambientLast=now;
 if(!reduced.matches&&!document.hidden&&gardenVisible){drift+=dt*26*density;positionFlowers()}
 if(revealed&&gardenVisible&&!document.hidden&&!reduced.matches)ambientFrame=requestAnimationFrame(ambient);
}
function layout(){
 density=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--site-density'))||1;
 flowers.forEach(({plant,width,height})=>{plant.style.width=width*density+'px';plant.style.height=(height+28)*density+'px'});
 const viewport=document.documentElement.clientHeight;
 const compact=innerWidth<=760;
 footer.querySelector(".garden-ground>path").setAttribute("d",compact?"M-50 24 C220 4 430 0 720 0 C1010 0 1220 4 1490 24 V550 H-50 Z":"M-50 110 C220 16 430 0 720 0 C1010 0 1220 16 1490 110 V550 H-50 Z");
 if(compact){
  flowers.forEach(({plant,width,height})=>{plant.style.width=width*.72+"px";plant.style.height=(height+28)*.72+"px"});
  const mobileSpacing=getComputedStyle(document.querySelector("#about")),cardTop=parseFloat(mobileSpacing.paddingTop),gutter=parseFloat(mobileSpacing.paddingLeft);card.style.left=gutter+"px";card.style.width=(scene.clientWidth-gutter*2)+"px";card.style.height="auto";
  initialCardHeight=finalCardHeight=card.offsetHeight;cardShift=0;
  scene.style.setProperty("--info-card-top",cardTop+"px");
  const phoneGarden=document.body.classList.contains("phone-garden"),phonePaged=document.body.classList.contains("phone-paging");
  groundTop=phoneGarden?190:cardTop+initialCardHeight+78;const footerTop=phoneGarden?220:groundTop+72;const content=footer.querySelector(".footer-inner");
  sceneHeight=phonePaged?viewport:footerTop+content.offsetHeight+20;groundHeight=Math.max(400,sceneHeight-groundTop+80);
  scene.style.setProperty("--ground-top",groundTop+"px");scene.style.setProperty("--ground-height",groundHeight+"px");scene.style.setProperty("--footer-copy-top",footerTop+"px");
  scene.style.height=info.style.height=sceneHeight+"px";
  cacheHorizon();positionFlowers();const cat=footer.querySelector(".garden-cat"),catWidth=phoneGarden?90:126,catHeight=catWidth*290/320,catX=scene.clientWidth*.04;
  cat.style.width=catWidth+"px";cat.style.height=catHeight+"px";cat.style.left=catX+"px";cat.style.top=(horizon((catX+catWidth*.62)/scene.clientWidth)-catHeight*.915+14)+"px";draw(progress);return;
 }
 const books=document.querySelector('#books');
 const bookCard=books.querySelector('.introduction'),bookStyle=getComputedStyle(books);
 // Use layout dimensions, not the intro's transient translate/scale transform.
 const reference={width:bookCard.offsetWidth,height:bookCard.offsetHeight,left:(scene.clientWidth-bookCard.offsetWidth)/2};
 const paddingTop=parseFloat(bookStyle.paddingTop),paddingBottom=parseFloat(bookStyle.paddingBottom);
 const cardTop=paddingTop;
 card.style.left=reference.left+'px';
 card.style.width=reference.width+'px';
 card.style.height='auto';
 const cardStyle=getComputedStyle(card);
 const copy=card.querySelector(".copy-side");
 const copyMinimum=copy.offsetHeight+parseFloat(cardStyle.paddingTop)+parseFloat(cardStyle.paddingBottom)+2;
 finalCardHeight=Math.max(copyMinimum,Math.min(reference.height,card.offsetHeight));
 initialCardHeight=reference.height;
 card.style.height=reference.height+'px';
 const blurBoundary=document.querySelector('.logo-anchor').getBoundingClientRect().bottom;
 const originalShift=Math.max(0,cardTop-blurBoundary-18*density);
 const preservedGroundTop=cardTop+finalCardHeight-originalShift+46*density;
 const finalTop=Math.max(blurBoundary+18*density,Math.min(cardTop,viewport*.16));
 cardShift=Math.max(0,cardTop-finalTop);
 finalCardHeight=Math.max(copyMinimum,Math.min(finalCardHeight,Math.max(280*density,preservedGroundTop-finalTop-46*density)));
 scene.style.setProperty('--info-card-top',cardTop+'px');
 // Leave the tallest blooms below the card and use the former empty lower area.
 groundTop=preservedGroundTop+(compact?80:Math.min(210*density,viewport*.16));
 let footerTop=groundTop+(compact?72:92*density);
 const content=footer.querySelector('.footer-inner');
 // Tall desktop viewports still finish at the copyright, without an empty strip.
 const bottomGap=Math.max(0,viewport-(footerTop+content.offsetHeight+4*density));
 groundTop+=bottomGap;footerTop+=bottomGap;
 scene.style.setProperty('--footer-copy-top',footerTop+'px');
 scene.style.setProperty('--ground-top',groundTop+'px');
 sceneHeight=footerTop+content.offsetHeight+4*density;
 groundHeight=Math.max(360*density,sceneHeight-groundTop+100*density);
 scene.style.setProperty('--ground-height',groundHeight+'px');
 // Reserve the ending's height before entry: reveal must never clamp scrollY.
 const height=Math.max(viewport,books.offsetHeight,sceneHeight);
 scene.style.height=height+'px';
 info.style.height=height+'px';
 cacheHorizon();positionFlowers();
 const cat=footer.querySelector('.garden-cat'),catWidth=compact?154:Math.min(290*density,Math.max(220*density,innerWidth*.11));
 const catHeight=catWidth*290/320;
 cat.style.width=catWidth+'px';cat.style.height=catHeight+'px';
 const catX=scene.clientWidth*(compact?.035:.045);
 cat.style.left=catX+'px';
 cat.style.top=(horizon((catX+catWidth*.62)/scene.clientWidth)-catHeight*.915+14*density)+'px';
 draw(progress);
}
function draw(p){
 const cardEase=smooth(p/.42);
 const shift=cardEase*cardShift;
 card.style.setProperty("--map-camera",smooth(p/.48));
 card.style.height=(initialCardHeight+(finalCardHeight-initialCardHeight)*cardEase)+'px';
 const rise=smooth((p-.20)/.40);
 scene.style.setProperty('--info-card-shift',(-shift)+'px');
 footer.style.transform=`translateY(${(1-rise)*(sceneHeight+60)}px)`;
 footer.style.visibility=p>.20?'visible':'hidden';
 footer.inert=p<.65;
 footer.setAttribute('aria-hidden',String(p<.21));
 footer.classList.toggle('garden-moving',rise>.1&&gardenVisible&&!document.hidden&&!reduced.matches);
 document.body.classList.toggle('garden-revealed',p>.2);
 flowers.forEach(({plant,delay})=>{
  const t=clamp((p-delay)/.16);
  const bloom=reduced.matches?(p>=delay?1:0):1+2.2*Math.pow(t-1,3)+1.2*Math.pow(t-1,2);
  plant.style.setProperty('--bloom',Math.max(0,bloom));
  plant.style.setProperty('--bloom-opacity',clamp(t*2));
 });
}
function finishReveal(){frame=0;playing=false;syncActivity();scene.dataset.state='open';window.dispatchEvent(new Event('simsim:garden-open'))}
function tick(now){
 progress=clamp((now-startedAt)/duration);draw(progress);
 if(progress<1)frame=requestAnimationFrame(tick);
 else finishReveal()
}
function reveal(){
 if(revealed)return;
 revealed=true;playing=true;scene.dataset.state='playing';layout();
 ambientLast=0;syncActivity();
 startedAt=performance.now();
 if(reduced.matches){progress=1;draw(1);finishReveal()}
 else frame=requestAnimationFrame(tick);
}
function reset(){
 cancelAnimationFrame(frame);frame=0;revealed=false;playing=false;progress=0;
 cancelAnimationFrame(ambientFrame);ambientFrame=0;ambientLast=0;drift=0;
 scene.dataset.state='ready';layout();
}
window.simsimGarden={reveal,reset,get revealed(){return revealed},get playing(){return playing}};
window.addEventListener('resize',layout);
window.addEventListener('simsim:layout',layout);
window.addEventListener('simsim:opened',layout);
window.addEventListener('simsim:phone-layout',layout);
document.addEventListener('visibilitychange',()=>{draw(progress);syncActivity()});
reduced.addEventListener('change',()=>{if(reduced.matches&&playing){cancelAnimationFrame(frame);progress=1;draw(1);finishReveal()}});
document.fonts.ready.then(layout);
const footerObserver=new ResizeObserver(layout);
footerObserver.observe(document.querySelector('#books .introduction'));footerObserver.observe(footer.querySelector('.footer-inner'));
layout();
footer.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
 const destination=link.getAttribute('href');
 const nav=document.querySelector(`.section-nav a[href="${destination}"]`);
 if(nav){event.preventDefault();nav.click();nav.focus({preventScroll:true})}
}));

// One continuous coordinate is shared by automatic motion, drag and inertia.
const neighborMarquee=footer.querySelector('.neighbors-marquee');
const neighborTrack=neighborMarquee.querySelector('.neighbors-track');
const neighborGroup=neighborTrack.querySelector('.neighbors-group');
const neighborMotion=createMarqueeMotion();
let neighborHovered=false,neighborRate=1,neighborLast=0,neighborFrame=0,neighborSpan=0;
let neighborPointer=null,suppressNeighborClickUntil=0;
neighborMarquee.tabIndex=0;
function paintNeighbors(){neighborTrack.style.transform=`translate3d(${wrapMarquee(neighborMotion.position,neighborSpan)}px,0,0)`}
function neighborTick(now){
 neighborFrame=0;const dt=neighborLast?Math.min(.05,(now-neighborLast)/1000):0;neighborLast=now;
 if(!document.hidden&&neighborsVisible&&!footer.inert){
  const keyboardFocus=neighborMarquee.matches(':focus-visible')||!!neighborMarquee.querySelector(':focus-visible');
  const wanted=(neighborHovered||keyboardFocus) ? 0.1 : 1;
  neighborRate+=(wanted-neighborRate)*(1-Math.exp(-7*dt));
  neighborMotion.step(dt,-neighborSpan/42*neighborRate);paintNeighbors();
 }
 if(!reduced.matches&&neighborsVisible&&!document.hidden&&!footer.inert)neighborFrame=requestAnimationFrame(neighborTick);
}
function measureNeighbors(){neighborSpan=neighborGroup.getBoundingClientRect().width;paintNeighbors()}
function startNeighbors(){if(!reduced.matches&&!neighborFrame&&neighborsVisible&&!document.hidden&&!footer.inert){neighborLast=0;neighborFrame=requestAnimationFrame(neighborTick)}}
neighborMarquee.addEventListener('pointerenter',event=>{neighborHovered=event.pointerType!=='touch'});
neighborMarquee.addEventListener('pointerleave',()=>{neighborHovered=false});
neighborMarquee.addEventListener('pointerdown',event=>{
 if(event.button!==0||!event.isPrimary)return;
 suppressNeighborClickUntil=0;
 neighborPointer={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastAt:performance.now(),speed:0,moved:false,origin:0};
});
neighborMarquee.addEventListener('pointermove',event=>{
 const p=neighborPointer;if(!p||p.id!==event.pointerId)return;
 const dx=event.clientX-p.x,dy=event.clientY-p.y;
 if(!p.moved){
  if(Math.abs(dx)<6)return;
  if(Math.abs(dy)>Math.abs(dx)){neighborPointer=null;return}
  p.moved=true;p.origin=neighborMotion.begin();neighborMarquee.setPointerCapture(event.pointerId);neighborMarquee.classList.add('dragging');
 }
 if(event.cancelable)event.preventDefault();
 const now=performance.now(),dt=(now-p.lastAt)/1000;
 if(dt>0)p.speed=p.speed*.55+(event.clientX-p.lastX)/dt*.45;
 p.lastX=event.clientX;p.lastAt=now;neighborMotion.drag(p.origin+dx);
 if(reduced.matches){neighborMotion.settle();paintNeighbors()}
});
function endNeighborDrag(event){
 const p=neighborPointer;if(!p||event.pointerId!==p.id)return;
 neighborPointer=null;neighborMarquee.classList.remove('dragging');
 if(p.moved){
  const speed=event.type==='pointercancel'||performance.now()-p.lastAt>100||reduced.matches?0:p.speed;
  neighborMotion.release(speed);suppressNeighborClickUntil=performance.now()+250;
  if(neighborMarquee.hasPointerCapture(event.pointerId))neighborMarquee.releasePointerCapture(event.pointerId);
 }
}
for(const type of ['pointerup','pointercancel','lostpointercapture'])neighborMarquee.addEventListener(type,endNeighborDrag);
neighborMarquee.addEventListener('click',event=>{if(event.detail&&performance.now()<suppressNeighborClickUntil){event.preventDefault();event.stopPropagation()}},true);
neighborMarquee.addEventListener('dragstart',event=>event.preventDefault());
neighborMarquee.addEventListener('keydown',event=>{
 if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
 event.preventDefault();neighborMotion.begin();neighborMotion.drag(neighborMotion.position+(event.key==='ArrowLeft'?1:-1)*neighborSpan/5);neighborMotion.release();
 if(reduced.matches){neighborMotion.settle();paintNeighbors()}
});
new ResizeObserver(measureNeighbors).observe(neighborGroup);
reduced.addEventListener('change',()=>{cancelAnimationFrame(neighborFrame);neighborFrame=0;neighborMotion.release();neighborMotion.settle();paintNeighbors();startNeighbors()});
function syncActivity(){
 const active=gardenVisible&&revealed&&!document.hidden&&!reduced.matches;
 footer.classList.toggle('garden-moving',active&&progress>.24);
 if(active&&!ambientFrame){ambientLast=0;ambientFrame=requestAnimationFrame(ambient)}
 if(!active){cancelAnimationFrame(ambientFrame);ambientFrame=0;ambientLast=0}
 if(!neighborsVisible||document.hidden||footer.inert){cancelAnimationFrame(neighborFrame);neighborFrame=0;neighborLast=0}else startNeighbors();
}
new IntersectionObserver(entries=>{gardenVisible=entries[0].isIntersecting;syncActivity()}).observe(footer);
new IntersectionObserver(entries=>{neighborsVisible=entries[0].isIntersecting;syncActivity()}).observe(neighborMarquee);
reduced.addEventListener('change',syncActivity);
measureNeighbors();syncActivity();

