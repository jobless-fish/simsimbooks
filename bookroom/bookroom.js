import {safeLink,eventDate} from '../event-utils.js';
const API='https://simsimbooks-api.joblessfish.workers.dev';
const $=id=>document.getElementById(id);
const loginForm=$('login-form'),eventForm=$('event-form');
let token='',expires=0,expiryTimer,posterFile=null,posterURL='',imageTask=null,pending=null,busy=false,loginBusy=false,posted=false,imageVersion=0;
class RequestError extends Error{constructor(message,status=0){super(message);this.status=status}}
function message(id,text,kind=''){const e=$(id);e.textContent=text;e.dataset.kind=kind}
function freeze(value){$('event-fields').disabled=value;$('publish-button').disabled=busy||posted||!!imageTask;$('publish-button').textContent=busy?'등록 중…':pending?'같은 내용으로 다시 확인':'행사 등록하기'}
function clearSession(preserve=true){
 token='';expires=0;clearTimeout(expiryTimer);$('editor-panel').hidden=true;$('login-panel').hidden=false;$('logout').hidden=true;$('admin-password').value='';
 if(!preserve)resetEvent();
}
function signedIn(data){
 const end=Date.parse(data.expiresAt);if(!data.token||!Number.isFinite(end)||end<=Date.now())throw new RequestError('로그인 응답을 확인해주세요.');
 token=data.token;expires=end;$('admin-password').value='';$('login-panel').hidden=true;$('editor-panel').hidden=false;$('logout').hidden=false;
 $('session-expiry').textContent='로그인 유효기간: '+new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'}).format(end)+'까지';
 clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>{clearSession(true);message('login-status','로그인 시간이 끝났습니다. 다시 로그인하면 작성 중인 내용을 이어갈 수 있어요.')},end-Date.now());
 message('login-status','');loadRecent();
}
async function api(path,{method='GET',body,auth=true}={}){
 const headers={};if(auth){if(!token||expires<=Date.now()){clearSession(true);throw new RequestError('다시 로그인해주세요.',401)}headers.Authorization='Bearer '+token}
 if(body&&!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body)}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),method==='POST'?65000:20000);
 try{
  const response=await fetch(API+path,{method,headers,body,signal:controller.signal,credentials:'omit'});
  let data;try{data=await response.json()}catch{throw new RequestError('서버 응답을 확인하지 못했습니다. 잠시 뒤 다시 시도해주세요.',response.status>=400?response.status:0)}
  if(!response.ok){if(response.status===401&&auth)clearSession(true);throw new RequestError(data.message||'요청에 실패했습니다.',response.status)}
  return data;
 }catch(error){if(error instanceof RequestError)throw error;throw new RequestError('연결 결과를 확인하지 못했어요. 잠시 뒤 다시 시도해주세요.')}
 finally{clearTimeout(timer)}
}
loginForm.addEventListener('submit',async e=>{
 e.preventDefault();if(loginBusy)return;loginBusy=true;$('login-button').disabled=true;message('login-status','로그인 중…');
 const password=$('admin-password').value;
 try{signedIn(await api('/login',{method:'POST',auth:false,body:{id:$('admin-id').value,password}}))}
 catch(error){message('login-status',error.message,'error')}
 finally{$('admin-password').value='';loginBusy=false;$('login-button').disabled=false}
});
$('logout').addEventListener('click',()=>{if(busy)return;clearSession(false);message('login-status','로그아웃했습니다.');$('admin-id').focus()});
if(['localhost','127.0.0.1'].includes(location.hostname)||location.protocol==='file:')$('origin-note').hidden=false;
function updatePreview(){
 $('preview-title').textContent=$('title').value||'행사명이 들어갑니다';
 $('preview-description').textContent=$('description').value||'행사의 이야기가 들어갑니다.';
 $('preview-location').textContent=$('location').value||'장소를 입력해주세요.';
 const start=$('startAt').value,end=$('endAt').value;
 $('preview-date').textContent=start&&end?eventDate(start+':00+09:00',end+':00+09:00'):'일시를 입력해주세요.';
 const href=safeLink($('registrationUrl').value.trim());$('preview-link').hidden=!href;if(href)$('preview-link').href=href;else $('preview-link').removeAttribute('href');
}
eventForm.addEventListener('input',()=>{updatePreview();$('endAt').min=$('startAt').value});
async function decodeImage(file){
 const url=URL.createObjectURL(file),img=new Image();
 try{img.src=url;await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw new Error();return img}
 catch{throw new Error('이미지를 읽을 수 없습니다. 다른 포스터를 선택해주세요.')}
 finally{URL.revokeObjectURL(url)}
}
async function preparePoster(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPG, PNG, WebP 이미지를 선택해주세요.');
 if(file.size>20*1024*1024)throw new Error('20MB 이하의 이미지를 선택해주세요.');
 const img=await decodeImage(file);
 if(img.naturalWidth*img.naturalHeight>40000000)throw new Error('이미지 해상도가 너무 큽니다. 크기를 줄여주세요.');
 if(file.size<=2*1024*1024)return file;
 const scale=Math.min(1,2000/Math.max(img.naturalWidth,img.naturalHeight));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
 for(const quality of [.88,.76,.62,.48]){
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
  if(blob&&blob.size<=2*1024*1024)return new File([blob],'poster.jpg',{type:'image/jpeg'});
 }
 throw new Error('이미지 크기를 조금 더 줄여주세요. 저장 가능한 용량은 2MB입니다.');
}
$('poster').addEventListener('change',()=>{
 const file=$('poster').files[0],version=++imageVersion;posterFile=null;
 if(posterURL){URL.revokeObjectURL(posterURL);posterURL=''}$('preview-poster').hidden=true;$('preview-placeholder').hidden=false;
 if(!file){imageTask=null;$('poster-status').textContent='';freeze(false);return}
 $('poster-status').textContent='포스터를 확인하고 있어요.';
 const task=preparePoster(file);imageTask=task;freeze(false);
 task.then(prepared=>{
  if(version!==imageVersion)return;posterFile=prepared;posterURL=URL.createObjectURL(prepared);$('preview-poster').src=posterURL;$('preview-poster').hidden=false;$('preview-placeholder').hidden=true;
  $('poster-status').textContent=(prepared!==file?'저장용으로 크기를 줄였어요. ':'')+(prepared.size/1024/1024).toFixed(2)+'MB';
 }).catch(error=>{if(version!==imageVersion)return;$('poster').value='';$('poster-status').textContent=error.message}).finally(()=>{if(version!==imageVersion)return;imageTask=null;freeze(false)});
});
function readMetadata(){
 if(!posterFile)throw new Error('포스터를 먼저 선택해주세요.');
 const start=$('startAt').value,end=$('endAt').value;
 const date=value=>{if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('날짜와 시간을 입력해주세요.');return value+':00+09:00'};
 const startAt=date(start),endAt=date(end);if(Date.parse(endAt)<Date.parse(startAt))throw new Error('종료 일시는 시작 일시 이후로 입력해주세요.');
 const registrationUrl=$('registrationUrl').value.trim();if(registrationUrl&&!safeLink(registrationUrl))throw new Error('신청 링크는 https:// 주소로 입력해주세요.');
 return {title:$('title').value.trim(),startAt,endAt,location:$('location').value.trim(),description:$('description').value.trim(),registrationUrl};
}
eventForm.addEventListener('submit',async e=>{
 e.preventDefault();if(busy||posted)return;
 try{
  if(imageTask)await imageTask;
  if(!pending){if(!eventForm.reportValidity())return;pending={id:crypto.randomUUID(),metadata:JSON.stringify(readMetadata()),file:posterFile}}
  busy=true;freeze(true);$('logout').disabled=true;message('publish-status','포스터와 행사 내용을 저장하고 있어요. 창을 닫지 말아주세요.');
  const form=new FormData();form.set('id',pending.id);form.set('metadata',pending.metadata);form.set('poster',pending.file,pending.file.type==='image/png'?'poster.png':pending.file.type==='image/webp'?'poster.webp':'poster.jpg');
  const result=await api('/events',{method:'POST',body:form});
  posted=true;message('publish-status','행사가 저장됐습니다. GitHub Pages 배포가 끝나면 홈페이지에서 볼 수 있어요.','success');$('new-event').hidden=false;pending=null;
  loadRecent();
 }catch(error){
  // An uncertain result must retry the identical id, metadata and image.
  const uncertain=!!pending&&(!error.status||error.status>=500);
  if(!uncertain)pending=null;
  message('publish-status',error.message+(uncertain?' 입력 내용은 잠시 고정됩니다. 같은 내용으로 다시 확인하면 중복 없이 결과를 확인할 수 있어요.':''),'error');
 }finally{busy=false;$('logout').disabled=false;freeze(!!pending||posted)}
});
function resetEvent(){
 pending=null;posted=false;++imageVersion;imageTask=null;eventForm.reset();posterFile=null;
 if(posterURL)URL.revokeObjectURL(posterURL);posterURL='';$('preview-poster').hidden=true;$('preview-poster').removeAttribute('src');$('preview-placeholder').hidden=false;$('poster-status').textContent='';$('new-event').hidden=true;$('endAt').removeAttribute('min');message('publish-status','');freeze(false);updatePreview();
}
$('new-event').addEventListener('click',()=>{resetEvent();$('title').focus()});
let recentBusy=false;
async function loadRecent(){
 if(recentBusy||!token)return;recentBusy=true;$('refresh-events').disabled=true;$('recent-status').textContent='등록한 행사를 불러오고 있어요.';
 try{const data=await api('/events');if(!Array.isArray(data.events))throw new Error('행사 목록을 확인할 수 없습니다.');$('recent-events').replaceChildren();
  for(const event of data.events){const item=document.createElement('li'),title=document.createElement('strong'),date=document.createElement('span');title.textContent=event.title;date.textContent=eventDate(event.startAt,event.endAt);item.append(title,date);$('recent-events').append(item)}
  $('recent-status').textContent=data.events.length?data.events.length+'개의 행사가 등록돼 있어요.':'아직 등록한 행사가 없습니다.';
 }catch(error){$('recent-status').textContent=error.message}finally{recentBusy=false;$('refresh-events').disabled=false}
}
$('refresh-events').addEventListener('click',loadRecent);
document.addEventListener('visibilitychange',async()=>{if(document.hidden||!token||busy)return;try{await api('/session')}catch(error){if(error.status===401)message('login-status','로그인 시간이 끝났습니다. 다시 로그인해주세요.')}});
window.addEventListener('beforeunload',e=>{if(!posted&&(pending||$('title').value||$('description').value||posterFile)){e.preventDefault();e.returnValue=''}});
updatePreview();

$('login-button').disabled=false;
