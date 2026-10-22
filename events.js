import {safeLink,posterURL,eventDate,eventState,displayEvents} from './event-utils.js';
import {elasticShelf} from './shelf-scroll.js';
const base=new URL('./',import.meta.url),content=document.querySelector('#event-content'),status=document.querySelector('#event-status'),retry=document.querySelector('#event-retry'),section=document.querySelector('#events');
let events=[];
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e};
function count(){const cards=[...content.children];if(!cards.length){document.querySelector('#event-count').textContent='';return}const x=content.scrollLeft;let best=0;cards.forEach((card,i)=>{const a=card.offsetLeft-cards[0].offsetLeft,b=cards[best].offsetLeft-cards[0].offsetLeft;if(Math.abs(a-x)<Math.abs(b-x))best=i});document.querySelector('#event-count').textContent=(best+1)+' / '+cards.length}
const shelf=elasticShelf(content,count);
// Keep the event panel bounded by the actual first card, including responsive changes.
const reference=document.querySelector('#about .introduction'),panel=section.querySelector('.events-section');
function sizePanel(){if(!reference)return;panel.style.width=reference.offsetWidth+'px';panel.style.height=reference.offsetHeight+'px'}
new ResizeObserver(sizePanel).observe(reference);
window.addEventListener('simsim:layout',sizePanel);sizePanel();
const lightbox=node('dialog','event-poster-lightbox'),largePoster=node('img');
lightbox.setAttribute('aria-label','행사 포스터 확대, 아무 곳이나 누르면 닫힙니다');
lightbox.append(largePoster);document.body.append(lightbox);
let posterTrigger=null;
lightbox.addEventListener('click',()=>lightbox.close());
lightbox.addEventListener('wheel',e=>e.preventDefault(),{passive:false});
lightbox.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
lightbox.addEventListener('close',()=>{document.body.classList.remove('poster-is-open');posterTrigger?.focus({preventScroll:true})});
function openPoster(src,title,trigger){posterTrigger=trigger;largePoster.src=src;largePoster.alt=title+' 포스터';document.body.classList.add('poster-is-open');lightbox.showModal()}
function render(){
 shelf.stop();content.replaceChildren();content.scrollLeft=0;
 if(!events.length){status.hidden=false;status.textContent='새로운 행사 소식을 준비하고 있어요.';count();return}
 status.hidden=true;
 for(const e of events){
  const card=node('article','event-card'),visual=node('div','event-poster'),src=posterURL(e.poster,base),frame=node('div','event-poster-frame');visual.append(frame);
  card.setAttribute('aria-label',e.title);
  if(src){const img=node('img');img.src=src;img.alt=e.title+' 포스터';img.decoding='async';img.loading='lazy';img.draggable=false;img.addEventListener('error',()=>{frame.replaceChildren(node('p','event-image-error','포스터를 불러오지 못했어요.'))},{once:true});const zoom=node('button','event-poster-zoom');zoom.type='button';zoom.setAttribute('aria-label',e.title+' 포스터 크게 보기');zoom.append(img);zoom.addEventListener('click',()=>openPoster(src,e.title,zoom));frame.append(zoom)}else frame.append(node('p','event-image-error','포스터 준비 중'));
  const copy=node('div','event-copy');copy.tabIndex=0;copy.setAttribute('aria-label',e.title+' 행사 안내');copy.append(node('span','event-badge',eventState(e)),node('h3','event-name',e.title));
  const dl=node('dl','event-facts');for(const [label,text] of [['일시',eventDate(e.startAt,e.endAt)],['장소',e.location]])dl.append(node('dt','',label),node('dd','',text));
  copy.append(dl,node('p','event-description',e.description));
  copy.addEventListener('wheel',event=>{if(copy.scrollHeight>copy.clientHeight+1){event.stopPropagation();if(event.deltaX&&!event.deltaY)event.preventDefault()}},{passive:false});
  copy.addEventListener('pointerdown',event=>event.stopPropagation());
  copy.addEventListener('keydown',event=>{if(copy.scrollHeight>copy.clientHeight+1&&['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))event.stopPropagation()});
  const href=safeLink(e.registrationUrl);if(href){const a=node('a','event-link','행사 신청하기 ↗');a.href=href;a.target='_blank';a.rel='noopener noreferrer';frame.append(a)}
  card.append(visual,copy);content.append(card);
 }
 count();
}
async function load(){
 retry.hidden=true;status.hidden=false;status.textContent='행사 소식을 불러오고 있어요.';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const r=await fetch(new URL('data/events.json',base),{cache:'no-store',signal:controller.signal});if(r.status===404){events=[];render();return}if(!r.ok)throw new Error();events=displayEvents(await r.json());render()}
 catch{status.hidden=false;status.textContent='행사 소식을 불러오지 못했어요. 잠시 뒤 다시 확인해주세요.';retry.hidden=false}
 finally{clearTimeout(timer)}
}
window.simsimEventShelf={track:content,move:shelf.move};
retry.addEventListener('click',load);load();
document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.shiftKey&&e.code==='KeyE'&&!e.repeat){e.preventDefault();location.assign(new URL('bookroom/',base))}});
