import {elasticShelf} from './shelf-scroll.js';
import {postURL,postImage,postDate} from './instagram-utils.js';
const base=new URL('./',import.meta.url),track=document.querySelector('#instagram-track'),status=document.querySelector('#instagram-status'),retry=document.querySelector('#instagram-retry'),counter=document.querySelector('#instagram-count');
const dialog=document.querySelector('#instagram-dialog'),viewer=document.querySelector('#instagram-viewer'),dialogStatus=document.querySelector('#instagram-dialog-status'),photoToggle=document.querySelector('#instagram-photo-toggle'),original=document.querySelector('#instagram-original');
let posts=[],current=null,loadTimer=0,opener=null,photoOnly=false;
function element(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node}
function count(){
 const cards=[...track.children];if(!cards.length){counter.textContent='';return}
 let nearest=0;const start=cards[0].offsetLeft;
 cards.forEach((card,i)=>{if(Math.abs(card.offsetLeft-start-track.scrollLeft)<Math.abs(cards[nearest].offsetLeft-start-track.scrollLeft))nearest=i});
 counter.textContent=`${nearest+1} / ${cards.length}`;
}
const shelf=elasticShelf(track,count);window.simsimInstagramShelf={track,move:shelf.move};
function photo(post){const img=element('img','instagram-large-photo');img.src=post.image;img.alt=post.label;return img}
function showPhoto(){
 if(!current)return;clearTimeout(loadTimer);viewer.replaceChildren(photo(current));photoOnly=true;
 photoToggle.textContent='게시물 전체 보기';dialogStatus.textContent='사진을 크게 보고 있어요. 전체 보기에서 글과 동영상도 볼 수 있어요.';
}
function showEmbed(){
 clearTimeout(loadTimer);photoOnly=false;photoToggle.textContent='사진만 크게 보기';viewer.replaceChildren();dialogStatus.textContent='인스타그램 게시물을 불러오고 있어요.';
 const frame=element('iframe','instagram-embed');frame.title=current.label+' 인스타그램 게시물';
 // An official public embed, never the Instagram profile or a login page.
 frame.src=current.url+'embed/captioned/';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allow='autoplay; encrypted-media; picture-in-picture';
 frame.addEventListener('load',()=>{clearTimeout(loadTimer);if(viewer.contains(frame))dialogStatus.textContent='게시물 안에서 사진과 글을 확인할 수 있어요. 표시되지 않으면 사진 보기를 눌러주세요.'},{once:true});
 frame.addEventListener('error',()=>{if(viewer.contains(frame))showPhoto()},{once:true});viewer.append(frame);
 loadTimer=setTimeout(()=>{if(viewer.contains(frame))dialogStatus.textContent='불러오는 데 시간이 걸리고 있어요. 사진만 크게 보기도 이용할 수 있어요.'},9000);
}
function open(post,button){
 current=post;opener=button;original.href=post.url;document.querySelector('#instagram-dialog-title').textContent=post.date||'책방의 인스타그램';
 window.dispatchEvent(new Event('simsim:modal-open'));shelf.stop();dialog.showModal();document.body.classList.add('instagram-modal-open');showEmbed();
}
function cleanup(){clearTimeout(loadTimer);viewer.replaceChildren();current=null;document.body.classList.remove('instagram-modal-open');opener?.focus({preventScroll:true});opener=null}
document.querySelector('#instagram-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',cleanup);
dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close()});
photoToggle.addEventListener('click',()=>photoOnly?showEmbed():showPhoto());
function render(){
 shelf.stop();track.replaceChildren();track.scrollLeft=0;
 for(const post of posts){
  const button=element('button','instagram-card');button.type='button';button.setAttribute('aria-label',post.label+' 크게 보기');button.setAttribute('aria-haspopup','dialog');
  const img=element('img');img.src=post.image;img.alt=post.label;img.loading='lazy';img.decoding='async';img.draggable=false;
  img.addEventListener('error',()=>{img.hidden=true;button.classList.add('instagram-image-missing')},{once:true});
  button.append(img,element('span','instagram-card-type',post.type==='VIDEO'?'REEL':'POST'),element('span','instagram-card-date',post.date));
  button.addEventListener('click',()=>open(post,button));track.append(button);
 }
 status.hidden=posts.length>0;status.textContent=posts.length?'':'책방의 새로운 사진을 준비하고 있어요.';count();
}
async function load(){
 retry.hidden=true;status.hidden=false;status.textContent='책방의 일상을 불러오고 있어요.';
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
 try{
  const response=await fetch(new URL('data/instagram.json',base),{cache:'no-store',signal:abort.signal});if(!response.ok)throw new Error();
  const data=await response.json();if(!Array.isArray(data.posts))throw new Error();
  posts=data.posts.slice(0,30).flatMap(item=>{
   const url=postURL(item.permalink),image=postImage(item.image,base);if(!url||!image)return [];
   const date=postDate(item.alt);return [{url,image,date,type:item.type,label:`심심한책방 ${date||''} ${item.type==='VIDEO'?'릴스':'사진'}`}];
  });render();
 }catch{status.hidden=false;status.textContent='사진을 불러오지 못했어요. 잠시 뒤 다시 확인해주세요.';retry.hidden=false}
 finally{clearTimeout(timer)}
}
retry.addEventListener('click',load);load();
