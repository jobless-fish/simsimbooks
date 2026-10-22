// Keep each physical gesture on one spread, including its momentum tail.
export function createPeopleState(count){
 let index=0,busy=false;
 return {get index(){return index},get busy(){return busy},lock(){busy=true},unlock(){busy=false},canMove(direction){return !busy&&index+Math.sign(direction)>=0&&index+Math.sign(direction)<count},move(direction){if(!direction||!this.canMove(direction))return false;index+=Math.sign(direction);return true},set(value){index=Math.max(0,Math.min(count-1,value));busy=false}};
}
