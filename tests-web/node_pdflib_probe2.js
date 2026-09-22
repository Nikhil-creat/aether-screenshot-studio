const fs=require('fs');
const {PDFDocument,PDFName,PDFRawStream,decodePDFRawStream,PDFArray,rgb,StandardFonts}=require('pdf-lib');
const core=fs.readFileSync('core.js','utf8').match(/\/\/<core>([\s\S]*?)\/\/<\/core>/)[1];
const {pdfStripText,pickPdfFont,stdFontName}=new Function(core+'\nreturn {pdfStripText,pickPdfFont,stdFontName}')();
const STD={Helvetica:'Helvetica','Helvetica-Bold':'HelveticaBold','Helvetica-Oblique':'HelveticaOblique','Helvetica-BoldOblique':'HelveticaBoldOblique',
  'Times-Roman':'TimesRoman','Times-Bold':'TimesRomanBold','Times-Italic':'TimesRomanItalic','Times-BoldItalic':'TimesRomanBoldItalic',
  Courier:'Courier','Courier-Bold':'CourierBold','Courier-Oblique':'CourierOblique','Courier-BoldOblique':'CourierBoldOblique'};

(async()=>{
  const bytes=fs.readFileSync('/tmp/t1.pdf');
  const doc=await PDFDocument.load(bytes);
  const page=doc.getPage(0);
  const node=page.node,ctx=doc.context;
  const ref=node.get(PDFName.of('Contents'));
  const raw=ctx.lookup(ref,PDFRawStream);
  const text=Buffer.from(decodePDFRawStream(raw).decode()).toString('latin1');

  // Edit 3 things: bold/italic "Paid (draft)" run, the 3-line paragraph's middle line, the courier ref line.
  const edits=[
    {pt:{x:300,y:751.8898},text:'FINAL (signed)',css:'Georgia,serif',weight:700,italic:true,size:14,color:[0.1,0.5,0.2]},
    {pt:{x:72,y:637.4898},text:'Line two, now revised',css:'system-ui,sans-serif',weight:400,italic:false,size:12,color:[0,0,0]},
    {pt:{x:72,y:581.8898},text:'ref: REDACTED',css:'ui-monospace,monospace',weight:400,italic:false,size:10,color:[0,0,0]},
  ];
  const r=pdfStripText(text,edits.map(e=>e.pt));
  if(r.matched!==3)throw new Error('expected 3 matched, got '+r.matched);
  const newStream=ctx.flateStream(Buffer.from(r.out,'latin1'),{});
  node.set(PDFName.of('Contents'),ctx.register(newStream));

  const fcache={};
  for(const e of edits){
    const picked=pickPdfFont(e.css,e.weight,e.italic);
    const stdName=picked.kind==='web'?stdFontName('Helvetica',e.weight>=600,e.italic):picked.name;
    const font=fcache[stdName]||(fcache[stdName]=await doc.embedFont(StandardFonts[STD[stdName]]));
    page.drawText(e.text,{x:e.pt.x,y:e.pt.y,size:e.size,font,color:rgb(...e.color)});
  }
  fs.writeFileSync('/tmp/t2.edited.pdf',await doc.save());
  console.log('matched',r.matched,'saved ok');
})();
