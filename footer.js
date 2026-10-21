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
 plant.innerHTML=`<svg viewBox="-30 -145 60 150" aria-hidden="true" class="flower-sprout"><g transform="rotate(${lean} 0 0)"><path d="M0 0 Q-8 -${height*.48} 0 -${height}" stroke="#799261" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M-2 -20 Q-22 -39 -18 -47 Q0 -42 -2 -20 M-2 -34 Q18 -55 20 -46 Q16 -32 -2 -34" fill="#96af78"/><g transform="translate(0 -${height})">${head(kind)}</g></g></svg>`;
 flowerBed.append(plant);
 return {plant,x,depth,delay:.44+random()*.38};
});
let travel=1,cardShift=0,sceneHeight=0,frame=0;
function layout(){
 const viewport=document.documentElement.clientHeight;
 const compact=innerWidth<=640;
 const cardTop=compact?164:Math.max(116,viewport*.15);
 cardShift=Math.min(78,viewport*.085);
 scene.style.setProperty('--info-card-top',cardTop+'px');
 const groundTop=cardTop+card.offsetHeight-cardShift+46;
 const footerTop=groundTop+(compact?72:92);
 const content=footer.querySelector('.footer-inner');
 scene.style.setProperty('--footer-copy-top',footerTop+'px');
 scene.style.setProperty('--ground-top',groundTop+'px');
 sceneHeight=Math.max(viewport,footerTop+content.offsetHeight+36);
 scene.style.height=sceneHeight+'px';
 travel=Math.max(650,viewport*1.25);
 info.style.height=(sceneHeight+travel)+'px';
 flowers.forEach(({plant,x,depth})=>{
  const edge=Math.pow(Math.abs(x-.5)*2,2)*86;
  plant.style.top=(groundTop+edge+depth)+'px';
 });
 draw();
}
function draw(){
 frame=0;
 const p=clamp(-info.getBoundingClientRect().top/travel);
 const shift=smooth(p/.24)*cardShift;
 const rise=smooth((p-.20)/.40);
 scene.style.setProperty('--info-card-shift',(-shift)+'px');
 footer.style.transform=`translateY(${(1-rise)*(sceneHeight+60)}px)`;
 footer.style.visibility=p>.20?'visible':'hidden';
 footer.inert=p<.65;
 footer.setAttribute('aria-hidden',String(p<.21));
 footer.classList.toggle('garden-moving',rise>.1&&!document.hidden&&!reduced.matches);
 flowers.forEach(({plant,delay})=>{
  const bloom=reduced.matches?(p>=delay?1:0):smooth((p-delay)/.15);
  plant.style.setProperty('--bloom',bloom);
 });
}
function queue(){if(!frame)frame=requestAnimationFrame(draw)}
window.addEventListener('scroll',queue,{passive:true});
window.addEventListener('resize',layout);
document.addEventListener('visibilitychange',queue);
reduced.addEventListener('change',queue);
document.fonts.ready.then(layout);
new ResizeObserver(layout).observe(card);
layout();
footer.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
 const destination=link.getAttribute('href');
 const nav=document.querySelector(`.section-nav a[href="${destination}"]`);
 if(nav){event.preventDefault();nav.click();nav.focus({preventScroll:true})}
}));
