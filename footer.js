const footer=document.querySelector('#garden'),meadow=document.querySelector('#footer-meadow');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let visible=false;
function motion(){
 if(!visible||document.hidden||reduced.matches)meadow.pauseAnimations();
 else meadow.unpauseAnimations();
 footer.classList.toggle('garden-moving',visible&&!document.hidden&&!reduced.matches);
}
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;motion()},{threshold:.05}).observe(footer);
document.addEventListener('visibilitychange',motion);reduced.addEventListener('change',motion);motion();
footer.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
 const destination=link.getAttribute('href');
 const nav=document.querySelector(`.section-nav a[href="${destination}"]`);
 if(nav){event.preventDefault();nav.click();nav.focus({preventScroll:true})}
}));
