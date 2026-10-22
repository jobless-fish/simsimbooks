import {createPeopleState} from './people-state.js';
const section=document.querySelector('#artist'),stage=document.querySelector('#people-stage'),slides=[...stage.querySelectorAll('.people-slide')],counter=document.querySelector('#people-step');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),state=createPeopleState(3);
const ns='http://www.w3.org/2000/svg';
const copy={hye:['월악산 아래서 마당 가꾸고 바느질하며 그림을 그립니다. ‘글자 없는 그림책’ 시리즈를 펴냈으며 《어진이의 농장 일기》《세 엄마 이야기》《할머니에겐 뭔가 있어》《우리가 사는 자연》《평등은 개뿔》《와글와글 재밌어》 등을 쓰고 그렸습니다.'],hong:['1960년 전주에서 태어났다. <깡순이> 연재, 90년대 이후 역사를 새롭게 만화로 해석하는 작업을 통해 <역사신문>, <세계사신문>, <역사야, 나오너라> 등의 작품을 그렸다. 《역사야, 나오너라!》《술꾼》(2001년 ‘오늘의 우리 만화상’ 수상) 《세상에서 가장 멋진 내 친구 똥퍼》(2008년 ‘부천 만화상’ 수상) 등이 있습니다.']};
const portraits=new Map();let epoch=0,animations=new Set(),transitionTimer=0,visible=false;
function svgNode(tag,attrs={}){const el=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));return el}
// Reveal the original coloured marks, then fill the original illustration.
function brushRoute(offset=0){
 let d='';for(let i=0;i<72;i++){
  const y=-6+i*9,left=-35+(i%3)*5,right=635-(i%4)*4;
  const start=i%2?right:left,end=i%2?left:right;
  d+=(i===0?'M':' L')+start+' '+y+' C '+(start+(end-start)*.3)+' '+(y-2+offset)+' '+(start+(end-start)*.7)+' '+(y+2)+' '+end+' '+(y+1);
 }return d;
}
function createPortrait(name){
 const host=stage.querySelector(`[data-portrait="${name}"]`),svg=svgNode('svg',{viewBox:'0 0 600 600','aria-hidden':'true',focusable:'false'}),defs=svgNode('defs');
 const brushes=[];
 for(const phase of ['line','fill']){
  const mask=svgNode('mask',{id:`${phase}-${name}`,maskUnits:'userSpaceOnUse',x:0,y:0,width:600,height:600,'mask-type':'alpha'});
  const brush=svgNode('path',{d:brushRoute(phase==='fill'?2:0),fill:'none',stroke:'white','stroke-width':20,'stroke-linecap':'round','stroke-linejoin':'round'});mask.append(brush);defs.append(mask);brushes.push(brush);
 }
 const clip=svgNode('clipPath',{id:`head-${name}`});clip.append(svgNode('rect',{x:0,y:0,width:600,height:510}));defs.append(clip);svg.append(defs);
 const url=new URL(`assets/people/${name}-ink.webp`,import.meta.url).href,lineURL=new URL(`assets/people/${name}-line.webp`,import.meta.url).href;
 const outline=svgNode('image',{href:lineURL,width:600,height:600});if(name==='hong')outline.setAttribute('clip-path',`url(#head-${name})`);
 const lines=svgNode('g',{mask:`url(#line-${name})`});lines.append(outline);
 const paint=svgNode('image',{href:url,width:600,height:600}),fill=svgNode('g',{mask:`url(#fill-${name})`});fill.append(paint);svg.append(lines,fill);host.append(svg);
 const ready=Promise.all([url,lineURL].map(src=>{const image=new Image();image.src=src;return image.decode()})).then(()=>true).catch(()=>false);
 const data={host,lines,fill,brushes,ready,lengths:brushes.map(brush=>brush.getTotalLength())};portraits.set(name,data);return data;
}
for(const name of ['hye','hong']){
 const p=stage.querySelector(`[data-bio="${name}"]`);p.setAttribute('aria-label',copy[name].join(' '));
 let index=0;for(const line of copy[name]){const row=document.createElement('span');row.className='bio-line';row.setAttribute('aria-hidden','true');for(const char of [...line]){const span=document.createElement('span');span.className='bio-letter';span.textContent=char===' '?'\u00a0':char;span.style.setProperty('--letter-delay',`${index++*24}ms`);row.append(span)}p.append(row)}
}
function clearMotion(){
 epoch++;for(const animation of animations)animation.cancel();animations.clear();
}
function animate(el,keyframes,options){const animation=el.animate(keyframes,options);animations.add(animation);animation.finished.catch(()=>{});return animation}
function written(slide){slide.classList.add('is-written')}
async function draw(slide){
 const name=slide.querySelector('[data-portrait]')?.dataset.portrait;if(!name)return;
 const data=portraits.get(name)||createPortrait(name),token=epoch;slide.classList.remove('is-written');data.host.dataset.drawPhase='lines';
 data.lines.style.opacity='1';data.fill.setAttribute('mask',`url(#fill-${name})`);
 data.brushes.forEach((brush,i)=>{brush.style.strokeDasharray=data.lengths[i];brush.style.strokeDashoffset=data.lengths[i]});
 const loaded=await data.ready;if(token!==epoch)return;if(!loaded){data.host.textContent='프로필 그림을 불러오지 못했어요.';written(slide);return;}
 if(reduced.matches){data.lines.style.opacity='0';data.fill.removeAttribute('mask');data.host.dataset.drawPhase='complete';written(slide);return}
 try{
  await animate(data.brushes[0],[{strokeDashoffset:data.lengths[0]},{strokeDashoffset:0}],{duration:850,easing:'linear',fill:'forwards'}).finished;
  if(token!==epoch)return;data.host.dataset.drawPhase='fill';
  await animate(data.brushes[1],[{strokeDashoffset:data.lengths[1]},{strokeDashoffset:0}],{duration:950,easing:'linear',fill:'forwards'}).finished;
  if(token!==epoch)return;
  data.fill.removeAttribute('mask');data.lines.style.opacity='0';data.host.dataset.drawPhase='complete';written(slide);
 }catch{/* Leaving a portrait cancels its current drawing. */}
}
const book=section.querySelector('.people-book img');
function turnBook(){
 if(!book||reduced.matches)return;
 animate(book,[{transform:'perspective(700px) rotateY(0deg)'},{transform:'perspective(700px) rotateY(360deg)'}],{duration:850,easing:'cubic-bezier(.22,.7,.25,1)'});
}
function render(withTransition=true){
 clearMotion();clearTimeout(transitionTimer);
 const index=state.index;slides.forEach((slide,i)=>{slide.hidden=i!==index;slide.setAttribute('aria-hidden',String(i!==index));slide.classList.toggle('is-current',i===index);slide.classList.remove('is-written')});
 const active=slides[index];counter.textContent=`0${index+1} / 03`;
 if(withTransition&&!reduced.matches){state.lock();animate(active,[{opacity:0,transform:'translateY(10px) rotate(-.35deg)'},{opacity:1,transform:'none'}],{duration:620,easing:'cubic-bezier(.2,.75,.2,1)'});transitionTimer=setTimeout(()=>state.unlock(),640)}else state.unlock();
 if(index&&visible)draw(active);
}
window.simsimPeople={
 move(direction){if(!state.move(direction))return false;render();turnBook();return true},
 canMove(direction){return state.canMove(direction)},
 enter(index){state.set(index);render(false)},
 get busy(){return state.busy},get index(){return state.index}
};
new IntersectionObserver(entries=>{
 const wasVisible=visible;visible=entries[0].isIntersecting;
 if(visible&&!portraits.size){for(const name of ['hye','hong'])createPortrait(name)}
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
const titleObserver=new ResizeObserver(alignTitles);
titleObserver.observe(document.querySelector('#bookshop-title'));titleObserver.observe(document.querySelector('#about .introduction'));
window.addEventListener('resize',alignTitles);window.addEventListener('simsim:opened',alignTitles);document.fonts.ready.then(alignTitles);alignTitles();render(false);
