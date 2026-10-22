const info=document.querySelector('#info');
const scene=info.querySelector('.info-scene');
const card=scene.querySelector('.introduction');
const footer=document.querySelector('#garden');
const flowerBed=document.querySelector('#garden-flowers');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
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
const flowers=Array.from({length:96},(_,i)=>{
 const horizon=i<36;
 const x=horizon?(i+random())/36:random();
 const depth=horizon?4+random()*27:60+random()*330;
 const height=50+random()*61;
 const kind=Math.floor(random()*7);
 const lean=-12+random()*24;
 const plant=document.createElement('div');plant.className='garden-flower';
 plant.style.left=(x*100)+'%';
 plant.style.width=(44+random()*22)+'px';
 plant.style.height=(height+28)+'px';
 plant.style.color=colors[Math.floor(random()*colors.length)];
 plant.style.opacity=horizon?'.9':'.42';
 plant.style.setProperty('--wind-duration',(3.8+random()*2.6)+'s');
 plant.style.setProperty('--wind-delay',(-random()*6)+'s');
 plant.innerHTML=`<svg viewBox="-30 -145 60 150" aria-hidden="true" class="flower-sprout"><g transform="rotate(${lean} 0 0)"><path d="M0 0 Q-8 -${height*.48} 0 -${height}" stroke="#799261" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M-2 -20 Q-22 -39 -18 -47 Q0 -42 -2 -20 M-2 -34 Q18 -55 20 -46 Q16 -32 -2 -34" fill="#96af78"/><g transform="translate(0 -${height})">${head(kind)}</g></g></svg>`;
 const wind=document.createElement('div');wind.className='flower-wind';
 wind.append(plant.firstElementChild);plant.append(wind);
 flowerBed.append(plant);
 return {plant,x,depth,delay:.44+random()*.38};
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
 return groundTop+bez((lo+hi)/2,110,16,0,0)*groundHeight/500;
}
function positionFlowers(){
 const width=scene.clientWidth,span=width+160;
 flowers.forEach(({plant,x,depth})=>{
  const px=((x*span-drift)%span+span)%span-80;
  plant.style.left=px+'px';
  plant.style.top=(horizon(clamp(px/width))+depth)+'px';
 });
}
function ambient(now){
 const dt=ambientLast?Math.min(.05,(now-ambientLast)/1000):0;ambientLast=now;
 const box=scene.getBoundingClientRect();
 if(!reduced.matches&&!document.hidden&&box.bottom>0&&box.top<innerHeight){drift+=dt*26;positionFlowers()}
 if(revealed)ambientFrame=requestAnimationFrame(ambient);
}
function layout(){
 const viewport=document.documentElement.clientHeight;
 const compact=innerWidth<=640;
 const books=document.querySelector('#books');
 const bookCard=books.querySelector('.introduction'),bookStyle=getComputedStyle(books);
 // Use layout dimensions, not the intro's transient translate/scale transform.
 const reference={width:bookCard.offsetWidth,height:bookCard.offsetHeight,left:(scene.clientWidth-bookCard.offsetWidth)/2};
 const paddingTop=parseFloat(bookStyle.paddingTop),paddingBottom=parseFloat(bookStyle.paddingBottom);
 const cardTop=paddingTop;
 card.style.left=reference.left+'px';
 card.style.width=reference.width+'px';
 card.style.height='auto';
 finalCardHeight=Math.min(reference.height,card.offsetHeight);
 initialCardHeight=reference.height;
 card.style.height=reference.height+'px';
 const blurBoundary=document.querySelector('.logo-anchor').getBoundingClientRect().bottom;
 const originalShift=Math.max(0,cardTop-blurBoundary-18);
 const preservedGroundTop=cardTop+finalCardHeight-originalShift+46;
 const finalTop=Math.max(blurBoundary+18,Math.min(cardTop,viewport*.16));
 cardShift=Math.max(0,cardTop-finalTop);
 finalCardHeight=Math.min(finalCardHeight,Math.max(280,preservedGroundTop-finalTop-46));
 scene.style.setProperty('--info-card-top',cardTop+'px');
 // Leave the tallest blooms below the card and use the former empty lower area.
 groundTop=preservedGroundTop+(compact?80:Math.min(210,viewport*.16));
 const footerTop=groundTop+(compact?72:92);
 const content=footer.querySelector('.footer-inner');
 scene.style.setProperty('--footer-copy-top',footerTop+'px');
 scene.style.setProperty('--ground-top',groundTop+'px');
 // End immediately after the copyright, keeping it above the lower blur band.
 sceneHeight=footerTop+content.offsetHeight+4;
 groundHeight=Math.max(360,sceneHeight-groundTop+100);
 scene.style.setProperty('--ground-height',groundHeight+'px');
 // Reserve the ending's height before entry: reveal must never clamp scrollY.
 const height=Math.max(viewport,books.offsetHeight,sceneHeight);
 scene.style.height=height+'px';
 info.style.height=height+'px';
 positionFlowers();
 const cat=footer.querySelector('.garden-cat'),catWidth=compact?154:Math.min(290,Math.max(220,innerWidth*.11));
 const catHeight=catWidth*290/320;
 cat.style.width=catWidth+'px';cat.style.height=catHeight+'px';
 const catX=scene.clientWidth*(compact?.035:.045);
 cat.style.left=catX+'px';
 cat.style.top=(horizon((catX+catWidth*.62)/scene.clientWidth)-catHeight*.915+14)+'px';
 draw(progress);
}
function draw(p){
 const cardEase=smooth(p/.42);
 const shift=cardEase*cardShift;
 card.style.height=(initialCardHeight+(finalCardHeight-initialCardHeight)*cardEase)+'px';
 const rise=smooth((p-.20)/.40);
 scene.style.setProperty('--info-card-shift',(-shift)+'px');
 footer.style.transform=`translateY(${(1-rise)*(sceneHeight+60)}px)`;
 footer.style.visibility=p>.20?'visible':'hidden';
 footer.inert=p<.65;
 footer.setAttribute('aria-hidden',String(p<.21));
 footer.classList.toggle('garden-moving',rise>.1&&!document.hidden&&!reduced.matches);
 document.body.classList.toggle('garden-revealed',p>.2);
 flowers.forEach(({plant,delay})=>{
  const t=clamp((p-delay)/.16);
  const bloom=reduced.matches?(p>=delay?1:0):1+2.2*Math.pow(t-1,3)+1.2*Math.pow(t-1,2);
  plant.style.setProperty('--bloom',Math.max(0,bloom));
  plant.style.setProperty('--bloom-opacity',clamp(t*2));
 });
}
function tick(now){
 progress=clamp((now-startedAt)/duration);draw(progress);
 if(progress<1)frame=requestAnimationFrame(tick);
 else{frame=0;playing=false;scene.dataset.state='open'}
}
function reveal(){
 if(revealed)return;
 revealed=true;playing=true;scene.dataset.state='playing';layout();
 ambientLast=0;if(!ambientFrame)ambientFrame=requestAnimationFrame(ambient);
 startedAt=performance.now();
 if(reduced.matches){progress=1;draw(1);playing=false;scene.dataset.state='open'}
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
document.addEventListener('visibilitychange',()=>draw(progress));
reduced.addEventListener('change',()=>{if(reduced.matches&&playing){cancelAnimationFrame(frame);progress=1;playing=false;draw(1)}});
document.fonts.ready.then(layout);
new ResizeObserver(layout).observe(document.querySelector('#books .introduction'));
layout();
footer.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
 const destination=link.getAttribute('href');
 const nav=document.querySelector(`.section-nav a[href="${destination}"]`);
 if(nav){event.preventDefault();nav.click();nav.focus({preventScroll:true})}
}));
