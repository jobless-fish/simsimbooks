const body=document.body;
const enter=document.querySelector('#enter');
const sway=document.querySelector('.logo-sway');
const main=document.querySelector('#bookshop');
const landscape=document.querySelector('.scenery img');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let nudgeTimer,stageTimer,started=false,introStarted=false;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function scheduleNudge(){
  if(body.dataset.stage!=='ready'||reduced.matches||document.hidden)return;
  nudgeTimer=setTimeout(()=>{
    if(body.dataset.stage!=='ready')return;
    sway.classList.remove('nudging');
    void sway.offsetWidth;
    sway.classList.add('nudging');
    scheduleNudge();
  },500+Math.random()*1000);
}
function ready(){body.dataset.stage='ready';enter.disabled=false;scheduleNudge()}
async function intro(){
  if(introStarted)return;
  introStarted=true;
  await Promise.all(Array.from(document.querySelectorAll('.logo img'),img=>img.decode().catch(()=>{})));
  body.dataset.stage='rolling';
  stageTimer=setTimeout(()=>{body.dataset.stage='forming';stageTimer=setTimeout(ready,reduced.matches?100:1150)},reduced.matches?100:1750);
}
enter.addEventListener('click',async()=>{
  if(body.dataset.stage==='open'){location.reload();return}
  if(body.dataset.stage!=='ready'||started)return;
  started=true;clearTimeout(nudgeTimer);sway.classList.remove('nudging');
  body.dataset.stage='opening';enter.disabled=true;enter.setAttribute('aria-label','심심한책방 처음부터 다시 보기');
  // Let the logo dock before the illustrated landscape arrives.
  await wait(reduced.matches?40:1000);
  await landscape.decode().catch(()=>{});
  body.classList.add('landscape-loaded');
  await wait(reduced.matches?40:1450);
  body.classList.add('show-introduction');
  main.inert=false;main.removeAttribute('aria-hidden');document.querySelector('.section-nav').inert=false;requestAnimationFrame(()=>updatePill(false));
  await wait(reduced.matches?40:1450);
  body.dataset.stage='open';enter.disabled=false;
});
reduced.addEventListener('change',()=>{clearTimeout(nudgeTimer);sway.classList.remove('nudging');if(!reduced.matches)scheduleNudge()});
document.addEventListener('visibilitychange',()=>{clearTimeout(nudgeTimer);if(!document.hidden)scheduleNudge()});
intro();

const sectionNav=document.querySelector('.section-nav');
const navLinks=[...sectionNav.querySelectorAll('a')];
const pill=sectionNav.querySelector('.nav-pill');
const pageSections=[...document.querySelectorAll('.page-section')];
let navFrame=0;
function updatePill(){
 navFrame=0;
 updateSectionMotion();
 // Use rendered scroll position, never the clicked destination or wheel target.
 const y=window.scrollY;
 const stops=pageSections.map(s=>s.getBoundingClientRect().top+y);
 let index=0;
 while(index<stops.length-2&&y>=stops[index+1])index++;
 const next=Math.min(index+1,stops.length-1);
 const t=Math.max(0,Math.min(1,(y-stops[index])/Math.max(1,stops[next]-stops[index])));
 const a=navLinks[index],b=navLinks[next];
 const centerA=a.offsetLeft+a.offsetWidth/2,centerB=b.offsetLeft+b.offsetWidth/2;
 const center=centerA+(centerB-centerA)*t;
 const tension=reduced.matches?0:Math.sin(Math.PI*t);
 const w=a.offsetWidth+(b.offsetWidth-a.offsetWidth)*t+Math.abs(centerB-centerA)*.28*tension;
 pill.style.width=w+'px';
 pill.style.transform='translateX('+(center-w/2)+'px) scaleY('+(1-.13*tension)+')';
 const nearest=t<.5?index:next;
 navLinks.forEach((link,i)=>{
  if(i===nearest)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
  const weight=i===index?1-t:i===next?t:0;
  const channel=Math.round(55+200*weight);
  link.style.color='rgb('+channel+','+channel+','+channel+')';
 });
 pill.dataset.progress=(index+t).toFixed(4);
}
function queuePill(){if(!navFrame)navFrame=requestAnimationFrame(updatePill)}
navLinks.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();snapToSection(navLinks.indexOf(a))}));
window.addEventListener('scroll',queuePill,{passive:true});
new ResizeObserver(queuePill).observe(sectionNav);
new ResizeObserver(queuePill).observe(main);
document.fonts.ready.then(queuePill);

// Damped scrolling for wheels and section links; touch and keyboard remain native.
let scrollFrame=0,scrollTarget=0,lastScrollTime=0;
const clampScroll=y=>Math.max(0,Math.min(y,document.documentElement.scrollHeight-innerHeight));
function stopGlide(){cancelAnimationFrame(scrollFrame);scrollFrame=0;scrollTarget=scrollY}
function glideTo(y){
 scrollTarget=clampScroll(y);
 if(reduced.matches){stopGlide();window.scrollTo(0,clampScroll(y));return}
 if(scrollFrame)return;
 lastScrollTime=performance.now();
 let scrollPosition=scrollY;
 function tick(now){
  const dt=Math.min(40,now-lastScrollTime);lastScrollTime=now;
  scrollTarget=clampScroll(scrollTarget);
  scrollPosition+=(scrollTarget-scrollPosition)*(1-Math.exp(-dt/115));
  const next=scrollPosition;
  if(Math.abs(scrollTarget-scrollPosition)<.8){window.scrollTo(0,scrollTarget);scrollFrame=0;releaseSnap();return}
  window.scrollTo(0,next);scrollFrame=requestAnimationFrame(tick);
 }
 scrollFrame=requestAnimationFrame(tick);
}
window.addEventListener('wheel',e=>{
 if(body.dataset.stage!=='open'||e.ctrlKey||e.metaKey)return;
 if(e.defaultPrevented)return;
 if(!snapBusy&&!scrollFrame&&window.simsimEventWheel?.(e))return;
 if(handleBookWheel(e))return;
 if(reduced.matches||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
 if(e.target.closest('textarea,input,select,[contenteditable=true]'))return;
 const delta=e.deltaY*(e.deltaMode===1?18:e.deltaMode===2?innerHeight:1);
 e.preventDefault();if(snapBusy&&scrollFrame)return;if(snapBusy)cancelSnap();glideTo((scrollFrame?scrollTarget:scrollY)+delta);
},{passive:false});
window.addEventListener('touchstart',stopGlide,{passive:true});
window.addEventListener('pointerdown',e=>{if(!e.target.closest('.section-nav'))stopGlide()},{passive:true});
window.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key))stopGlide()});
reduced.addEventListener('change',stopGlide);
window.addEventListener('resize',stopGlide);

// Commit a section transition only once 60% of the travel has been rendered.
let snapAnchor=0,snapBusy=false,snapReleaseTimer=0,touchScrolling=false;
const sectionStops=()=>pageSections.map(s=>s.getBoundingClientRect().top+scrollY);
function releaseSnap(){
 if(!snapBusy||scrollFrame)return;
 clearTimeout(snapReleaseTimer);
 snapReleaseTimer=setTimeout(()=>{snapBusy=false},220);
}
function snapToSection(index){
 clearTimeout(snapReleaseTimer);
 snapAnchor=Math.max(0,Math.min(index,pageSections.length-1));
 snapBusy=true;
 glideTo(sectionStops()[snapAnchor]);
 releaseSnap();
}
function checkSectionSnap(){
 if(body.dataset.stage!=='open'||snapBusy||touchScrolling)return;
 const stops=sectionStops(),y=scrollY;
 if(snapAnchor<stops.length-1&&y>=stops[snapAnchor]+.6*(stops[snapAnchor+1]-stops[snapAnchor])){snapToSection(snapAnchor+1);return}
 if(snapAnchor>0&&y<=stops[snapAnchor]-.6*(stops[snapAnchor]-stops[snapAnchor-1]))snapToSection(snapAnchor-1);
}
function cancelSnap(){
 clearTimeout(snapReleaseTimer);const wasBusy=snapBusy;snapBusy=false;
 if(!wasBusy)return;
 const stops=sectionStops();
 snapAnchor=stops.reduce((best,y,i)=>Math.abs(y-scrollY)<Math.abs(stops[best]-scrollY)?i:best,0);
}
window.addEventListener('scroll',checkSectionSnap,{passive:true});
window.addEventListener('touchstart',()=>{touchScrolling=true;cancelSnap()},{passive:true});
window.addEventListener('touchend',()=>{touchScrolling=false;checkSectionSnap()},{passive:true});
window.addEventListener('touchcancel',()=>{touchScrolling=false;cancelSnap()},{passive:true});
window.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key))cancelSnap()});
window.addEventListener('pointerdown',e=>{if(!e.target.closest('.section-nav'))cancelSnap()},{passive:true});
window.addEventListener('resize',cancelSnap);


const bookTrack=document.querySelector('.book-track');
const booksSection=document.querySelector('#books');
let bookTarget=0,bookVelocity=0,bookFrame=0,bookTime=0,lastBookInput=0;
const bookMax=()=>Math.max(0,bookTrack.scrollWidth-bookTrack.clientWidth);
const clampBook=x=>Math.max(0,Math.min(x,bookMax()));
function stopBooks(){cancelAnimationFrame(bookFrame);bookFrame=0;bookVelocity=0;bookTarget=bookTrack.scrollLeft}
function moveBooks(delta){
 if(!bookFrame)bookTarget=bookTrack.scrollLeft;
 bookTarget=clampBook(bookTarget+delta);
 if(reduced.matches){bookTrack.scrollLeft=bookTarget;return}
 if(bookFrame)return;
 bookTime=performance.now();
 let position=bookTrack.scrollLeft;
 function tick(now){
  const dt=Math.min((now-bookTime)/1000,.032);bookTime=now;
  bookVelocity+=(160*(bookTarget-position)-23*bookVelocity)*dt;
  position=clampBook(position+bookVelocity*dt);
  bookTrack.scrollLeft=position;
  if(Math.abs(bookTarget-position)<.8&&Math.abs(bookVelocity)<5){bookTrack.scrollLeft=bookTarget;bookFrame=0;bookVelocity=0;return}
  bookFrame=requestAnimationFrame(tick);
 }
 bookFrame=requestAnimationFrame(tick);
}
function handleBookWheel(e){
 if(Math.abs(booksSection.getBoundingClientRect().top)>4||snapBusy||scrollFrame)return false;
 const delta=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*(e.deltaMode===1?18:e.deltaMode===2?innerWidth:1);
 if(!delta||bookMax()<1)return false;
 const x=bookTrack.scrollLeft,outward=delta>0?x>=bookMax()-1:x<=1;
 if(outward&&!bookFrame&&performance.now()-lastBookInput>180)return false;
 e.preventDefault();lastBookInput=performance.now();moveBooks(delta);return true;
}
bookTrack.addEventListener('keydown',e=>{
 if(['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();moveBooks((e.key==='ArrowRight'||e.key==='ArrowDown'?1:-1)*(bookTrack.querySelector('.book-cover').clientWidth+28))}
});
bookTrack.addEventListener('touchstart',()=>{stopBooks();suppressBookClick=false},{passive:true});
bookTrack.addEventListener('pointerdown',stopBooks,{passive:true});
bookTrack.addEventListener('focusin',()=>{if(!bookFrame)bookTarget=bookTrack.scrollLeft});
new ResizeObserver(()=>{stopBooks();bookTrack.scrollLeft=clampBook(bookTrack.scrollLeft)}).observe(bookTrack);
reduced.addEventListener('change',stopBooks);

// Direct manipulation shares the wheel spring after release.
let bookDrag=null,suppressBookClick=false;
bookTrack.addEventListener('dragstart',e=>e.preventDefault());
bookTrack.addEventListener('pointerdown',e=>{
 // Let the browser own touch scrolling and its iPad momentum.
 if(e.pointerType==='touch'||!e.isPrimary||e.button!==0)return;
 stopBooks();suppressBookClick=false;
 bookDrag={id:e.pointerId,startX:e.clientX,startY:e.clientY,lastX:e.clientX,time:performance.now(),startScroll:bookTrack.scrollLeft,velocity:0,active:false};
});
bookTrack.addEventListener('pointermove',e=>{
 const d=bookDrag;if(!d||e.pointerId!==d.id)return;
 const dx=e.clientX-d.startX;
 if(!d.active){
  if(Math.abs(dx)<6)return;
  d.active=true;suppressBookClick=true;bookTrack.setPointerCapture(d.id);bookTrack.classList.add('dragging');
 }
 e.preventDefault();
 const now=performance.now(),dt=Math.max(1,now-d.time);
 d.velocity=d.velocity*.35+((d.lastX-e.clientX)/dt*1000)*.65;
 bookTrack.scrollLeft=clampBook(d.startScroll-dx);bookTarget=bookTrack.scrollLeft;
 d.lastX=e.clientX;d.time=now;
});
function finishBookDrag(e){
 const d=bookDrag;if(!d||e.pointerId!==d.id)return;
 bookDrag=null;bookTrack.classList.remove('dragging');
 if(bookTrack.hasPointerCapture(d.id))bookTrack.releasePointerCapture(d.id);
 if(d.active&&e.type==='pointerup'&&performance.now()-d.time<100){
  const velocity=Math.max(-2200,Math.min(2200,d.velocity));
  moveBooks(velocity*.18);
 }
}
bookTrack.addEventListener('pointerup',finishBookDrag);
bookTrack.addEventListener('pointercancel',finishBookDrag);
bookTrack.addEventListener('lostpointercapture',finishBookDrag);
// Keep a swipe from opening the product link when the finger lifts.
let bookTouch=null;
bookTrack.addEventListener('touchstart',e=>{
 const touch=e.touches[0];
 bookTouch=e.touches.length===1?{x:touch.clientX,y:touch.clientY,scroll:bookTrack.scrollLeft}:null;
},{passive:true});
bookTrack.addEventListener('touchmove',e=>{
 if(!bookTouch)return;
 const touch=e.touches[0];
 if(e.touches.length!==1){bookTouch=null;return}
 if(Math.hypot(touch.clientX-bookTouch.x,touch.clientY-bookTouch.y)>8)suppressBookClick=true;
},{passive:true});
function finishBookTouch(){
 if(bookTouch&&Math.abs(bookTrack.scrollLeft-bookTouch.scroll)>4)suppressBookClick=true;
 bookTouch=null;
}
bookTrack.addEventListener('touchend',finishBookTouch,{passive:true});
bookTrack.addEventListener('touchcancel',finishBookTouch,{passive:true});
bookTrack.addEventListener('click',e=>{if(suppressBookClick){e.preventDefault();e.stopPropagation();suppressBookClick=false}},true);



// A small silhouette change at the logo line; content stays at its native size.
let neckEffects;
function prepareNeckEffects(){
 const ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');svg.setAttribute('class','motion-filters');svg.setAttribute('aria-hidden','true');
 const defs=document.createElementNS(ns,'defs');svg.append(defs);document.body.append(svg);
 // Distort only the backdrop sampled by the translucent panels.
 const glass=document.createElementNS(ns,'filter');glass.id='paper-glass-refraction';
 glass.setAttribute('x','-5%');glass.setAttribute('y','-5%');glass.setAttribute('width','110%');glass.setAttribute('height','110%');glass.setAttribute('color-interpolation-filters','sRGB');
 const grain=document.createElementNS(ns,'feTurbulence');grain.setAttribute('type','fractalNoise');grain.setAttribute('baseFrequency','.075');grain.setAttribute('numOctaves','2');grain.setAttribute('seed','12');grain.setAttribute('result','grain');
 const refract=document.createElementNS(ns,'feDisplacementMap');refract.setAttribute('in','SourceGraphic');refract.setAttribute('in2','grain');refract.setAttribute('scale','2');refract.setAttribute('xChannelSelector','R');refract.setAttribute('yChannelSelector','G');
 glass.append(grain,refract);defs.append(glass);

 const blur=document.createElement('div');blur.className='logo-line-blur';blur.setAttribute('aria-hidden','true');document.body.append(blur);
 const bottomBlur=document.createElement('div');bottomBlur.className='bottom-edge-blur';bottomBlur.setAttribute('aria-hidden','true');document.body.append(bottomBlur);
 const effects=pageSections.map((section,i)=>{
  const clip=document.createElementNS(ns,'clipPath');clip.id='section-edge-'+i;clip.setAttribute('clipPathUnits','objectBoundingBox');
  const path=document.createElementNS(ns,'path');clip.append(path);defs.append(clip);
  return {panel:section.querySelector('.introduction'),path,id:clip.id,active:false};
 });
 return {effects,blur,bottomBlur};
}
function updateSectionMotion(){
 if(!neckEffects)neckEffects=prepareNeckEffects();
 const boundary=document.querySelector('.logo-anchor').getBoundingClientRect().bottom;
 neckEffects.blur.style.height=boundary+'px';neckEffects.blur.hidden=reduced.matches;
 const bottomRange=boundary*.4;
 const lowerBoundary=innerHeight-bottomRange;
 neckEffects.bottomBlur.style.height=bottomRange+'px';neckEffects.bottomBlur.hidden=reduced.matches;
 neckEffects.effects.forEach(effect=>{
  const {panel,path}=effect,rect=panel.getBoundingClientRect();
  panel.style.removeProperty('filter');
  const upper=rect.top<boundary&&rect.bottom>0;
  const lower=rect.bottom>lowerBoundary&&rect.top<innerHeight;
  if(reduced.matches||(!upper&&!lower)){
   if(effect.active){panel.style.clipPath='';effect.active=false}return;
  }
  const edgeInset=distance=>{const p=Math.max(0,Math.min(1,distance/120));return .025*p*p*(3-2*p)};
  const topInset=upper?edgeInset(boundary-rect.top):0;
  const bottomInset=0; // Keep the lower card silhouette intact; blur provides the exit effect.
  // Each edge narrows by at most 2.5%; the middle and content keep their size.
  path.setAttribute('d',`M ${topInset} 0 H ${1-topInset} C ${1-topInset} .06 1 .10 1 .18 V .82 C 1 .90 ${1-bottomInset} .94 ${1-bottomInset} 1 H ${bottomInset} C ${bottomInset} .94 0 .90 0 .82 V .18 C 0 .10 ${topInset} .06 ${topInset} 0 Z`);
  panel.style.clipPath='url(#'+effect.id+')';effect.active=true;
 });
}
window.addEventListener('resize',queuePill);
reduced.addEventListener('change',queuePill);
