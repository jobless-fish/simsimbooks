// simsimbooks Worker: login stage (event publishing is added in the next stage).
const encoder = new TextEncoder();
const SESSION_SECONDS = 3600;
const VERSION = 'events-2';
const required = ['ADMIN_ID','ADMIN_PASSWORD','SESSION_SECRET','GITHUB_TOKEN','GITHUB_OWNER','GITHUB_REPO','GITHUB_BRANCH','ALLOWED_ORIGIN'];

function encode64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decode64(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid token');
  const raw = atob(value.replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4-value.length%4)%4));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
async function signingKey(env) {
  // Changing the administrator credentials also invalidates existing sessions.
  const material = JSON.stringify([env.SESSION_SECRET,env.ADMIN_ID,env.ADMIN_PASSWORD]);
  const digest = await crypto.subtle.digest('SHA-256',encoder.encode(material));
  return crypto.subtle.importKey('raw',digest,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
async function equalCredentials(id,password,env) {
  const key = await signingKey(env);
  const actual = encoder.encode(JSON.stringify([id,password]));
  const expected = encoder.encode(JSON.stringify([env.ADMIN_ID,env.ADMIN_PASSWORD]));
  const signature = await crypto.subtle.sign('HMAC',key,expected);
  return crypto.subtle.verify('HMAC',key,signature,actual);
}
async function issueSession(env) {
  const now = Math.floor(Date.now()/1000);
  const payload = encode64(encoder.encode(JSON.stringify({v:1,role:'admin',iat:now,exp:now+SESSION_SECONDS,jti:crypto.randomUUID()})));
  const signature = await crypto.subtle.sign('HMAC',await signingKey(env),encoder.encode(payload));
  return {token:payload+'.'+encode64(signature),expiresAt:new Date((now+SESSION_SECONDS)*1000).toISOString(),expiresIn:SESSION_SECONDS};
}
async function verifySession(request,env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || auth.length>2048) return null;
  try {
    const parts = auth.slice(7).split('.');
    if(parts.length!==2) return null;
    const [payload,signature] = parts;
    if (!await crypto.subtle.verify('HMAC',await signingKey(env),decode64(signature),encoder.encode(payload))) return null;
    const data = JSON.parse(new TextDecoder().decode(decode64(payload)));
    const now = Math.floor(Date.now()/1000);
    if(data.v!==1 || data.role!=='admin' || !Number.isInteger(data.iat) || !Number.isInteger(data.exp) || data.iat>now+30 || data.exp<=now || data.exp-data.iat!==SESSION_SECONDS) return null;
    return data;
  } catch { return null; }
}
async function readLogin(request) {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return null;
  const reader = request.body?.getReader();
  if(!reader) return null;
  let length=0;const chunks=[];
  try {
    while(true){
      const {value,done}=await reader.read();if(done)break;
      length+=value.byteLength;
      if(length>4096){await reader.cancel();return null;}
      chunks.push(value);
    }
    const bytes=new Uint8Array(length);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const body=JSON.parse(new TextDecoder().decode(bytes));
    if(typeof body.id!=='string'||typeof body.password!=='string'||body.id.length>256||body.password.length>1024)return null;
    return body;
  } catch {return null;}
}

// Event entries and posters are committed together; existing site files remain intact.
const EVENTS_PATH = 'data/events.json';
const MAX_POSTER = 2 * 1024 * 1024;
const MAX_FORM = MAX_POSTER + 65536;
class ApiError extends Error {
  constructor(status,message,githubStatus){super(message);this.status=status;this.githubStatus=githubStatus;}
}
async function github(env,path,method='GET',body) {
  const owner=encodeURIComponent(env.GITHUB_OWNER.trim()),repo=encodeURIComponent(env.GITHUB_REPO.trim());
  const response=await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`,{
    method,headers:{Authorization:`Bearer ${env.GITHUB_TOKEN.trim()}`,Accept:'application/vnd.github+json','User-Agent':'simsimbooks-worker',...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),redirect:'manual'
  });
  if(!response.ok)throw new ApiError(502,'GitHub 요청이 실패했습니다.',response.status);
  return response.json();
}
async function snapshot(env) {
  const branch=env.GITHUB_BRANCH.trim().split('/').map(encodeURIComponent).join('/');
  const ref=await github(env,`/git/ref/heads/${branch}`);
  const head=await github(env,`/git/commits/${ref.object.sha}`);
  let data={schemaVersion:1,events:[]};
  try {
    const file=await github(env,`/contents/${EVENTS_PATH}?ref=${ref.object.sha}`);
    if(file.type!=='file'||file.encoding!=='base64'||file.size>524288)throw new ApiError(409,'기존 행사 파일 형식을 확인해주세요.');
    const raw=atob(file.content.replace(/\s/g,''));
    data=JSON.parse(new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0))));
    if(data.schemaVersion!==1||!Array.isArray(data.events)||data.events.some(e=>!e||typeof e.id!=='string'))throw new ApiError(409,'기존 행사 파일 형식을 확인해주세요.');
  } catch(error) {
    if(error.githubStatus!==404)throw error instanceof ApiError?error:new ApiError(409,'기존 행사 목록을 읽을 수 없습니다.');
  }
  return {sha:ref.object.sha,tree:head.tree.sha,data};
}
async function boundedForm(request) {
  const contentType=request.headers.get('Content-Type')||'';
  if(!/^multipart\/form-data\s*;/i.test(contentType))throw new ApiError(415,'포스터와 내용을 multipart/form-data로 전송해주세요.');
  if(Number(request.headers.get('Content-Length'))>MAX_FORM)throw new ApiError(413,'포스터는 2MB 이하로 올려주세요.');
  const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'내용이 없습니다.');
  let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_FORM){await reader.cancel();throw new ApiError(413,'업로드 용량을 초과했습니다.');}chunks.push(value);}
  try {return await new Response(new Blob(chunks),{headers:{'Content-Type':contentType}}).formData();}
  catch {throw new ApiError(400,'업로드 형식이 올바르지 않습니다.');}
}
function eventFields(raw) {
  let input;try{input=JSON.parse(raw);}catch{throw new ApiError(400,'metadata는 JSON이어야 합니다.');}
  if(!input||typeof input!=='object'||Array.isArray(input))throw new ApiError(400,'행사 정보 형식을 확인해주세요.');
  const text=(name,max)=>{if(typeof input[name]!=='string'||!input[name].trim()||input[name].length>max)throw new ApiError(400,`${name} 항목을 확인해주세요.`);return input[name].trim();};
  const title=text('title',120),location=text('location',200),description=text('description',12000);
  const date=name=>{const value=text(name,40);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw new ApiError(400,`${name}에 시간대가 포함된 날짜를 입력해주세요.`);return new Date(value).toISOString();};
  const startAt=date('startAt');
  const endAt=input.endAt==null||input.endAt===''?null:date('endAt');
  if(endAt&&Date.parse(endAt)<Date.parse(startAt))throw new ApiError(400,'종료 시각은 시작 시각보다 빠를 수 없습니다.');
  let registrationUrl='';
  if(input.registrationUrl!==undefined&&typeof input.registrationUrl!=='string')throw new ApiError(400,'신청 링크 형식을 확인해주세요.');
  if(input.registrationUrl?.trim()){
    if(input.registrationUrl.length>2048)throw new ApiError(400,'신청 링크가 너무 깁니다.');
    let url;try{url=new URL(input.registrationUrl.trim());}catch{throw new ApiError(400,'신청 링크 주소를 확인해주세요.');}
    if(url.protocol!=='https:'||url.username||url.password)throw new ApiError(400,'신청 링크는 HTTPS 주소여야 합니다.');
    registrationUrl=url.href;
  }
  return {title,startAt,endAt,location,description,registrationUrl};
}
function base64File(bytes) {
  const parts=[];for(let i=0;i<bytes.length;i+=8192)parts.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
  return btoa(parts.join(''));
}
async function eventUpload(request) {
  const form=await boundedForm(request),raw=form.get('metadata'),poster=form.get('poster');
  if(typeof raw!=='string'||raw.length>20000)throw new ApiError(400,'행사 내용을 확인해주세요.');
  const fields=eventFields(raw);
  if(!poster||typeof poster.arrayBuffer!=='function'||poster.size<12||poster.size>MAX_POSTER)throw new ApiError(400,'2MB 이하 포스터 파일 한 장을 선택해주세요.');
  if(form.getAll('poster').length!==1)throw new ApiError(400,'포스터는 한 장만 올릴 수 있습니다.');
  const bytes=new Uint8Array(await poster.arrayBuffer());
  let extension;
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)extension='jpg';
  else if([137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))extension='png';
  else if(new TextDecoder().decode(bytes.subarray(0,4))==='RIFF'&&new TextDecoder().decode(bytes.subarray(8,12))==='WEBP')extension='webp';
  else throw new ApiError(400,'JPG, PNG, WebP 포스터만 지원합니다.');
  const submittedId=form.get('id');
  if(submittedId!==null&&(typeof submittedId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(submittedId)))throw new ApiError(400,'행사 ID 형식을 확인해주세요.');
  const id=submittedId||crypto.randomUUID();
  const imageHash=encode64(await crypto.subtle.digest('SHA-256',bytes));
  const requestHash=encode64(await crypto.subtle.digest('SHA-256',encoder.encode(JSON.stringify({...fields,imageHash}))));
  return {id,fields,extension,bytes,requestHash};
}
async function publishEvent(env,upload) {
  const {id,fields,extension,bytes,requestHash}=upload;
  const posterPath=`assets/events/${id}.${extension}`;
  let blob;
  for(let attempt=0;attempt<3;attempt++){
    const state=await snapshot(env);
    const existing=state.data.events.find(e=>e.id===id);
    if(existing){
      if(existing.requestHash===requestHash)return {created:false,event:existing,commit:state.sha};
      throw new ApiError(409,'이미 다른 내용으로 등록된 행사 ID입니다.');
    }
    if(state.data.events.length>=1000)throw new ApiError(409,'행사 목록 정리가 필요합니다.');
    if(!blob)blob=await github(env,'/git/blobs','POST',{content:base64File(bytes),encoding:'base64'});
    const now=new Date().toISOString();
    const event={id,...fields,poster:posterPath,createdAt:now,updatedAt:now,requestHash};
    const data={...state.data,events:[event,...state.data.events]};
    const content=JSON.stringify(data,null,2)+'\n';
    if(encoder.encode(content).length>524288)throw new ApiError(409,'행사 목록 용량 정리가 필요합니다.');
    const tree=await github(env,'/git/trees','POST',{base_tree:state.tree,tree:[{path:posterPath,mode:'100644',type:'blob',sha:blob.sha},{path:EVENTS_PATH,mode:'100644',type:'blob',content}]});
    const commit=await github(env,'/git/commits','POST',{message:`Add bookshop event ${id}`,tree:tree.sha,parents:[state.sha]});
    const branch=env.GITHUB_BRANCH.trim().split('/').map(encodeURIComponent).join('/');
    try {
      await github(env,`/git/refs/heads/${branch}`,'PATCH',{sha:commit.sha,force:false});
      return {created:true,event,commit:commit.sha};
    } catch(error) {
      if(![409,422].includes(error.githubStatus))throw error;
      const current=await github(env,`/git/ref/heads/${branch}`);
      if(current.object.sha===state.sha)throw new ApiError(409,'브랜치 보호 또는 저장 권한 설정을 확인해주세요.');
    }
  }
  throw new ApiError(409,'다른 저장 작업과 겹쳤습니다. 잠시 뒤 다시 시도해주세요.');
}

async function deletionRevision(request) {
  if(!(request.headers.get('Content-Type')||'').toLowerCase().startsWith('application/json'))throw new ApiError(415,'삭제 확인 정보를 JSON으로 보내주세요.');
  const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'삭제 확인 정보가 없습니다.');
  let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw new ApiError(413,'요청 용량을 초과했습니다.');}chunks.push(value);}
  let data;try{data=JSON.parse(await new Blob(chunks).text())}catch{throw new ApiError(400,'삭제 확인 정보 형식을 확인해주세요.');}
  if(typeof data?.revision!=='string'||!/^[a-f0-9]{40,64}$/i.test(data.revision))throw new ApiError(400,'목록을 새로 불러온 뒤 삭제해주세요.');
  return data.revision;
}
async function deleteEvent(env,id,revision) {
  const state=await snapshot(env);
  if(!state.data.events.some(event=>event.id===id))return {deleted:false,id,commit:state.sha};
  if(state.sha!==revision)throw new ApiError(409,'행사 목록이 변경됐습니다. 목록을 새로 확인한 뒤 삭제해주세요.');
  const data={...state.data,events:state.data.events.filter(event=>event.id!==id)};
  // Remove the listing only. Keep the poster and Git history for recovery.
  const tree=await github(env,'/git/trees','POST',{base_tree:state.tree,tree:[{path:EVENTS_PATH,mode:'100644',type:'blob',content:JSON.stringify(data,null,2)+'\n'}]});
  const commit=await github(env,'/git/commits','POST',{message:`Remove bookshop event ${id}`,tree:tree.sha,parents:[state.sha]});
  const branch=env.GITHUB_BRANCH.trim().split('/').map(encodeURIComponent).join('/');
  try{await github(env,`/git/refs/heads/${branch}`,'PATCH',{sha:commit.sha,force:false})}
  catch(error){if([409,422].includes(error.githubStatus))throw new ApiError(409,'다른 저장 작업과 겹쳤습니다. 목록을 새로 확인해주세요.');throw error;}
  return {deleted:true,id,commit:commit.sha};
}
export default {
  async fetch(request,env) {
    const origin=request.headers.get('Origin');
    const allowed=typeof env.ALLOWED_ORIGIN==='string'?env.ALLOWED_ORIGIN.trim():'';
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    if(origin && origin===allowed){
      headers['Access-Control-Allow-Origin']=allowed;
      headers['Access-Control-Allow-Methods']='GET, POST, DELETE, OPTIONS';
      headers['Access-Control-Allow-Headers']='Content-Type, Authorization';
    }
    const json=(data,status=200)=>new Response(JSON.stringify(data,null,2),{status,headers});
    if(origin && origin!==allowed)return json({ok:false,message:'허용되지 않은 출처입니다.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    const path=new URL(request.url).pathname;
    const missing=required.filter(name=>typeof env[name]!=='string'||!env[name].trim());
    if(missing.length)return json({ok:false,version:VERSION,message:'설정이 누락되었습니다.',missing},503);
    if(env.SESSION_SECRET.length<32)return json({ok:false,message:'SESSION_SECRET은 32자 이상으로 설정해주세요.'},503);
    try {
      if(request.method==='GET'&&(path==='/'||path==='/health')){
        const owner=encodeURIComponent(env.GITHUB_OWNER.trim()),repo=encodeURIComponent(env.GITHUB_REPO.trim()),branch=encodeURIComponent(env.GITHUB_BRANCH.trim());
        const response=await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`,{headers:{Authorization:`Bearer ${env.GITHUB_TOKEN.trim()}`,Accept:'application/vnd.github+json','User-Agent':'simsimbooks-worker'},redirect:'manual'});
        if(!response.ok)return json({ok:false,version:VERSION,message:'GitHub 연결 설정을 확인해주세요.',githubStatus:response.status},502);
        return json({ok:true,version:VERSION,message:'설정 및 GitHub 브랜치 조회 성공',loginReady:typeof env.LOGIN_LIMITER?.limit==='function',eventApiReady:true,eventDeleteReady:true,optionalEndAt:true});
      }
      if(request.method==='POST'&&path==='/login'){
        if(origin!==allowed)return json({ok:false,message:'관리자 화면에서 로그인해주세요.'},403);
        // Fail closed until the Cloudflare Rate Limiting binding is configured.
        if(typeof env.LOGIN_LIMITER?.limit!=='function')return json({ok:false,message:'로그인 시도 제한 설정이 필요합니다.',code:'LOGIN_LIMITER_REQUIRED'},503);
        const {success}=await env.LOGIN_LIMITER.limit({key:'simsimbooks-admin-login'});
        if(!success)return json({ok:false,message:'로그인 시도가 많습니다. 1분 뒤 다시 시도해주세요.'},429);
        const login=await readLogin(request);
        if(!login)return json({ok:false,message:'아이디와 비밀번호를 JSON으로 보내주세요.'},400);
        if(!await equalCredentials(login.id,login.password,env))return json({ok:false,message:'아이디 또는 비밀번호가 올바르지 않습니다.'},401);
        return json({ok:true,...await issueSession(env)});
      }
      if(request.method==='GET'&&path==='/session'){
        const session=await verifySession(request,env);
        if(!session)return json({ok:false,message:'로그인이 필요합니다.'},401);
        return json({ok:true,role:'admin',expiresAt:new Date(session.exp*1000).toISOString()});
      }
      if(path==='/events'){
        const session=await verifySession(request,env);
        if(!session)return json({ok:false,message:'로그인이 필요합니다.'},401);
        if(request.method==='GET'){
          const state=await snapshot(env);
          return json({ok:true,events:state.data.events,revision:state.sha});
        }
        if(request.method==='POST'){
          if(origin!==allowed)return json({ok:false,message:'관리자 화면에서 저장해주세요.'},403);
          if(typeof env.LOGIN_LIMITER?.limit!=='function')return json({ok:false,message:'요청 제한 설정이 필요합니다.'},503);
          const {success}=await env.LOGIN_LIMITER.limit({key:'simsimbooks-event-publish'});
          if(!success)return json({ok:false,message:'저장 요청이 많습니다. 1분 뒤 다시 시도해주세요.'},429);
          const result=await publishEvent(env,await eventUpload(request));
          return json({ok:true,...result,message:'GitHub에 저장됐습니다. 홈페이지 반영은 Pages 배포 완료 후 확인해주세요.'},result.created?201:200);
        }
      }
      const deleteMatch=/^\/events\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i.exec(path);
      if(request.method==='DELETE'&&deleteMatch){
        if(!await verifySession(request,env))return json({ok:false,message:'로그인이 필요합니다.'},401);
        if(origin!==allowed)return json({ok:false,message:'관리자 화면에서 삭제해주세요.'},403);
        if(typeof env.LOGIN_LIMITER?.limit!=='function')return json({ok:false,message:'요청 제한 설정이 필요합니다.'},503);
        if(!(await env.LOGIN_LIMITER.limit({key:'simsimbooks-event-delete'})).success)return json({ok:false,message:'삭제 요청이 많습니다. 1분 뒤 다시 시도해주세요.'},429);
        const result=await deleteEvent(env,deleteMatch[1],await deletionRevision(request));
        return json({ok:true,...result,message:'행사 목록에서 삭제했습니다. 홈페이지 반영은 Pages 배포 완료 후 확인해주세요.'});
      }
      return json({ok:false,message:'지원하지 않는 주소 또는 요청 방식입니다.'},404);
    } catch (error) {
      if(error instanceof ApiError)return json({ok:false,message:error.message,...(error.githubStatus?{githubStatus:error.githubStatus}:{})},error.status);
      // Do not expose credentials, request bodies, or session tokens in errors/logs.
      return json({ok:false,message:'요청 처리 중 오류가 발생했습니다.'},502);
    }
  }
};
