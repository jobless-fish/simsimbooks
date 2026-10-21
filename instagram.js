import {postURL,postImage,postDate} from './instagram-utils.js';
const base=new URL('./',import.meta.url),section=document.querySelector('#instagram'),ribbon=document.querySelector('#instagram-ribbon'),status=document.querySelector('#instagram-status'),retry=document.querySelector('#instagram-retry');
const dialog=document.querySelector('#instagram-dialog'),viewer=document.querySelector('#instagram-viewer');
let posts=[],opener=null;
function element(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node}
function fitPhoto(){
 const img=viewer.querySelector('img');if(!img?.naturalWidth||!img.naturalHeight)return;
 const ratio=img.naturalWidth/img.naturalHeight,maxHeight=innerHeight*(innerWidth<=640?.74:.82);
 const width=Math.min(880,innerWidth-(innerWidth<=640?24:38),maxHeight*ratio);
 dialog.style.width=width+'px';dialog.style.height=(width/ratio)+'px';
}
function open(post,button){
 opener=button;window.dispatchEvent(new Event('simsim:modal-open'));
 const img=element('img','instagram-large-photo');img.src=post.image;img.alt=post.label;img.draggable=false;
 img.addEventListener('load',fitPhoto,{once:true});
 img.addEventListener('error',()=>{viewer.replaceChildren(element('p','instagram-status','사진을 불러오지 못했어요. 잠시 뒤 다시 확인해주세요.'))},{once:true});
 viewer.replaceChildren(img);dialog.showModal();document.body.classList.add('instagram-modal-open');fitPhoto();
}
function cleanup(){viewer.replaceChildren();document.body.classList.remove('instagram-modal-open');opener?.focus({preventScroll:true});opener=null}
document.querySelector('#instagram-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',cleanup);
dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close()});
window.addEventListener('resize',()=>{if(dialog.open)fitPhoto()});
// Match 22 pixels per second at any viewport size, with an exact two-group loop.
function measure(){const group=ribbon.firstElementChild;if(group)ribbon.style.setProperty('--instagram-duration',Math.max(30,group.getBoundingClientRect().width/22)+'s')}
new ResizeObserver(measure).observe(ribbon);
new IntersectionObserver(entries=>{section.classList.toggle('is-visible',entries[0].isIntersecting)},{threshold:.05}).observe(section);
document.addEventListener('visibilitychange',()=>{ribbon.style.animationPlayState=document.hidden?'paused':''});
function render(){
 ribbon.replaceChildren();const group=element('div','instagram-group'),buttons=[];
 for(const post of posts){
  const button=element('button','instagram-card');button.type='button';button.setAttribute('aria-label',post.label+' 크게 보기');button.setAttribute('aria-haspopup','dialog');
  const img=element('img');img.src=post.image;img.alt=post.label;img.decoding='async';img.draggable=false;
  img.addEventListener('error',()=>{button.hidden=true;const clone=ribbon.children[1]?.children[buttons.indexOf(button)];if(clone)clone.hidden=true;measure()},{once:true});
  button.append(img);button.addEventListener('click',()=>open(post,button));buttons.push(button);group.append(button);
 }
 const duplicate=group.cloneNode(true);duplicate.setAttribute('aria-hidden','true');
 [...duplicate.children].forEach((button,i)=>{button.tabIndex=-1;button.addEventListener('click',()=>open(posts[i],buttons[i]))});
 ribbon.append(group,duplicate);status.hidden=posts.length>0;status.textContent=posts.length?'':'책방의 새로운 사진을 준비하고 있어요.';measure();
}
async function load(){
 retry.hidden=true;status.hidden=false;status.textContent='사진을 불러오고 있어요.';
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
 try{
  const response=await fetch(new URL('data/instagram.json',base),{cache:'no-store',signal:abort.signal});if(!response.ok)throw new Error();
  const data=await response.json();if(!Array.isArray(data.posts))throw new Error();
  posts=data.posts.slice(0,30).flatMap(item=>{
   const url=postURL(item.permalink),image=postImage(item.image,base);if(!url||!image)return [];
   return [{image,label:`심심한책방 ${postDate(item.alt)||''} 사진`}];
  });render();
 }catch{status.hidden=false;status.textContent='사진을 불러오지 못했어요. 잠시 뒤 다시 확인해주세요.';retry.hidden=false}
 finally{clearTimeout(timer)}
}
retry.addEventListener('click',load);load();
