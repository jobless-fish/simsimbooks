import {safeLink,posterURL,eventDate,eventState,displayEvents} from './event-utils.js';
const base=new URL('./',import.meta.url),content=document.querySelector('#event-content'),status=document.querySelector('#event-status'),retry=document.querySelector('#event-retry'),controls=document.querySelector('.events-controls');
let events=[],index=0;
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e};
function render(){
 content.replaceChildren();
 if(!events.length){status.hidden=false;status.textContent='새로운 행사 소식을 준비하고 있어요.';controls.hidden=true;return}
 status.hidden=true;controls.hidden=events.length<2;
 const e=events[index],card=node('article','event-card'),visual=node('div','event-poster'),src=posterURL(e.poster,base);
 if(src){const img=node('img');img.src=src;img.alt=e.title+' 포스터';img.decoding='async';img.addEventListener('error',()=>{visual.replaceChildren(node('p','event-image-error','포스터를 불러오지 못했어요.'))},{once:true});visual.append(img)}
 else visual.append(node('p','event-image-error','포스터 준비 중'));
 const copy=node('div','event-copy');copy.append(node('span','event-badge',eventState(e)),node('h3','event-name',e.title));
 const dl=node('dl','event-facts');for(const [label,text] of [['일시',eventDate(e.startAt,e.endAt)],['장소',e.location]]){dl.append(node('dt','',label),node('dd','',text))}
 copy.append(dl,node('p','event-description',e.description));
 const href=safeLink(e.registrationUrl);if(href){const a=node('a','event-link','행사 신청하기 ↗');a.href=href;a.target='_blank';a.rel='noopener noreferrer';copy.append(a)}
 card.append(visual,copy);content.append(card);
 document.querySelector('#event-count').textContent=(index+1)+' / '+events.length;
 document.querySelector('#event-prev').disabled=index===0;document.querySelector('#event-next').disabled=index===events.length-1;
}
async function load(){
 retry.hidden=true;status.hidden=false;status.textContent='행사 소식을 불러오고 있어요.';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const r=await fetch(new URL('data/events.json',base),{cache:'no-store',signal:controller.signal});if(r.status===404){events=[];render();return}if(!r.ok)throw new Error();events=displayEvents(await r.json());index=0;render()}
 catch{status.hidden=false;status.textContent='행사 소식을 불러오지 못했어요. 잠시 뒤 다시 확인해주세요.';retry.hidden=false}
 finally{clearTimeout(timer)}
}
document.querySelector('#event-prev').addEventListener('click',()=>{index=Math.max(0,index-1);render()});
document.querySelector('#event-next').addEventListener('click',()=>{index=Math.min(events.length-1,index+1);render()});
retry.addEventListener('click',load);load();
document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.shiftKey&&e.code==='KeyE'&&!e.repeat){e.preventDefault();location.assign(new URL('bookroom/',base))}});
// Long descriptions scroll inside their own column before the page changes section.
content.addEventListener('wheel',e=>{const box=e.target.closest('.event-copy');if(!box)return;const can=e.deltaY>0?box.scrollTop+box.clientHeight<box.scrollHeight-2:box.scrollTop>1;if(can)e.stopPropagation()},{passive:true});
