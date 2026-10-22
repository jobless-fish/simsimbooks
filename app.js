const body=document.body;
const scrollRail=document.createElement('div');scrollRail.className='site-scroll-rail';scrollRail.setAttribute('aria-hidden','true');
const scrollThumb=document.createElement('div');scrollThumb.className='site-scroll-thumb';scrollRail.append(scrollThumb);body.append(scrollRail);
function updateScrollIndicator(){
 const total=Math.max(1,document.documentElement.scrollHeight-innerHeight);
 const size=Math.max(26,scrollRail.clientHeight*innerHeight/document.documentElement.scrollHeight);
 scrollThumb.style.height=size+'px';
 scrollThumb.style.transform=`translateY(${Math.max(0,Math.min(1,scrollY/total))*(scrollRail.clientHeight-size)}px)`;
}
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
  body.dataset.stage='open';enter.disabled=false;window.dispatchEvent(new Event('simsim:opened'));
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
 updateScrollIndicator();
 updateSectionMotion();
 // Use rendered scroll position, never the clicked destination or wheel target.
 const y=window.scrollY;
 const stops=pageSections.slice(0,navLinks.length).map(s=>s.getBoundingClientRect().top+y);
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
navLinks.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();snapToSection(navLinks.indexOf(a),true)}));
window.addEventListener('scroll',queuePill,{passive:true});
window.addEventListener('simsim:layout',queuePill);
new ResizeObserver(queuePill).observe(sectionNav);
new ResizeObserver(queuePill).observe(main);
document.fonts.ready.then(queuePill);

// One section per gesture burst; horizontal shelves own their whole burst.
let scrollFrame=0,scrollTarget=0,snapAnchor=0,snapBusy=false;
const clampScroll=y=>Math.max(0,Math.min(y,document.documentElement.scrollHeight-innerHeight));
const sectionStops=()=>pageSections.map(s=>s.getBoundingClientRect().top+scrollY);
function nearestSection(){const stops=sectionStops();return stops.reduce((best,y,i)=>Math.abs(y-scrollY)<Math.abs(stops[best]-scrollY)?i:best,0)}
function stopGlide(){cancelAnimationFrame(scrollFrame);scrollFrame=0;snapBusy=false}
function glideTo(y,followEnd=false){
 stopGlide();scrollTarget=clampScroll(y);snapBusy=true;
 if(reduced.matches){window.scrollTo(0,scrollTarget);snapBusy=false;return}
 let position=scrollY,velocity=0,last=performance.now();
 function tick(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  scrollTarget=followEnd?clampScroll(Infinity):clampScroll(scrollTarget);
  const x=position-scrollTarget,omega=12,c=velocity+omega*x,decay=Math.exp(-omega*dt);
  position=scrollTarget+(x+c*dt)*decay;velocity=(velocity-omega*c*dt)*decay;
  if(Math.abs(position-scrollTarget)<.3&&Math.abs(velocity)<3){window.scrollTo(0,scrollTarget);scrollFrame=0;snapBusy=false;return}
  window.scrollTo(0,position);scrollFrame=requestAnimationFrame(tick);
 }
 scrollFrame=requestAnimationFrame(tick);
}
function snapToSection(index,viaNav=false){
 const previous=nearestSection();snapAnchor=Math.max(0,Math.min(index,pageSections.length-1));
 if(pageSections[snapAnchor].id==='artist'&&(previous!==snapAnchor||viaNav))window.simsimPeople?.enter(viaNav||snapAnchor>previous?0:2);
 if(pageSections[snapAnchor].id!=='info'&&window.simsimGarden?.revealed)window.simsimGarden.reset();
 glideTo(sectionStops()[snapAnchor]);
}
function peopleAtSection(){const section=pageSections[nearestSection()];return section.id==='artist'&&Math.abs(section.getBoundingClientRect().top)<=5?window.simsimPeople:null}
function shelfAtSection(){
 const section=pageSections[nearestSection()];if(Math.abs(section.getBoundingClientRect().top)>5)return null;
 if(section.id==='books')return {track:bookTrack,move:moveBooks};
 if(section.id==='events')return window.simsimEventShelf||null;
 return null;
}
function shelfCanMove(shelf,delta){return shelf&&shelf.track.scrollWidth>shelf.track.clientWidth+1&&(delta>0?shelf.track.scrollLeft<shelf.track.scrollWidth-shelf.track.clientWidth-2:shelf.track.scrollLeft>2)}
function editable(target){return target.closest('textarea,input,select,[contenteditable=true]')}
function copyCanScroll(target,delta){const copy=target.closest('.event-copy');return copy&&copy.scrollHeight>copy.clientHeight+1}
// After reaching INFO, allow continuous scrolling through its garden.
const infoSection=document.querySelector('#info');
function inInfoFlow(delta=0){
 const top=infoSection.getBoundingClientRect().top;
 return top < -2 || (top <= 2 && delta >= 0);
}
function gardenGesture(delta){
 const garden=window.simsimGarden;
 if(!garden||!inInfoFlow(delta))return false;
 if(garden.playing)return true;
 if(delta>0&&!garden.revealed){garden.reveal();glideTo(Infinity,true);return true}
 return false;
}
window.addEventListener('simsim:garden-open',()=>{if(inInfoFlow()&&Math.abs(scrollY-clampScroll(Infinity))>1)glideTo(Infinity,true)});
let wheelLast=-Infinity,wheelOwner=null,wheelAmount=0;
window.addEventListener('wheel',e=>{
 if(body.dataset.stage!=='open'||document.querySelector('dialog[open]')||e.ctrlKey||e.metaKey||editable(e.target))return;
 const now=performance.now(),fresh=now-wheelLast>320;wheelLast=now;
 if(fresh){wheelOwner=null;wheelAmount=0}
 const delta=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*(e.deltaMode===1?18:e.deltaMode===2?innerHeight:1);
 if(!delta)return;
 if(!snapBusy&&inInfoFlow(delta)){
  // The gesture that arrived at INFO must end before the reveal is armed.
  if(wheelOwner==='section'){e.preventDefault();return}
  if(gardenGesture(delta))e.preventDefault();wheelOwner=null;wheelAmount=0;return;
 }
 if(!wheelOwner&&copyCanScroll(e.target,delta))return;
 e.preventDefault();
 if(snapBusy||wheelOwner==='section'){wheelOwner='section';return}
 if(wheelOwner==='people')return;
 const people=peopleAtSection();
 if(people?.busy){wheelOwner='people';return}
 if(!wheelOwner&&people?.canMove(delta))wheelOwner='people-pending';
 if(wheelOwner==='people-pending'){wheelAmount+=delta;if(Math.abs(wheelAmount)>=12){people?.move(Math.sign(wheelAmount));wheelOwner='people'}return}
 if(!wheelOwner){const shelf=shelfAtSection();wheelOwner=shelfCanMove(shelf,delta)?shelf:'pending'}
 if(typeof wheelOwner==='object'){wheelOwner.move(delta);return}
 wheelAmount+=delta;
 if(Math.abs(wheelAmount)>=12){wheelOwner='section';snapToSection(nearestSection()+Math.sign(wheelAmount))}
},{passive:false});
let sectionTouch=null;
window.addEventListener('touchstart',e=>{
 if(body.dataset.stage!=='open'||document.querySelector('dialog[open]')||e.touches.length!==1||editable(e.target)){sectionTouch=null;return}
 const t=e.touches[0];sectionTouch={x:t.clientX,y:t.clientY,lastY:t.clientY,owner:snapBusy?'section':null,shelf:shelfAtSection(),target:e.target};
},{passive:true,capture:true});
window.addEventListener('touchmove',e=>{
 const g=sectionTouch;if(!g||e.touches.length!==1)return;
 const t=e.touches[0],dx=g.x-t.clientX,dy=g.y-t.clientY,step=g.lastY-t.clientY;g.lastY=t.clientY;
 if(g.owner==='garden'||g.owner==='people'){if(e.cancelable)e.preventDefault();return}
 if(g.owner==='native')return;
 if(!g.owner){
  if(Math.max(Math.abs(dx),Math.abs(dy))<10)return;
  if(Math.abs(dx)>Math.abs(dy)){g.owner='native';return}
  if(!snapBusy&&inInfoFlow(dy)){if(gardenGesture(dy)){g.owner='garden';if(e.cancelable)e.preventDefault();return}g.owner='native';return}
  if(copyCanScroll(g.target,dy)){g.owner='native';return}
  g.people=peopleAtSection();
  if(g.people?.busy){g.owner='people';if(e.cancelable)e.preventDefault();return}
  if(g.people?.canMove(dy)){g.owner='people-pending'}
  else g.owner=shelfCanMove(g.shelf,dy)?'shelf':'pending';
 }
 if(e.cancelable)e.preventDefault();
 if(g.owner==='people-pending'){if(Math.abs(dy)>=36){g.people.move(Math.sign(dy));g.owner='people'}return}
 if(g.owner==='shelf'){g.shelf.move(step);return}
 if(g.owner==='pending'&&Math.abs(dy)>=36){g.owner='section';snapToSection(nearestSection()+Math.sign(dy))}
},{passive:false,capture:true});
for(const name of ['touchend','touchcancel'])window.addEventListener(name,()=>{sectionTouch=null},{passive:true});
window.addEventListener('keydown',e=>{
 if(body.dataset.stage!=='open'||document.querySelector('dialog[open]')||editable(e.target)||(e.key===' '&&e.target.closest('button,a'))||e.defaultPrevented)return;
 const direction=['ArrowDown','PageDown',' '].includes(e.key)?1:['ArrowUp','PageUp'].includes(e.key)?-1:0;
 if(!direction&&!['Home','End'].includes(e.key))return;
 if(e.repeat&&inInfoFlow(direction)){e.preventDefault();return}
 if(!snapBusy&&inInfoFlow(direction)&&(direction>0||e.key==='End')){
  if(gardenGesture(1)){e.preventDefault();return}
 }
 if(!snapBusy&&e.key!=='Home'&&(e.key==='End'||inInfoFlow(direction)))return;
 e.preventDefault();if(e.repeat||snapBusy)return;
 const people=peopleAtSection();if(direction&&people?.busy)return;if(direction&&people?.canMove(direction)){people.move(direction);return}
 const shelf=shelfAtSection();if(direction&&shelfCanMove(shelf,direction)){shelf.move(direction*shelf.track.clientWidth*.8);return}
 snapToSection(e.key==='Home'?0:e.key==='End'?pageSections.length-1:nearestSection()+direction);
});
window.addEventListener('resize',()=>{if(body.dataset.stage==='open'&&!inInfoFlow())snapToSection(nearestSection())});
reduced.addEventListener('change',()=>{if(snapBusy){stopGlide();window.scrollTo(0,scrollTarget)}});

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
 const blur=document.createElement('div');blur.className='logo-line-blur';blur.setAttribute('aria-hidden','true');document.body.append(blur);
 const bottomBlur=document.createElement('div');bottomBlur.className='bottom-edge-blur';bottomBlur.setAttribute('aria-hidden','true');document.body.append(bottomBlur);
 const effects=pageSections.filter(section=>section.id!=='info'&&section.querySelector('.introduction')).map((section,i)=>{
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
