// Drives the app's REAL exportRealPdf()/doExport('pdfvec') through the fake DOM harness, using the actual
// installed pdf-lib package (not a mock), against a real reportlab-generated PDF. Verifies with qpdf + pdftotext.
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
require('./harness.js');
globalThis.window.PDFLib=require('pdf-lib'); // real engine, standing in for the CDN <script> in a browser
const T=globalThis.__T,ids=globalThis.__ids,El=globalThis.__El;
ids('#xt').checked=true;ids('#wm').checked=false;ids('#xl').checked=false;
let pass=0,fail=0;const t=async(n,f)=>{try{await f();pass++;console.log('PASS',n)}catch(e){fail++;console.log('FAIL',n,'-',e.message);if(process.env.V)console.log(e.stack)}};
const ok=(c,m)=>{if(!c)throw new Error(m||'assert')};

const src=fs.readFileSync('/tmp/t1.pdf');
const pdfBytes=src.buffer.slice(src.byteOffset,src.byteOffset+src.byteLength);
const mk=(text,x,baseline,w,size,m,px,py)=>({str:text,x,baseline,w,size,rot:false,m,px,py});
// Mirrors the real /tmp/t1.pdf layout (see node_pdflib_probe2.js). vpScale is an arbitrary render resolution.
const VS=1.5;
const items=[
  mk('Total due: $4,280.50 by 30 Sep',72*VS,(842-691.8898)*VS,190*VS,12*VS,{family:'Arial,Helvetica,sans-serif',weight:400,italic:false,label:'helv'},72,691.8898),
  mk('Line two of a paragraph',72*VS,(842-637.4898)*VS,150*VS,12*VS,{family:'Georgia,serif',weight:400,italic:false,label:'times'},72,637.4898),
  mk('ref: 4111 1111 1111 1111',72*VS,(842-581.8898)*VS,150*VS,10*VS,{family:'ui-monospace,monospace',weight:400,italic:false,label:'courier'},72,581.8898),
  mk('Paid (draft)',300*VS,(842-751.8898)*VS,80*VS,14*VS,{family:'Georgia,serif',weight:400,italic:true,label:'times-it'},300,751.8898),
];
const canvas=new El('c');canvas.width=Math.round(595.2756*VS);canvas.height=Math.round(841.8898*VS);

let savedName,savedBlobLike;
T.saveBlobSpy((blobLike,name)=>{savedName=name;savedBlobLike=blobLike});

(async()=>{
await t('open a real PDF page with known text anchors',async()=>{
  T.startSession([{canvas,name:'t1.pdf p1',items,pdfSize:[595.2756,841.8898],pdfBytes,srcPageIndex:0,vpScale:VS}]);
  ok(T.pages.length===1&&T.pages[0].items.length===4);
});
await t('detect lines from real PDF text content (not OCR) and edit three of them',async()=>{
  await T.detect();const p=T.P();ok(p.lines&&p.lines.length===4,'lines '+(p.lines&&p.lines.length));
  const byText=t=>p.lines.find(l=>l.text===t);
  await T.applyLines([
    {L:byText('Total due: $4,280.50 by 30 Sep'),t:'Total due: $0.00 (settled)'},
    {L:byText('Line two of a paragraph'),t:'Line two, now revised'},
    {L:byText('ref: 4111 1111 1111 1111'),t:'ref: REDACTED'},
  ]);
  ok(T.objs.length===3,'objs '+T.objs.length);
  ok(T.objs.every(o=>o.pdfPt),'every replaced object should carry a pdfPt: '+JSON.stringify(T.objs.map(o=>o.pdfPt)));
  const totalObj=T.objs.find(o=>o.t.startsWith('Total due'));
  ok(Math.abs(totalObj.pdfPt.x-72)<.01&&Math.abs(totalObj.pdfPt.y-691.8898)<.01,'pdfPt '+JSON.stringify(totalObj.pdfPt));
});
await t('page starts vector-eligible (no raster edits yet)',()=>{const p=T.P();ok(p.pdfBytes&&!p.rasterDirty&&!p.vectorBroken)});
await t('export "PDF (real editable text)" produces a valid, changed, still-complete PDF',async()=>{
  ids('#xf').value='pdfvec';ids('#xs').value='one';
  await T.doExport('pdfvec');
  ok(savedName&&savedName.endsWith('-editable.pdf'),'name '+savedName);
  const outPath='/tmp/webapp_exported.pdf';
  fs.writeFileSync(outPath,Buffer.from(await savedBlobLike.arrayBuffer()));
  const qpdf=execFileSync('qpdf',['--check',outPath]).toString();
  ok(/No syntax or stream encoding errors/.test(qpdf),qpdf);
  const text=execFileSync('pdftotext',['-layout',outPath,'-']).toString();
  ok(text.includes('Total due: $0.00 (settled)'),text);
  ok(text.includes('Line two, now revised')&&text.includes('Line three, unchanged'),'sibling line preserved:\n'+text);
  ok(text.includes('ref: REDACTED')&&!text.includes('4111 1111 1111 1111'),'card number actually removed:\n'+text);
  ok(text.includes('Customer: Nikhil Chary Sriramoju')&&text.includes('Invoice INV-2026-014'),'untouched lines preserved:\n'+text);
});
await t('erase tool marks the page vector-broken, so a later export falls back to a flattened page',async()=>{
  T.setTool('erase');await ids('#ov').fire('pointerdown',{clientX:5,clientY:5,pointerId:9});await ids('#ov').fire('pointermove',{clientX:20,clientY:20});await ids('#ov').fire('pointerup',{clientX:20,clientY:20});
  ok(T.P().vectorBroken===true,'vectorBroken should now be true');
  ids('#xf').value='pdfvec';await T.doExport('pdfvec');
  fs.writeFileSync('/tmp/webapp_exported2.pdf',Buffer.from(await savedBlobLike.arrayBuffer()));
  const q=execFileSync('qpdf',['--check','/tmp/webapp_exported2.pdf']).toString();ok(/No syntax or stream encoding errors/.test(q));
});
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})();
