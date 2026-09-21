// Minimal fake DOM + pixel-backed canvas so the real page script can run end to end in node.
const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','index.html'),'utf8');
const a=html.lastIndexOf('<script>')+8,script=html.slice(a,html.lastIndexOf('</script>'));
const hexRGB=h=>{h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]};
class Ctx{constructor(c){this.c=c;this.font='10px sans-serif';this.fillStyle='#000';this.letterSpacing='0px';this.filter='none';this.texts=[]}
  get buf(){return this.c._buf}
  getImageData(x,y,w,h){x|=0;y|=0;const d=new Uint8ClampedArray(w*h*4),W=this.c._w,H=this.c._h;for(let j=0;j<h;j++)for(let i=0;i<w;i++){const sx=x+i,sy=y+j;if(sx<0||sy<0||sx>=W||sy>=H)continue;const s=(sy*W+sx)*4,t=(j*w+i)*4;d[t]=this.buf[s];d[t+1]=this.buf[s+1];d[t+2]=this.buf[s+2];d[t+3]=this.buf[s+3]}return{data:d,width:w,height:h}}
  putImageData(img,x,y){x|=0;y|=0;const W=this.c._w,H=this.c._h;for(let j=0;j<img.height;j++)for(let i=0;i<img.width;i++){const sx=x+i,sy=y+j;if(sx<0||sy<0||sx>=W||sy>=H)continue;const s=(j*img.width+i)*4,t=(sy*W+sx)*4;for(let k=0;k<4;k++)this.buf[t+k]=img.data[s+k]}}
  fillRect(x,y,w,h){const [r,g,b]=hexRGB(typeof this.fillStyle==='string'&&this.fillStyle[0]==='#'?this.fillStyle:'#000000'),W=this.c._w,H=this.c._h;for(let j=Math.max(0,y|0);j<Math.min(H,(y+h)|0);j++)for(let i=Math.max(0,x|0);i<Math.min(W,(x+w)|0);i++){const t=(j*W+i)*4;this.buf[t]=r;this.buf[t+1]=g;this.buf[t+2]=b;this.buf[t+3]=255}}
  clearRect(x,y,w,h){const W=this.c._w,H=this.c._h;for(let j=Math.max(0,y|0);j<Math.min(H,(y+h)|0);j++)for(let i=Math.max(0,x|0);i<Math.min(W,(x+w)|0);i++){const t=(j*W+i)*4;this.buf[t]=this.buf[t+1]=this.buf[t+2]=this.buf[t+3]=0}}
  drawImage(src,...a){const s=src._buf?src:null;if(!s)return;let sx=0,sy=0,sw=s._w,sh=s._h,dx=0,dy=0,dw=sw,dh=sh;if(a.length===2)[dx,dy]=a;else if(a.length===4)[dx,dy,dw,dh]=a;else if(a.length===8)[sx,sy,sw,sh,dx,dy,dw,dh]=a;
    const W=this.c._w,H=this.c._h;for(let j=0;j<dh;j++)for(let i=0;i<dw;i++){const tx=(dx+i)|0,ty=(dy+j)|0;if(tx<0||ty<0||tx>=W||ty>=H)continue;const px=Math.min(s._w-1,(sx+i*sw/dw)|0),py=Math.min(s._h-1,(sy+j*sh/dh)|0),si=(py*s._w+px)*4,t=(ty*W+tx)*4;if(s._buf[si+3]===0)continue;for(let k=0;k<4;k++)this.buf[t+k]=s._buf[si+k]}}
  measureText(t){const fs=+(this.font.match(/(\d+(?:\.\d+)?)px/)||[0,10])[1];return{width:.55*fs*t.length,actualBoundingBoxAscent:.72*fs,actualBoundingBoxDescent:/[gjpqy,]/.test(t)?.2*fs:0,fontBoundingBoxAscent:.9*fs,fontBoundingBoxDescent:.25*fs}}
  fillText(t,x,y){this.texts.push({t,x,y,font:this.font,fill:this.fillStyle})}
  save(){}restore(){}setLineDash(){}strokeRect(){}beginPath(){}rect(){}fill(){}translate(){}scale(){}createLinearGradient(){return{addColorStop(){}}}}
class El{constructor(id){this.id=id;this.style={};this.children=[];this.dataset={};this.value='';this.checked=false;this._innerHTML='';this.textContent='';this.disabled=false;this.hidden=false;this.options=[];this.listeners={};this._w=300;this._h=150;this._buf=new Uint8ClampedArray(300*150*4);
    this.classList={add(){},remove(){},toggle(){}}}
  get width(){return this._w}set width(v){this._w=v|0;this._buf=new Uint8ClampedArray(this._w*this._h*4)}
  get height(){return this._h}set height(v){this._h=v|0;this._buf=new Uint8ClampedArray(this._w*this._h*4)}
  get innerHTML(){return this._innerHTML}set innerHTML(v){this._innerHTML=v;this.children=[]}
  addEventListener(t,f){(this.listeners[t]||(this.listeners[t]=[])).push(f)}
  async fire(t,ev){for(const f of this.listeners[t]||[])await f(ev)}
  appendChild(c){this.children.push(c);return c}append(...c){this.children.push(...c)}remove(){}setAttribute(){}querySelector(){return null}focus(){}select(){}scrollIntoView(){}setPointerCapture(){}
  getBoundingClientRect(){return{left:0,top:0,width:this._w,height:this._h}}click(){return this.onclick&&this.onclick({stopPropagation(){}})}
  getContext(){return this._ctx||(this._ctx=new Ctx(this))}toDataURL(){return 'data:image/png;base64,AAAA'}toBlob(cb){cb(new Blob(['x']))}}
const reg={};const ids=s=>reg[s]||(reg[s]=new El(s));
const tabs=['edit','text','adjust','a11y','dna','code','export'].map(p=>{const e=new El('tab-'+p);e.dataset.p=p;return e});
document={querySelector:s=>ids(s),querySelectorAll:s=>s==='.tab'?tabs:s==='.tool'?['move','text','replace','erase','redact','crop','extend','pick'].map(t=>{const e=new El('t');e.dataset.t=t;return e}):[],
  createElement:t=>{const e=new El(t);e.tag=t;return e},addEventListener(){},head:{appendChild(s){if(s.onload)setTimeout(()=>s.onload(),0)}},body:{appendChild(){}},activeElement:{tagName:'BODY'},fonts:{load:async()=>[]}};
globalThis.document=document;globalThis.window=globalThis;globalThis.self=globalThis;window.addEventListener=()=>{};
globalThis.ImageData=class{constructor(d,w,h){this.data=d;this.width=w;this.height=h}};
globalThis.Image=class{};globalThis.URL.createObjectURL=()=>'blob:x';globalThis.URL.revokeObjectURL=()=>{};
globalThis.File=class extends Blob{constructor(p,n,o){super(p,o);this.name=n}};
const saved=[];let ajs=null;
globalThis.window.jspdf={jsPDF:class{constructor(o){this.o=o;this.pages=1;this.images=[];this.texts=[];ajs=this}addPage(){this.pages++}addImage(...a){this.images.push(a[1])}setFontSize(){}text(t,x,y,o){this.texts.push({t,o})}setProperties(){}output(){return new Blob(['pdf'])}}};
globalThis.pdfjsLib=undefined;
const src=script+`
;globalThis.__T={startSession,doReplace,eraseRect,analyzeRect,commit,undo,redo,render,setTool,renderSnap,svgOf,doExport,detect,applyLines,scanPII,translatePage,findPdfLine,cropTo,extend,runCmd,scanPII,redactRect,goPage,
 get objs(){return objs},get pages(){return pages},get cur(){return cur},base,bx,ov,P,makeSample,syncPanel,renderA11y,renderCode,saveBlobSpy:(f)=>{saveBlob=f}};`;
(0,eval)(src);
globalThis.__saved=saved;globalThis.__ids=ids;globalThis.__El=El;globalThis.__pdf=()=>ajs;
