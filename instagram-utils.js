export function postURL(value){
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||!['www.instagram.com','instagram.com'].includes(u.hostname)||u.username||u.password||u.port)return null;
  const match=u.pathname.match(/^\/(?:simsimhan_bookshop\/)?(p|reel)\/([A-Za-z0-9_-]{5,40})\/?$/);
  return match?`https://www.instagram.com/${match[1]}/${match[2]}/`:null;
 }catch{return null}
}
export function postImage(value,base){
 if(typeof value!=='string'||!/^assets\/instagram\/[A-Za-z0-9_-]+\.jpg$/.test(value))return null;
 return new URL(value,base).href;
}
export function postDate(alt){
 const match=String(alt||'').match(/on ([A-Za-z]+ \d{1,2}, \d{4})/);
 if(!match)return '';
 const date=new Date(match[1]+' 12:00:00 GMT+0900');
 return Number.isFinite(+date)?new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Seoul'}).format(date):'';
}
