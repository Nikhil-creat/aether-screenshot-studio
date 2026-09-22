//<core>
const hex2rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const rgb2hex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('').toUpperCase();
const lin=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};
const lum=c=>.2126*lin(c[0])+.7152*lin(c[1])+.0722*lin(c[2]);
const contrast=(a,b)=>{const x=lum(hex2rgb(a)),y=lum(hex2rgb(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
function fixFg(fg,bg,need){
  if(contrast(fg,bg)>=need)return fg;const f=hex2rgb(fg);
  for(const t of [[0,0,0],[255,255,255]]){
    if(contrast(rgb2hex(t[0],t[1],t[2]),bg)<need)continue;let lo=0,hi=1;
    const mix=m=>rgb2hex(f[0]+(t[0]-f[0])*m,f[1]+(t[1]-f[1])*m,f[2]+(t[2]-f[2])*m);
    for(let i=0;i<24;i++){const m=(lo+hi)/2;if(contrast(mix(m),bg)>=need)hi=m;else lo=m}
    return mix(hi);
  }
  return lum(hex2rgb(bg))>.18?'#000000':'#FFFFFF';
}
function gauss(R){let u=0,v=0;while(!u)u=R();while(!v)v=R();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
// grain estimate (sigma of luma noise) from strips just outside a rectangle; robust median-of-differences estimator
function noiseSigma(d,W,H,x0,y0,x1,y1){
  const diffs=[],rows=[];for(let k=1;k<=3;k++){rows.push(y0-k);rows.push(y1+k-1)}
  for(const y of rows){if(y<0||y>=H)continue;for(let x=Math.max(0,x0);x<Math.min(W-1,x1);x++){const i=(y*W+x)*4,j=i+4;diffs.push(Math.abs((.299*d[i]+.587*d[i+1]+.114*d[i+2])-(.299*d[j]+.587*d[j+1]+.114*d[j+2])))}}
  if(diffs.length<8)return 0;diffs.sort((p,q)=>p-q);return Math.min(8,diffs[diffs.length>>1]/0.6745/Math.SQRT2);
}
// Coons-patch fill: rebuilds a rectangle from the colours on its four borders, then re-adds matching grain
function coonsFill(d,W,H,x0,y0,x1,y1,sigma,rng){
  const R=rng||Math.random;x0=Math.max(0,x0|0);y0=Math.max(0,y0|0);x1=Math.min(W,x1|0);y1=Math.min(H,y1|0);
  const w=x1-x0,h=y1-y0;if(w<1||h<1)return;
  const px=(x,y)=>{x=Math.min(W-1,Math.max(0,x));y=Math.min(H-1,Math.max(0,y));const i=(y*W+x)*4;return [d[i],d[i+1],d[i+2]]};
  const av=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];
  const L=[],Rr=[],T=[],B=[];
  for(let j=0;j<h;j++){L.push(av(px(x0-1,y0+j),px(x0-2,y0+j)));Rr.push(av(px(x1,y0+j),px(x1+1,y0+j)))}
  for(let i=0;i<w;i++){T.push(av(px(x0+i,y0-1),px(x0+i,y0-2)));B.push(av(px(x0+i,y1),px(x0+i,y1+1)))}
  const c00=L[0],c01=L[h-1],c10=Rr[0],c11=Rr[h-1];
  for(let j=0;j<h;j++){const u=h>1?j/(h-1):0;
    for(let i=0;i<w;i++){const t=w>1?i/(w-1):0,o=((y0+j)*W+x0+i)*4,n0=sigma?gauss(R)*sigma:0;
      for(let k=0;k<3;k++){
        const v=(1-t)*L[j][k]+t*Rr[j][k]+(1-u)*T[i][k]+u*B[i][k]-((1-t)*(1-u)*c00[k]+(1-t)*u*c01[k]+t*(1-u)*c10[k]+t*u*c11[k]);
        d[o+k]=Math.max(0,Math.min(255,v+n0+(sigma?gauss(R)*sigma*.25:0)));
      }
      d[o+3]=255;
    }}
}
function meanColor(d,W,H,x0,y0,x1,y1){
  x0=Math.max(0,x0|0);y0=Math.max(0,y0|0);x1=Math.min(W,x1|0);y1=Math.min(H,y1|0);
  let r=0,g=0,b=0,n=0;const sx=Math.max(1,((x1-x0)/40)|0),sy=Math.max(1,((y1-y0)/40)|0);
  for(let y=y0;y<y1;y+=sy)for(let x=x0;x<x1;x+=sx){const i=(y*W+x)*4;r+=d[i];g+=d[i+1];b+=d[i+2];n++}
  return n?rgb2hex(r/n,g/n,b/n):'#FFFFFF';
}
function ringMedian(d,W,H,x0,y0,x1,y1,m){
  const rs=[],gs=[],bs=[];const push=(x,y)=>{if(x<0||y<0||x>=W||y>=H)return;const i=(y*W+x)*4;rs.push(d[i]);gs.push(d[i+1]);bs.push(d[i+2])};
  const sx=Math.max(1,((x1-x0)/60)|0),sy=Math.max(1,((y1-y0)/60)|0);
  for(let k=1;k<=m;k++){for(let x=x0-m;x<x1+m;x+=sx){push(x,y0-k);push(x,y1+k-1)}for(let y=y0;y<y1;y+=sy){push(x0-k,y);push(x1+k-1,y)}}
  const med=a=>{a.sort((p,q)=>p-q);return a.length?a[a.length>>1]:255};return [med(rs),med(gs),med(bs)];
}
// Text style estimate for a rectangle: background, ink colour, tight ink box, weight (from ink coverage), edge softness
function inkAnalyze(d,W,H,x0,y0,x1,y1){
  x0=Math.max(0,x0|0);y0=Math.max(0,y0|0);x1=Math.min(W,x1|0);y1=Math.min(H,y1|0);const w=x1-x0,h=y1-y0;if(w<2||h<2)return null;
  const bg=ringMedian(d,W,H,x0,y0,x1,y1,3),dist=new Float32Array(w*h),srt=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=((y0+y)*W+x0+x)*4,dd=Math.hypot(d[i]-bg[0],d[i+1]-bg[1],d[i+2]-bg[2]);dist[y*w+x]=dd;srt.push(dd)}
  srt.sort((a,b)=>a-b);const p=srt[Math.floor(.97*(srt.length-1))];if(p<28)return null;
  const thr=Math.max(22,p*.4),mask=new Uint8Array(w*h);let minx=1e9,miny=1e9,maxx=-1,maxy=-1,cnt=0,sr=0,sg=0,sb=0,nc=0,soft=0,core=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dd=dist[y*w+x],i=((y0+y)*W+x0+x)*4;
    if(dd>thr){mask[y*w+x]=1;cnt++;if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y}
    if(dd>=p*.8){sr+=d[i];sg+=d[i+1];sb+=d[i+2];nc++;core++}else if(dd>p*.15)soft++}
  const cov=cnt/((maxx-minx+1)*(maxy-miny+1)),sf=soft/(soft+core+1);
  return {bg:rgb2hex(bg[0],bg[1],bg[2]),fg:nc?rgb2hex(sr/nc,sg/nc,sb/nc):'#000000',box:{x0:x0+minx,y0:y0+miny,x1:x0+maxx+1,y1:y0+maxy+1},
    coverage:cov,weight:cov>.31?700:cov>.285?500:400,softness:sf>.5?Math.min(1.2,(sf-.5)*2.4):0,mask,mw:w,mh:h,mx:minx,my:miny};
}
function pixelate(d,W,H,x0,y0,x1,y1,b){
  x0=Math.max(0,x0|0);y0=Math.max(0,y0|0);x1=Math.min(W,x1|0);y1=Math.min(H,y1|0);
  for(let by=y0;by<y1;by+=b)for(let bx=x0;bx<x1;bx+=b){const ex=Math.min(bx+b,x1),ey=Math.min(by+b,y1);let r=0,g=0,bl=0,n=0;
    for(let y=by;y<ey;y++)for(let x=bx;x<ex;x++){const i=(y*W+x)*4;r+=d[i];g+=d[i+1];bl+=d[i+2];n++}
    r/=n;g/=n;bl/=n;for(let y=by;y<ey;y++)for(let x=bx;x<ex;x++){const i=(y*W+x)*4;d[i]=r;d[i+1]=g;d[i+2]=bl;d[i+3]=255}}
}
function tightBox(m,w,h){let a=1e9,b=1e9,c=-1,e=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(m[y*w+x]){if(x<a)a=x;if(x>c)c=x;if(y<b)b=y;if(y>e)e=y}return c<0?null:{x0:a,y0:b,x1:c+1,y1:e+1}}
function resampleMask(m,w,h,box,tw,th){
  const out=new Float32Array(tw*th),bw=box.x1-box.x0,bh=box.y1-box.y0;
  for(let ty=0;ty<th;ty++)for(let tx=0;tx<tw;tx++){
    const sx0=box.x0+Math.floor(tx*bw/tw),sx1=Math.max(sx0+1,box.x0+Math.ceil((tx+1)*bw/tw)),sy0=box.y0+Math.floor(ty*bh/th),sy1=Math.max(sy0+1,box.y0+Math.ceil((ty+1)*bh/th));
    let s=0,n=0;for(let y=sy0;y<sy1&&y<h;y++)for(let x=sx0;x<sx1&&x<w;x++){s+=m[y*w+x];n++}out[ty*tw+tx]=n?s/n:0}
  return out;
}
function ncc(a,b){let ma=0,mb=0;const n=a.length;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i]}ma/=n;mb/=n;let ab=0,aa=0,bb=0;for(let i=0;i<n;i++){const x=a[i]-ma,y=b[i]-mb;ab+=x*y;aa+=x*x;bb+=y*y}return aa&&bb?ab/Math.sqrt(aa*bb):0}
function kmeans(px,k,it){
  k=Math.min(k,px.length);let cs=Array.from({length:k},(_,i)=>px[Math.floor(i*px.length/k)].slice());
  for(let n=0;n<it;n++){const s=cs.map(()=>[0,0,0,0]);
    for(const p of px){let b=0,dd=1e12;for(let i=0;i<k;i++){const q=cs[i],e=(p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2;if(e<dd){dd=e;b=i}}const t=s[b];t[0]+=p[0];t[1]+=p[1];t[2]+=p[2];t[3]++}
    cs=s.map((t,i)=>t[3]?[t[0]/t[3],t[1]/t[3],t[2]/t[3],t[3]]:cs[i]);}
  return cs.sort((a,b)=>b[3]-a[3]);
}
// lightness inversion that keeps hue and chroma (c' = c - min + 255 - max), softened so dark mode is near-black rather than #000
const flipC=(c,mn,mx)=>10+(c-mn+255-mx)*(235/255);
function flipL(hex){const [r,g,b]=hex2rgb(hex),mn=Math.min(r,g,b),mx=Math.max(r,g,b);return rgb2hex(flipC(r,mn,mx),flipC(g,mn,mx),flipC(b,mn,mx))}
// shrink tracking first (to -0.03em), then size (down to minScale), so text keeps the original box width
function fitFont(measure,text,size,maxW,minScale){
  let w=measure(size);const n=Math.max(1,text.length-1);if(w<=maxW)return {size,sp:0};
  let sp=(maxW-w)/n;if(sp>=-.03*size)return {size,sp};
  const s=Math.max(size*minScale,size*maxW/w);w=measure(s);if(w<=maxW)return {size:s,sp:0};
  return {size:s,sp:Math.max(-.05*s,(maxW-w)/n)};
}
function luhn(s){const d=s.replace(/\D/g,'');if(d.length<13||d.length>19)return false;let sum=0,alt=false;for(let i=d.length-1;i>=0;i--){let n=+d[i];if(alt){n*=2;if(n>9)n-=9}sum+=n;alt=!alt}return sum%10===0}
function piiKinds(t){
  const k=[];
  if(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/.test(t))k.push('email');else if(/(^|\s)[\w.\-]{2,}@[a-z]{2,}\b/i.test(t))k.push('UPI id');
  if(/(?:\+?91[\s-]?)?\b[6-9]\d{9}\b/.test(t)||/\+\d{1,3}[\s-]?\d{2,5}[\s-]?\d{3,5}[\s-]?\d{3,5}/.test(t))k.push('phone');
  const cards=t.match(/\b(?:\d[ -]?){13,19}\b/g)||[];if(cards.some(luhn))k.push('card number');
  if(/\b\d{4}\s\d{4}\s\d{4}\b/.test(t)&&!k.includes('card number'))k.push('Aadhaar-like number');
  if(/\b[A-Z]{5}\d{4}[A-Z]\b/.test(t))k.push('PAN');
  if(/\b[A-Z]{4}0[A-Z0-9]{6}\b/.test(t))k.push('IFSC');
  if(/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(t))k.push('IP address');
  if(/\b(otp|pin|cvv|password)\b\D{0,6}\d{3,8}/i.test(t))k.push('code or PIN');
  return k;
}
const LANGS={en:'English',hi:'Hindi',te:'Telugu',ta:'Tamil',kn:'Kannada',ml:'Malayalam',mr:'Marathi',bn:'Bengali',gu:'Gujarati',pa:'Punjabi',ur:'Urdu',ar:'Arabic',he:'Hebrew',fa:'Persian',es:'Spanish',fr:'French',de:'German',it:'Italian',pt:'Portuguese',nl:'Dutch',sv:'Swedish',pl:'Polish',tr:'Turkish',ru:'Russian',uk:'Ukrainian',id:'Indonesian',vi:'Vietnamese',th:'Thai',zh:'Chinese',ja:'Japanese',ko:'Korean'};
function parseCmd(s){
  const c=s.toLowerCase().trim();let m;
  if(/^(undo|go back)\b/.test(c))return {op:'undo'};
  if(/^redo\b/.test(c))return {op:'redo'};
  if(/\b(reset|start over)\b/.test(c))return {op:'reset'};
  if(m=c.match(/translate\b.*?\b(?:to|into)\s+([a-z]+)/)){const code=Object.keys(LANGS).find(k=>LANGS[k].toLowerCase()===m[1]);if(code)return {op:'translate',lang:code}}
  if(/dark\s*(mode|theme|variant)/.test(c))return {op:'dark'};
  if(/\binvert\b/.test(c))return {op:'invert'};
  if(/\b(redact|hide (private|sensitive)|remove (private|personal)|pii)\b/.test(c))return {op:'redact'};
  if(/\b(detect|scan|read|find)\b.*\btext\b|\bocr\b/.test(c))return {op:'detect'};
  if(m=c.match(/\b(?:extend|expand|outpaint)\b\D*(\d+)?/))return {op:'extend',n:+m[1]||80};
  if(/\bcrop\b/.test(c))return {op:'crop'};
  if(/(fix|improve|check).*(contrast|accessib)|wcag/.test(c))return {op:'a11y'};
  if(m=c.match(/\b(?:download|save|export)\b\s*(?:as|to)?\s*(png|jpe?g|webp|pdf|svg|json|project)?/))return {op:'export',fmt:m[1]?(m[1]==='jpeg'?'jpg':m[1]==='project'?'json':m[1]):null};
  if(m=c.match(/\bpage\s*(\d+)/))return {op:'page',n:+m[1]};
  if(/\b(compare|before)\b/.test(c))return {op:'compare'};
  return {op:'unknown'};
}
function mapPdfFont(real,generic){
  const n=(real||'').toLowerCase().replace(/^[a-z]{6}\+/,'');
  const it=/italic|oblique|-it\b/.test(n);
  const weight=/black|heavy/.test(n)?800:/semibold|demi/.test(n)?600:/bold|-bd\b/.test(n)?700:/medium/.test(n)?500:/light|thin/.test(n)?300:400;
  let family;
  if(/courier|mono|consolas|menlo/.test(n)||generic==='monospace')family='ui-monospace,"Courier New",monospace';
  else if((/times|georgia|garamond|palatino|cambria|minion|playfair|merriweather|lora|serif/.test(n)&&!/sans/.test(n))||(generic==='serif'&&!n))family='Georgia,"Times New Roman",serif';
  else if(/arial|helvet/.test(n))family='Arial,Helvetica,sans-serif';
  else if(/calibri|carlito/.test(n))family='Calibri,Carlito,sans-serif';
  else if(/roboto/.test(n))family='Roboto,sans-serif';else if(/inter/.test(n))family='Inter,system-ui,sans-serif';
  else family='system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  return {family,weight,italic:it,label:n||'unknown'};
}
// merge pdf.js text runs into visual lines
function groupItems(items){
  const its=items.slice().sort((a,b)=>Math.abs(a.baseline-b.baseline)<2?a.x-b.x:a.baseline-b.baseline),lines=[];
  for(const it of its){
    const L=lines.find(l=>Math.abs(l.baseline-it.baseline)<Math.max(2,.3*l.size)&&it.x>=l.x1-1&&it.x-l.x1<Math.max(.6*l.size,8));
    if(L){const gap=it.x-L.x1;L.text+=(gap>.12*L.size&&!L.text.endsWith(' ')&&!it.str.startsWith(' ')?' ':'')+it.str;L.x1=it.x+it.w;if(it.str.length>L.longest){L.longest=it.str.length;L.pdf=it.m;L.size=Math.max(L.size,it.size)}}
    else lines.push({text:it.str,x0:it.x,x1:it.x+it.w,baseline:it.baseline,size:it.size,longest:it.str.length,pdf:it.m,pdfX:it.px,pdfY:it.py});
  }
  lines.forEach(l=>{l.y0=l.baseline-l.size*.86;l.y1=l.baseline+l.size*.24});
  return lines.filter(l=>l.text.trim());
}
function vcard(a){
  return ['BEGIN:VCARD','VERSION:3.0','N:'+a.last+';'+a.first+';;;','FN:'+a.first+' '+a.last,'TITLE:'+a.title,'TEL;TYPE=CELL:'+a.tel,'EMAIL:'+a.email,...a.urls.map(u=>'URL:'+u),'END:VCARD'].join('\r\n');
}

// ---------- real PDF text editing helpers (pure, tested against real PDF content streams) ----------
// Tokenises a PDF content stream (treated as Latin-1) and blanks the strings of text-show operators whose start point
// matches one of `starts` (PDF user space, points). Later show ops chained on the same line (no repositioning) go with it.
// Blanking is layout-safe: the next positioned text starts from Td/Tm, which never depends on glyph advances.
function pdfStripText(src,starts,tol){
  tol=tol||.9;const n=src.length,toks=[];let i=0;
  const WS=c=>c===' '||c==='\n'||c==='\r'||c==='\t'||c==='\f'||c==='\0',DL='()<>[]{}/%';
  const isNum=t=>/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t);
  function readStr(){let d=0,j=i;do{const c=src[j];if(c==='\\')j++;else if(c==='(')d++;else if(c===')')d--;j++}while(d>0&&j<n);return j}
  function readArr(){const kids=[];const s=i;i++;while(i<n){const c=src[i];if(WS(c)){i++;continue}if(c===']'){i++;return{t:'arr',s,e:i,kids}}
      if(c==='('){const e=readStr();kids.push({t:'str',s:i,e});i=e}else if(c==='<'&&src[i+1]!=='<'){const e=src.indexOf('>',i)+1||n;kids.push({t:'hex',s:i,e});i=e}else{let j=i;while(j<n&&!WS(src[j])&&!DL.includes(src[j]))j++;if(j===i)j=i+1;kids.push({t:'num',s:i,e:j,v:parseFloat(src.slice(i,j))});i=j}}
    return{t:'arr',s,e:n,kids}}
  while(i<n){
    const c=src[i];if(WS(c)){i++;continue}
    if(c==='%'){while(i<n&&src[i]!=='\n'&&src[i]!=='\r')i++;continue}
    if(c==='('){const e=readStr();toks.push({t:'str',s:i,e});i=e;continue}
    if(c==='['){toks.push(readArr());continue}
    if(c==='<'){if(src[i+1]==='<'){toks.push({t:'dict',s:i,e:i+2});i+=2}else{const e=src.indexOf('>',i)+1||n;toks.push({t:'hex',s:i,e});i=e}continue}
    if(c==='>'){toks.push({t:'dict',s:i,e:src[i+1]==='>'?i+2:i+1});i+=src[i+1]==='>'?2:1;continue}
    if(c==='/'){let j=i+1;while(j<n&&!WS(src[j])&&!DL.includes(src[j]))j++;toks.push({t:'name',s:i,e:j,v:src.slice(i+1,j)});i=j;continue}
    if(c===']'||c==='{'||c==='}'||c===')'){i++;continue}
    let j=i;while(j<n&&!WS(src[j])&&!DL.includes(src[j]))j++;const w=src.slice(i,j);
    if(isNum(w))toks.push({t:'num',s:i,e:j,v:parseFloat(w)});else{toks.push({t:'op',s:i,e:j,v:w});
      if(w==='ID'){const m=/[\s]EI(?=[\s]|$)/g;m.lastIndex=j;const r=m.exec(src);i=r?r.index+r[0].length:n;toks.push({t:'op',s:j,e:i,v:'EI'});continue}}
    i=j;
  }
  const mul=(m,k)=>[m[0]*k[0]+m[1]*k[2],m[0]*k[1]+m[1]*k[3],m[2]*k[0]+m[3]*k[2],m[2]*k[1]+m[3]*k[3],m[4]*k[0]+m[5]*k[2]+k[4],m[4]*k[1]+m[5]*k[3]+k[5]];
  let ctm=[1,0,0,1,0,0],stack=[],tm=[1,0,0,1,0,0],tlm=[1,0,0,1,0,0],lead=0,rise=0,chain=false,args=[];const edits=[];let matched=0;
  const startPt=()=>{const x=rise*tm[2]+tm[4],y=rise*tm[3]+tm[5];return[x*ctm[0]+y*ctm[2]+ctm[4],x*ctm[1]+y*ctm[3]+ctm[5]]};
  const hit=()=>{const p=startPt();return starts.some(s=>Math.abs(s.x-p[0])<=tol&&Math.abs(s.y-p[1])<=tol)};
  const td=(x,y)=>{tlm=mul([1,0,0,1,x,y],tlm);tm=tlm.slice();chain=false};
  const blank=a=>{if(a.t==='str')edits.push([a.s,a.e,'()']);else if(a.t==='hex')edits.push([a.s,a.e,'<>']);else if(a.t==='arr')edits.push([a.s,a.e,'[]'])};
  for(const tk of toks){
    if(tk.t!=='op'){args.push(tk);continue}
    const op=tk.v,nums=args.filter(a=>a.t==='num').map(a=>a.v);
    switch(op){
      case'q':stack.push(ctm.slice());break;case'Q':if(stack.length)ctm=stack.pop();break;
      case'cm':if(nums.length>=6)ctm=mul(nums.slice(-6),ctm);break;
      case'BT':tm=[1,0,0,1,0,0];tlm=[1,0,0,1,0,0];chain=false;break;case'ET':chain=false;break;
      case'TL':lead=nums[0]||0;break;case'Ts':rise=nums[0]||0;break;
      case'Td':td(nums[0]||0,nums[1]||0);break;case'TD':lead=-(nums[1]||0);td(nums[0]||0,nums[1]||0);break;
      case'Tm':if(nums.length>=6){tm=nums.slice(-6);tlm=tm.slice()}chain=false;break;
      case'T*':td(0,-lead);break;
      case'Tj':case'TJ':{const a=args[args.length-1];if(a&&(chain||hit())){chain=true;matched++;blank(a)}break}
      case"'":{td(0,-lead);const a=args[args.length-1];if(a&&hit()){chain=true;matched++;blank(a)}break}
      case'"':{td(0,-lead);const a=args[args.length-1];if(a&&hit()){chain=true;matched++;blank(a)}break}
    }
    args=[];
  }
  if(!edits.length)return{out:src,matched:0};
  edits.sort((a,b)=>a[0]-b[0]);let out='',pos=0;for(const[s,e,r]of edits){out+=src.slice(pos,s)+r;pos=e}out+=src.slice(pos);
  return{out,matched};
}
// Which pixels of an edited page differ from the original render? Returns tight boxes (x1,y1 exclusive) and the changed-area fraction.
function changedPatches(a,b,w,h,cell,merge){
  cell=cell||8;merge=merge==null?6:merge;const cw=Math.ceil(w/cell),ch=Math.ceil(h/cell),flag=new Uint8Array(cw*ch);let px=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12||Math.abs(a[i+3]-b[i+3])>8){flag[((y/cell)|0)*cw+((x/cell)|0)]=1;px++}}
  const seen=new Uint8Array(cw*ch),boxes=[];
  for(let s=0;s<cw*ch;s++){if(!flag[s]||seen[s])continue;const q=[s];seen[s]=1;let x0=1e9,y0=1e9,x1=-1,y1=-1;
    while(q.length){const c=q.pop(),cx=c%cw,cy=(c/cw)|0;
      for(let y=cy*cell;y<Math.min(h,cy*cell+cell);y++)for(let x=cx*cell;x<Math.min(w,cx*cell+cell);x++){const i=(y*w+x)*4;if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12||Math.abs(a[i+3]-b[i+3])>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=cw||ny>=ch)continue;const k=ny*cw+nx;if(flag[k]&&!seen[k]){seen[k]=1;q.push(k)}}}
    boxes.push({x0,y0,x1:x1+1,y1:y1+1})}
  let again=true;while(again){again=false;for(let i=0;i<boxes.length&&!again;i++)for(let j=i+1;j<boxes.length;j++){const A=boxes[i],B=boxes[j];
      if(A.x0-merge<B.x1&&B.x0-merge<A.x1&&A.y0-merge<B.y1&&B.y0-merge<A.y1){boxes[i]={x0:Math.min(A.x0,B.x0),y0:Math.min(A.y0,B.y0),x1:Math.max(A.x1,B.x1),y1:Math.max(A.y1,B.y1)};boxes.splice(j,1);again=true;break}}}
  return{boxes,frac:px/(w*h)};
}
// canvas -> PDF user space affine from pdf.js viewport samples: o=(0,0), x=(1,0), y=(0,1) already converted with convertToPdfPoint
function affFromPoints(o,x,y){return[x[0]-o[0],x[1]-o[1],y[0]-o[0],y[1]-o[1],o[0],o[1]]}
const applyAff=(f,x,y)=>[f[0]*x+f[2]*y+f[4],f[1]*x+f[3]*y+f[5]];
const affUnrotated=f=>Math.abs(f[1])<1e-6&&Math.abs(f[2])<1e-6&&f[0]>0&&f[3]<0;
// map a text object's CSS font stack + weight to something embeddable in a PDF
const WEBFONTS={'roboto':'roboto','open sans':'open-sans','lato':'lato','montserrat':'montserrat','poppins':'poppins','inter':'inter','nunito':'nunito','dm sans':'dm-sans','work sans':'work-sans','space grotesk':'space-grotesk','playfair display':'playfair-display','merriweather':'merriweather','lora':'lora','jetbrains mono':'jetbrains-mono'};
function pickPdfFont(css,weight,italic){
  const first=(css||'').split(',')[0].replace(/["']/g,'').trim().toLowerCase(),bold=+weight>=600,all=(css||'').toLowerCase();
  if(WEBFONTS[first])return{kind:'web',id:WEBFONTS[first],bold,italic:!!italic,name:first};
  let base='Helvetica';
  if(/courier|mono|consolas|menlo/.test(first)||(/monospace/.test(all)&&!/sans|serif/.test(first)&&first===''))base='Courier';
  else if(/times|georgia|garamond|palatino|cambria|serif/.test(first)&&!/sans/.test(first))base='Times';
  else if(first==='system-ui'||first==='-apple-system'||/arial|helvet|calibri|carlito|segoe|sans/.test(first)){base='Helvetica'}
  else if(/serif/.test(all)&&!/sans/.test(all))base='Times';
  return{kind:'std',base,bold,italic:!!italic,name:stdFontName(base,bold,!!italic)};
}
function stdFontName(base,bold,italic){
  if(base==='Times')return bold&&italic?'Times-BoldItalic':bold?'Times-Bold':italic?'Times-Italic':'Times-Roman';
  const b=base==='Courier'?'Courier':'Helvetica';return bold&&italic?b+'-BoldOblique':bold?b+'-Bold':italic?b+'-Oblique':b;
}
//</core>
