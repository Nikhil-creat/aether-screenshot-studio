const fs=require('fs');const src=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','index.html'),'utf8');
const core=src.match(/\/\/<core>([\s\S]*?)\/\/<\/core>/)[1];
const names=[...core.matchAll(/(?:^|\n)(?:const|function)\s+([A-Za-z0-9_]+)/g)].map(m=>m[1]);
const api=new Function(core+'\nreturn {'+[...new Set(names)].join(',')+'}')();
let pass=0,fail=0;const t=(n,f)=>{try{f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,e.message)}};
const eq=(a,b,m)=>{if(a!==b)throw new Error((m||'')+` expected ${b} got ${a}`)};const ok=(c,m)=>{if(!c)throw new Error(m||'assert')};
const seeded=s=>()=>{s=(s*1664525+1013904223)%4294967296;return (s+1)/4294967297};
const {flipC,contrast,fixFg,coonsFill,noiseSigma,inkAnalyze,pixelate,tightBox,resampleMask,ncc,fitFont,piiKinds,luhn,parseCmd,mapPdfFont,groupItems,vcard,flipL,kmeans}=api;
t('contrast black/white',()=>ok(Math.abs(contrast('#000000','#FFFFFF')-21)<.01));
t('fixFg reaches AAA',()=>{const f=fixFg('#777777','#FFFFFF',7);ok(contrast(f,'#FFFFFF')>=7,f)});
t('fixFg on dark bg',()=>{const f=fixFg('#555555','#111111',7);ok(contrast(f,'#111111')>=7,f)});
const grad=(W,H,f)=>{const d=new Uint8ClampedArray(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,v=f(x,y);d[i]=v;d[i+1]=v*.9;d[i+2]=v*.8;d[i+3]=255}return d};
t('coonsFill rebuilds gradient under text',()=>{const W=120,H=80,f=(x,y)=>60+x*.5+y*.4,d=grad(W,H,f);
  for(let y=30;y<50;y++)for(let x=30;x<90;x++)if((x+y)%5<2){const i=(y*W+x)*4;d[i]=d[i+1]=d[i+2]=255}
  coonsFill(d,W,H,28,28,92,52,0);let m=0;for(let y=28;y<52;y++)for(let x=28;x<92;x++){const i=(y*W+x)*4;m=Math.max(m,Math.abs(d[i]-f(x,y)))}ok(m<3,'max err '+m)});
t('noiseSigma estimates grain',()=>{const R=seeded(7),W=200,H=60,d=new Uint8ClampedArray(W*H*4);for(let i=0;i<W*H;i++){const n=api.gauss?0:0;d[i*4]=d[i*4+1]=d[i*4+2]=128;d[i*4+3]=255}
  const G=()=>{let u=R(),v=R();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};for(let i=0;i<W*H;i++){const n=G()*3;for(let k=0;k<3;k++)d[i*4+k]=128+n}
  const s=noiseSigma(d,W,H,20,20,180,40);ok(s>2.2&&s<3.8,'sigma '+s)});
t('fill re-adds grain',()=>{const R=seeded(3),W=200,H=60,d=new Uint8ClampedArray(W*H*4).fill(128);for(let i=0;i<W*H;i++)d[i*4+3]=255;
  coonsFill(d,W,H,40,20,160,40,3,R);let s=0,n=0,mu=0;const v=[];for(let y=20;y<40;y++)for(let x=40;x<160;x++){v.push(d[(y*W+x)*4])}mu=v.reduce((a,b)=>a+b)/v.length;const sd=Math.sqrt(v.reduce((a,b)=>a+(b-mu)**2,0)/v.length);ok(sd>2&&sd<4.2,'sd '+sd)});
t('inkAnalyze finds box, colour, weight',()=>{const W=200,H=60,d=new Uint8ClampedArray(W*H*4).fill(255);
  const bars=(th)=>{for(let x=50;x<150;x+=8)for(let y=20;y<40;y++)for(let k=0;k<th;k++){const i=(y*W+x+k)*4;d[i]=20;d[i+1]=30;d[i+2]=200}};bars(2);
  const a=inkAnalyze(d,W,H,40,10,160,50);ok(a,'null');eq(a.bg,'#FFFFFF');eq(a.box.y0,20);eq(a.box.y1,40);ok(a.box.x0===50,'x0 '+a.box.x0);ok(a.fg==='#141EC8','fg '+a.fg);eq(a.weight,400)
  d.fill(255);bars(6);const b=inkAnalyze(d,W,H,40,10,160,50);ok(b.coverage>a.coverage&&b.weight>=500,'bold '+b.coverage+' '+b.weight)});
t('inkAnalyze returns null for blank',()=>{const d=new Uint8ClampedArray(100*40*4).fill(200);eq(inkAnalyze(d,100,40,10,10,90,30),null)});
t('pixelate destroys detail',()=>{const W=40,H=40,d=new Uint8ClampedArray(W*H*4);for(let i=0;i<W*H;i++){d[i*4]=(i%2)*255;d[i*4+1]=d[i*4+2]=d[i*4];d[i*4+3]=255}pixelate(d,W,H,0,0,40,40,10);const a=d[0],b=d[4];ok(Math.abs(a-b)<1,'blocks uniform');ok(a>100&&a<155,'avg '+a)});
t('mask helpers + ncc',()=>{const w=20,h=10,m=new Uint8Array(w*h);for(let y=2;y<8;y++)for(let x=4;x<16;x++)m[y*w+x]=1;const b=tightBox(m,w,h);eq(b.x0,4);eq(b.x1,16);eq(b.y0,2);eq(b.y1,8);
  const r=resampleMask(m,w,h,b,12,6);ok(r.every(v=>v===1));const a=new Float32Array([1,0,1,0]),c=new Float32Array([0,1,0,1]);ok(ncc(a,a)>.999&&ncc(a,c)<-.999)});
t('fitFont tracking then size',()=>{const meas=s=>.55*s*20,f1=fitFont(meas,'x'.repeat(20),20,220,.65);eq(f1.size,20);eq(f1.sp,0);
  const f2=fitFont(meas,'x'.repeat(20),20,215,.65);ok(f2.size===20&&f2.sp<0&&f2.sp>=-.6,'tracking '+JSON.stringify(f2));
  const f3=fitFont(meas,'x'.repeat(20),20,150,.65);ok(f3.size<20&&f3.size>=13,'size '+JSON.stringify(f3))});
t('PII detection',()=>{ok(piiKinds('Mail me at nikhil@example.com').includes('email'));ok(piiKinds('Call +91 6300556301').includes('phone'));
  ok(piiKinds('Card 4111 1111 1111 1111 exp').includes('card number'));ok(piiKinds('PAN ABCDE1234F').includes('PAN'));ok(piiKinds('IFSC HDFC0001234').includes('IFSC'));
  eq(piiKinds('Available balance').length,0);eq(piiKinds('Total $4,280.50').length,0);ok(!luhn('4111 1111 1111 1112'))});
t('command parser',()=>{eq(parseCmd('Translate this page to Telugu').lang,'te');eq(parseCmd('dark mode').op,'dark');eq(parseCmd('extend by 120 px').n,120);eq(parseCmd('hide sensitive info').op,'redact');
  eq(parseCmd('download as PDF').fmt,'pdf');eq(parseCmd('save').op,'export');eq(parseCmd('go to page 3').n,3);eq(parseCmd('scan the text').op,'detect');eq(parseCmd('blah').op,'unknown');eq(parseCmd('undo').op,'undo')});
t('pdf font mapping',()=>{const a=mapPdfFont('ABCDEF+Arial-BoldMT','sans-serif');eq(a.weight,700);ok(/Arial/.test(a.family));const b=mapPdfFont('TimesNewRomanPS-ItalicMT','');ok(b.italic&&/serif/.test(b.family));
  ok(/monospace/.test(mapPdfFont('CourierNewPSMT','').family));ok(!/Georgia/.test(mapPdfFont('OpenSans-Regular','sans-serif').family));eq(mapPdfFont('Roboto-Medium','').weight,500)});
t('group pdf runs into lines',()=>{const L=groupItems([{str:'Hello',x:10,w:40,baseline:100,size:12,m:{}},{str:'world',x:56,w:38,baseline:100.4,size:12,m:{}},{str:'Next line',x:10,w:60,baseline:120,size:12,m:{}}]);
  eq(L.length,2);eq(L[0].text,'Hello world');ok(L[0].y0<L[0].baseline&&L[0].y1>L[0].baseline)});
t('vcard',()=>{const v=vcard({first:'Nikhil Chary',last:'Sriramoju',title:'B.Tech CSE',tel:'+916300556301',email:'a@b.c',urls:['https://github.com/Nikhil-creat']});ok(v.includes('FN:Nikhil Chary Sriramoju')&&v.includes('TEL;TYPE=CELL:+916300556301')&&v.startsWith('BEGIN:VCARD'))});
t('flipL inverts lightness, keeps hue',()=>{const {lum,hex2rgb}=api;ok(lum(hex2rgb(flipL('#FFFFFF')))<.01,'white->'+flipL('#FFFFFF'));ok(lum(hex2rgb(flipL('#000000')))>.7);
  const b=hex2rgb(flipL('#0000FF'));ok(b[2]>b[0]+150&&b[2]>b[1]+150,'blue stays blue '+b);const y=hex2rgb(flipL('#FFF3C4'));ok(lum(y)<.15&&y[0]>y[2],'cream->dark warm '+y)});
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
