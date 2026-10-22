import {createPeopleState} from './people-state.js';
const section=document.querySelector('#artist'),stage=document.querySelector('#people-stage'),slides=[...stage.querySelectorAll('.people-slide')],counter=document.querySelector('#people-step');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),state=createPeopleState(3);
const ns='http://www.w3.org/2000/svg';
const copy={hye:['햇살 드는 자리에 책을 펼칩니다.','작은 그림과 긴 이야기를 좋아해요.','천천히 머물다 가실 수 있도록,','책방 한쪽을 다정히 채웁니다.'],hong:['마을의 느린 하루를 책방에 담아요.','재미있는 책은 먼저 펼쳐 보고,','나누고 싶은 이야기는 곁에 둡니다.','심심한 날, 편하게 놀러 오세요.']};
const portraits=new Map();let epoch=0,frames=new Set(),animations=new Set(),transitionTimer=0,visible=false;
function svgNode(tag,attrs={}){const el=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));return el}
function pencilRoute(){
 let d='';for(let i=0;i<19;i++){
  const y=-5+i*34,left=-30+(i%3)*6,right=630-(i%4)*5;
  const start=i%2?right:left,end=i%2?left:right;
  d+=(i===0?'M':' L')+start+' '+y+' C '+(start+(end-start)*.28)+' '+(y-8)+' '+(start+(end-start)*.72)+' '+(y+7)+' '+end+' '+(y+4);
 }return d;
}
function createPortrait(name){
 const host=stage.querySelector(`[data-portrait="${name}"]`),svg=svgNode('svg',{viewBox:'0 0 600 600','aria-hidden':'true',focusable:'false'});
 const defs=svgNode('defs'),filter=svgNode('filter',{id:`pencil-${name}`,x:'0%',y:'0%',width:'100%',height:'100%','color-interpolation-filters':'sRGB'});
 filter.append(svgNode('feColorMatrix',{type:'saturate',values:'0'}),svgNode('feConvolveMatrix',{order:'3',kernelMatrix:'1 1 1 1 -8 1 1 1 1',divisor:'1',bias:'1',preserveAlpha:'true'}));
 const paperKey='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 -1 -1 -1 0 3';
 function keyWhite(target){target.append(svgNode('feColorMatrix',{type:'matrix',values:paperKey}));const transfer=svgNode('feComponentTransfer');transfer.append(svgNode('feFuncA',{type:'linear',slope:'1.12',intercept:'-.06'}));target.append(transfer,svgNode('feComposite',{in2:'SourceGraphic',operator:'in'}))}
 keyWhite(filter);const ink=svgNode('filter',{id:`ink-${name}`,x:'0%',y:'0%',width:'100%',height:'100%','color-interpolation-filters':'sRGB'});keyWhite(ink);
 const mask=svgNode('mask',{id:`reveal-${name}`,maskUnits:'userSpaceOnUse',x:0,y:0,width:600,height:600});
 const brush=svgNode('path',{d:pencilRoute(),fill:'none',stroke:'white','stroke-width':51,'stroke-linecap':'round','stroke-linejoin':'round'});mask.append(brush);defs.append(filter,ink,mask);svg.append(defs);
 const group=svgNode('g',{mask:`url(#reveal-${name})`}),url=new URL(`assets/people/${name}.svg`,import.meta.url).href;
 const sketch=svgNode('image',{href:url,width:600,height:600,filter:`url(#pencil-${name})`}),paint=svgNode('image',{href:url,width:600,height:600,filter:`url(#ink-${name})`});paint.style.opacity='.08';group.append(sketch,paint);svg.append(group);
 const pencil=svgNode('g',{'class':'portrait-pencil'});pencil.append(svgNode('path',{d:'M0 0 L7 -24 L14 -20 L5 3 Z',fill:'#d3ad65',stroke:'#7d714f','stroke-width':1}),svgNode('path',{d:'M0 0 L5 3 L-1 5 Z',fill:'#4e5f55'}));svg.append(pencil);host.append(svg);
 const preload=new Image();preload.src=url;const ready=preload.decode().then(()=>true).catch(()=>false);
 const data={host,svg,group,brush,paint,sketch,pencil,ready,length:brush.getTotalLength()};portraits.set(name,data);return data;
}
for(const name of ['hye','hong']){
 createPortrait(name);const p=stage.querySelector(`[data-bio="${name}"]`);p.setAttribute('aria-label',copy[name].join(' '));
 let index=0;for(const line of copy[name]){const row=document.createElement('span');row.className='bio-line';row.setAttribute('aria-hidden','true');for(const char of [...line]){const span=document.createElement('span');span.className='bio-letter';span.textContent=char===' '?'\u00a0':char;span.style.setProperty('--letter-delay',`${index++*24}ms`);row.append(span)}p.append(row)}
}
function clearMotion(){
 epoch++;for(const id of frames)cancelAnimationFrame(id);frames.clear();for(const animation of animations)animation.cancel();animations.clear();
 for(const item of portraits.values())item.pencil.style.opacity='0';
}
function animate(el,keyframes,options){const animation=el.animate(keyframes,options);animations.add(animation);animation.finished.catch(()=>{});return animation}
function written(slide){slide.classList.add('is-written')}
async function draw(slide){
 const name=slide.querySelector('[data-portrait]')?.dataset.portrait;if(!name)return;
 const data=portraits.get(name),token=epoch;slide.classList.remove('is-written');
 data.group.setAttribute('mask',`url(#reveal-${name})`);data.brush.style.strokeDasharray=data.length;data.brush.style.strokeDashoffset=data.length;data.paint.style.opacity='.08';data.sketch.style.opacity='1';
 const loaded=await data.ready;if(token!==epoch)return;if(!loaded){data.host.textContent='프로필 그림을 불러오지 못했어요.';written(slide);return;}
 if(reduced.matches){data.group.removeAttribute('mask');data.paint.style.opacity='1';data.sketch.style.opacity='0';written(slide);return}
 const duration=2850;animate(data.brush,[{strokeDashoffset:data.length},{strokeDashoffset:0}],{duration,easing:'linear',fill:'forwards'});
 const started=performance.now();data.pencil.style.opacity='.8';
 function tick(now){
  if(token!==epoch)return;const progress=Math.min(1,(now-started)/duration),point=data.brush.getPointAtLength(data.length*progress);
  data.pencil.setAttribute('transform',`translate(${point.x} ${point.y}) rotate(-15)`);
  if(progress<1){const id=requestAnimationFrame(t=>{frames.delete(id);tick(t)});frames.add(id)}
  else{
   data.pencil.style.opacity='0';data.group.removeAttribute('mask');
   const fill=animate(data.paint,[{opacity:.08},{opacity:1}],{duration:650,easing:'ease-out',fill:'forwards'});
   animate(data.sketch,[{opacity:1},{opacity:0}],{duration:650,easing:'ease-out',fill:'forwards'});
   fill.finished.then(()=>{if(token===epoch)written(slide)}).catch(()=>{});
  }
 }
 const id=requestAnimationFrame(t=>{frames.delete(id);tick(t)});frames.add(id);
}
function render(withTransition=true){
 clearMotion();clearTimeout(transitionTimer);
 const index=state.index;slides.forEach((slide,i)=>{slide.hidden=i!==index;slide.setAttribute('aria-hidden',String(i!==index));slide.classList.toggle('is-current',i===index);slide.classList.remove('is-written')});
 const active=slides[index];counter.textContent=`0${index+1} / 03`;
 if(withTransition&&!reduced.matches){state.lock();animate(active,[{opacity:0,transform:'translateY(10px) rotate(-.35deg)'},{opacity:1,transform:'none'}],{duration:620,easing:'cubic-bezier(.2,.75,.2,1)'});transitionTimer=setTimeout(()=>state.unlock(),640)}else state.unlock();
 if(index&&visible)draw(active);
}
window.simsimPeople={
 move(direction){if(!state.move(direction))return false;render();return true},
 canMove(direction){return state.canMove(direction)},
 enter(index){state.set(index);render(false)},
 get busy(){return state.busy},get index(){return state.index}
};
new IntersectionObserver(entries=>{
 const wasVisible=visible;visible=entries[0].isIntersecting;
 if(visible&&!wasVisible&&state.index)draw(slides[state.index]);
 if(!visible){clearMotion();state.unlock();clearTimeout(transitionTimer)}
},{threshold:.55}).observe(section);
reduced.addEventListener('change',()=>{if(visible)render(false)});
function layoutPosition(el){let x=0,y=0;for(let node=el;node;node=node.offsetParent){x+=node.offsetLeft;y+=node.offsetTop}return {x,y}}
function alignTitles(){
 const title=document.querySelector('#bookshop-title'),panel=title.closest('.introduction'),about=document.querySelector('#about');
 const p=layoutPosition(panel),t=layoutPosition(title),a=layoutPosition(about),style=getComputedStyle(title);
 const values={'--section-title-x':`${t.x-p.x}px`,'--section-title-y':`${t.y-p.y}px`,'--section-title-size':style.fontSize,'--section-title-height':`${title.offsetHeight}px`,'--shared-card-top':`${p.y-a.y}px`};
 let changed=false;for(const [key,value] of Object.entries(values)){if(document.documentElement.style.getPropertyValue(key)!==value){document.documentElement.style.setProperty(key,value);changed=true}}
 if(changed)window.dispatchEvent(new Event('simsim:layout'));
}
for(const title of document.querySelectorAll('#artist h2,#events h2,#books h2,#info .introduction h2'))title.classList.add('aligned-section-title');
new ResizeObserver(alignTitles).observe(document.querySelector('#bookshop-title'));
window.addEventListener('resize',alignTitles);window.addEventListener('simsim:opened',alignTitles);document.fonts.ready.then(alignTitles);alignTitles();render(false);
