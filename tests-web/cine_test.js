// Runs the cinematic layer against stubbed browser APIs and fails if it throws (its own try/catch would otherwise hide errors).
const fs=require('fs'),path=require('path');
const warns=[];console.warn=(...a)=>warns.push(a.join(' '));
let raf=0;globalThis.requestAnimationFrame=f=>{if(raf++<4)f(16*raf);return raf};
globalThis.IntersectionObserver=class{constructor(cb){this.cb=cb}observe(el){this.cb([{isIntersecting:true,target:el}])}unobserve(){}};
globalThis.matchMedia=q=>({matches:/hover|pointer/.test(q)});globalThis.innerHeight=800;globalThis.scrollY=0;globalThis.devicePixelRatio=2;
globalThis.sessionStorage={getItem:()=>null,setItem(){}};
let h=fs.readFileSync(path.join(__dirname,'harness.js'),'utf8');
h=h.replace('save(){}restore(){}','setTransform(){}moveTo(){}lineTo(){}stroke(){}arc(){}save(){}restore(){}');
h=h.replace('document={querySelector','document={documentElement:{classList:{add(){}},scrollHeight:3000},getElementById:i=>ids("#"+i),querySelector');
h=h.replace('addEventListener(){},head','addEventListener(){},hidden:false,head');
h=h.replace('addEventListener(t,f){(this.listeners','get clientWidth(){return this._w}get clientHeight(){return this._h}addEventListener(t,f){(this.listeners');
h=h.replace("process.argv[2]||require('path').join(__dirname,'..','index.html')",JSON.stringify(path.join(__dirname,'..','index.html')));
const tmp=path.join(__dirname,'.harness_cine.tmp.js');fs.writeFileSync(tmp,h);require(tmp);
setTimeout(()=>{fs.unlinkSync(tmp);const bad=warns.filter(w=>/cinematic/.test(w));
  console.log(bad.length?'FAIL cinematic layer threw: '+bad.join(' | '):'PASS cinematic layer ran without errors');process.exit(bad.length?1:0)},50);
