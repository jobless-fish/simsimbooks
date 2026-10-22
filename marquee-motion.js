// A critically damped follower plus a gently decaying release velocity.
export function createMarqueeMotion(){
 let position=0,target=0,velocity=0,coast=0,dragging=false;
 return {
  get position(){return position},get target(){return target},get dragging(){return dragging},
  begin(){dragging=true;target=position;velocity=0;coast=0;return position},
  drag(value){target=value},
  release(speed=0){dragging=false;coast=Math.max(-1800,Math.min(1800,speed))},
  step(seconds,autoVelocity=0){
   const dt=Math.max(0,Math.min(.05,seconds));
   if(!dragging){const decay=Math.exp(-2.4*dt);target+=autoVelocity*dt+coast*(1-decay)/2.4;coast*=decay}
   const omega=12,x=position-target,c=velocity+omega*x,decay=Math.exp(-omega*dt);
   position=target+(x+c*dt)*decay;velocity=(velocity-omega*c*dt)*decay;
   return position;
  },
  settle(){position=target;velocity=0;coast=0;return position}
 };
}
export function wrapMarquee(position,span){if(span<=0)return 0;const offset=position%span;return offset>0?offset-span:offset}
