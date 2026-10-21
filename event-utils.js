export function safeLink(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}
}
export function posterURL(value,base){
 if(typeof value!=='string'||!/^assets\/events\/[a-zA-Z0-9-]+\.(?:jpg|jpeg|png|webp)$/.test(value))return null;
 const url=new URL(value,base);return url.origin===new URL(base).origin?url.href:null;
}
const fmt=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});
export function eventDate(start,end){
 if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end)))return '일시 확인 중';
 return fmt.format(new Date(start))+' – '+fmt.format(new Date(end))+' (한국 시각)';
}
export function eventState(event){
 const now=Date.now();return now>Date.parse(event.endAt)?'지난 행사':now>=Date.parse(event.startAt)?'진행 중':'다가오는 행사';
}
export function displayEvents(data){
 if(data?.schemaVersion!==1||!Array.isArray(data.events))throw new Error('행사 목록 형식을 확인해주세요.');
 return data.events.filter(e=>e&&typeof e.title==='string'&&typeof e.description==='string'&&typeof e.location==='string'&&Number.isFinite(Date.parse(e.startAt))&&Number.isFinite(Date.parse(e.endAt))).sort((a,b)=>{
  const ap=Date.parse(a.endAt)<Date.now(),bp=Date.parse(b.endAt)<Date.now();
  return ap!==bp?(ap?1:-1):ap?Date.parse(b.startAt)-Date.parse(a.startAt):Date.parse(a.startAt)-Date.parse(b.startAt);
 });
}
