require('./harness.js');
const T=globalThis.__T,ids=globalThis.__ids,El=globalThis.__El;ids('#xt').checked=true;ids('#wm').checked=true;ids('#fp').checked=false;
let pass=0,fail=0;const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'-',e.message);if(process.env.V)console.log(e.stack)}};
const ok=(c,m)=>{if(!c)throw new Error(m||'assert')};
const mkCanvas=(w,h,fn)=>{const c=new El('c');c.width=w;c.height=h;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,v=fn(x,y);c._buf[i]=v[0];c._buf[i+1]=v[1];c._buf[i+2]=v[2];c._buf[i+3]=255}return c};
// light gradient page with dark-blue "text" bars at x 50..250, y 100..124 (ink colour #1B2350)
const pageFn=(x,y)=>{let bg=[230-x*.05,235-y*.05,250];if(y>=100&&y<124&&x>=50&&x<250&&(x%9)<4)return [27,35,80];return bg};
const fire=async(type,x,y)=>ids('#ov').fire(type,{clientX:x,clientY:y,pointerId:1});
const drag=async(x0,y0,x1,y1)=>{await fire('pointerdown',x0,y0);await fire('pointermove',x1,y1);await fire('pointerup',x1,y1)};
const inkLeft=(r)=>{let n=0;const d=T.bx.getImageData(r[0],r[1],r[2]-r[0],r[3]-r[1]).data;for(let i=0;i<d.length;i+=4)if(d[i]<100)n++;return n};
(async()=>{
await t('open image and analyse',async()=>{T.startSession([{canvas:mkCanvas(400,300,pageFn),name:'shot.png'}]);ok(T.base.width===400&&T.base.height===300);ok(T.pages.length===1&&T.pages[0].hist.length===1);
  const a=T.analyzeRect({x0:40,y0:90,x1:260,y1:134});ok(a&&a.box.y0===100&&a.box.y1===124,'box '+JSON.stringify(a&&a.box));ok(a.fg==='#1B2350','fg '+a.fg)});
await t('replace text: erases old ink, matches colour, adds object',async()=>{T.setTool('replace');ids('#rep').value='Hello there';ok(inkLeft([50,100,250,124])>200);await drag(40,90,260,134);
  ok(inkLeft([50,100,250,124])===0,'ink left '+inkLeft([50,100,250,124]));ok(T.objs.length===1);const o=T.objs[0];ok(o.t==='Hello there'&&o.c==='#1B2350','colour '+o.c);ok(o.s>15&&o.s<60,'size '+o.s);ok(o.y>=100&&o.y<=135,'baseline '+o.y);ok(o.src&&o.src.box.y0===100);ok(T.pages[0].hist.length===2)});
await t('erased area matches surrounding gradient',async()=>{const d=T.bx.getImageData(150,112,1,1).data,exp=[230-150*.05,235-112*.05,250];ok(Math.abs(d[0]-exp[0])<4&&Math.abs(d[1]-exp[1])<4,`got ${[...d]} want ${exp}`)});
await t('undo restores ink and drops object; redo replays',async()=>{T.undo();ok(inkLeft([50,100,250,124])>200&&T.objs.length===0);T.redo();ok(inkLeft([50,100,250,124])===0&&T.objs.length===1)});
await t('smart erase + redact + a11y',async()=>{T.setTool('erase');await drag(300,200,380,260);ok(T.pages[0].hist.length===3);T.setTool('redact');ids('#redMode').value='blk';await drag(20,20,120,60);
  ok(T.bx.getImageData(50,40,1,1).data[0]===0,'black bar');T.renderA11y();ok(ids('#a11yOut').innerHTML.includes('AAA'),ids('#a11yOut').innerHTML.slice(0,80))});
await t('crop shifts objects; extend grows canvas and shifts',async()=>{const ox=T.objs[0].x;T.setTool('crop');await drag(30,30,330,280);ok(T.base.width===300&&T.base.height===250,T.base.width+'x'+T.base.height);ok(Math.abs(T.objs[0].x-(ox-30))<.01);
  T.extend(40);ok(T.base.width===380&&T.base.height===330);ok(Math.abs(T.objs[0].x-(ox-30+40))<.01)});
await t('code + svg export contain the live text',async()=>{T.renderCode();const c=ids('#codeOut').textContent;ok(c.includes('Hello there')&&c.includes('Nikhil Chary Sriramoju'));
  const s=T.svgOf(T.P().hist.at(-1),true);ok(s.includes('<text')&&s.includes('Hello there')&&s.includes('<image'))});
await t('export png / jpg / svg / json / pdf all run',async()=>{const names=[];T.saveBlobSpy((b,n)=>names.push(n));
  for(const f of['png','jpg','webp','svg','json','pdf']){ids('#xf').value=f;ids('#xq').value='90';ids('#xs').value='one';await T.doExport(f)}
  ok(names.length===6,names.join());ok(names.some(n=>n.endsWith('.pdf'))&&names.some(n=>n.endsWith('.aether.json')),names.join());const pdf=globalThis.__pdf();ok(pdf&&pdf.images.length===1&&pdf.texts.some(x=>x.t==='Hello there'&&x.o.renderingMode==='invisible'),'pdf text layer')});
await t('multi-page session + page switching keeps edits separate',async()=>{T.startSession([{canvas:mkCanvas(200,200,()=>[255,255,255]),name:'a.png'},{canvas:mkCanvas(200,200,()=>[10,10,10]),name:'b.png'}]);T.setTool('erase');await drag(10,10,50,50);
  T.goPage(1);ok(T.cur===1&&T.bx.getImageData(5,5,1,1).data[0]===10);T.goPage(0);ok(T.pages[0].hist.length===2&&T.pages[1].hist.length===1)});
await t('PDF page: text items snap the box and copy the font',async()=>{
  const items=[{str:'Invoice total',x:50,baseline:120,w:110,size:18,m:{family:'Arial,Helvetica,sans-serif',weight:700,italic:false,label:'arial-bold'}},{str:'due soon',x:166,baseline:120.3,w:60,size:18,m:{family:'Arial,Helvetica,sans-serif',weight:700,italic:false,label:'arial-bold'}}];
  T.startSession([{canvas:mkCanvas(400,300,(x,y)=>(y>=106&&y<122&&x>=50&&x<226&&x%7<3)?[0,0,0]:[255,255,255]),name:'doc.pdf p1',items,pdfSize:[595,842]}]);
  const L=T.findPdfLine({x0:48,y0:100,x1:200,y1:130});ok(L&&L.text==='Invoice total due soon','line '+(L&&L.text));
  T.setTool('replace');ids('#rep').value='Paid in full';await drag(48,100,200,130);const o=T.objs[0];ok(o&&o.f.includes('Arial')&&o.w==='700'&&Math.abs(o.s-18)<3.5&&Math.abs(o.y-120)<.5,JSON.stringify(o&&{f:o.f,w:o.w,s:o.s,y:o.y}));
  ids('#xf').value='pdf';await T.doExport('pdf');const pdf=globalThis.__pdf();ok(pdf.o.format[0]===595&&pdf.o.format[1]===842,'pdf page size kept')});
await t('OCR path: detect lines, edit one, PII redaction, translation glossary',async()=>{
  globalThis.Tesseract={recognize:async()=>({data:{lines:[{text:'Sign in',confidence:90,bbox:{x0:50,y0:100,x1:150,y1:124}},{text:'mail me nikhil@example.com',confidence:88,bbox:{x0:50,y0:200,x1:330,y1:224}}]}})};
  T.startSession([{canvas:mkCanvas(400,300,(x,y)=>((y>=100&&y<124&&x>=50&&x<150&&x%8<3)||(y>=200&&y<224&&x>=50&&x<330&&x%8<3))?[20,20,20]:[250,250,250]),name:'ocr.png'}]);
  await T.detect();ok(T.P().lines.length===2,'lines '+T.P().lines.length);
  await T.scanPII();ok(ids('#piiOut').children.length>=1,'pii rows');
  ids('#tlang').value='hi';await T.translatePage();const o=T.objs.find(x=>x.t==='साइन इन');ok(o,'glossary translation applied: '+JSON.stringify(T.objs.map(x=>x.t)));ok(o.f.includes('Noto Sans Devanagari'),o.f);ok(T.P().lines.length===1,'translated line removed from list')});
await t('command parser drives the editor',async()=>{T.startSession([{canvas:mkCanvas(120,90,()=>[200,210,230]),name:'x.png'}]);await T.runCmd('extend 30');ok(T.base.width===180);await T.runCmd('dark mode');const d=T.bx.getImageData(2,2,1,1).data;ok(d[0]<80,'dark '+d[0]);await T.runCmd('undo')});
await t('sample page loads',async()=>{T.makeSample();ok(T.base.width>0)});

await t('export eligibility panel reflects real per-page flags (vector vs flattened, with reasons)',async()=>{
  const items=[{str:'Hi',x:10,baseline:20,w:20,size:12,m:{family:'Arial',weight:400,italic:false},px:10,py:20}];
  T.startSession([{canvas:mkCanvas(200,150,()=>[255,255,255]),name:'v.pdf p1',items,pdfSize:[200,150],pdfBytes:new ArrayBuffer(4),srcPageIndex:0,vpScale:1},
                  {canvas:mkCanvas(120,90,()=>[255,255,255]),name:'img.png'}]);
  T.renderEligibility();let html=ids('#pageElig').innerHTML;ok(/Vector/.test(html)&&/Flattened/.test(html),html);
  T.goPage(0);T.setTool('erase');await drag(1,1,10,10);
  T.renderEligibility();html=ids('#pageElig').innerHTML;
  ok((html.match(/Flattened/g)||[]).length===2,'both pages should now read flattened: '+html);
});
await t('batch translate and batch redact run across every open page',async()=>{
  const mkPage=(txt)=>{const items=[{str:txt,x:10,baseline:20,w:80,size:12,m:{family:'Arial',weight:400,italic:false},px:10,py:20}];
    return{canvas:mkCanvas(200,60,(x,y)=>(y>=8&&y<22&&x>=10&&x<90&&x%8<3)?[20,20,20]:[255,255,255]),name:'p.pdf',items,pdfSize:[200,60],pdfBytes:new ArrayBuffer(4),srcPageIndex:0,vpScale:1}};
  T.startSession([mkPage('Sign in'),mkPage('mail me at nikhil@example.com')]);
  ids('#tlang').value='hi';await T.translateAll();
  T.goPage(0);ok(T.objs.some(o=>o.t==='साइन इन'),'page 1 translated: '+JSON.stringify(T.objs.map(o=>o.t)));
  ids('#redMode').value='blk';await T.scanPIIAll();
  T.goPage(1);ok(T.bx.getImageData(30,15,1,1).data[0]===0,'page 2 email redacted after batch scan');
});
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})();
