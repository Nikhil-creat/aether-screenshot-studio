const fs=require('fs');
const {PDFDocument,PDFName,PDFRawStream,decodePDFRawStream,PDFArray,rgb,StandardFonts}=require('pdf-lib');
const core=fs.readFileSync('core.js','utf8').match(/\/\/<core>([\s\S]*?)\/\/<\/core>/)[1];
const {pdfStripText,pickPdfFont,stdFontName}=new Function(core+'\nreturn {pdfStripText,pickPdfFont,stdFontName}')();

(async()=>{
  const bytes=fs.readFileSync('/tmp/t1.pdf');
  const doc=await PDFDocument.load(bytes);
  const page=doc.getPage(0);
  const node=page.node;
  let contentsEntry=node.get(PDFName.of('Contents'));
  const ctx=doc.context;
  const streamRefs=contentsEntry instanceof PDFArray?contentsEntry.asArray():[contentsEntry];
  console.log('num content streams:',streamRefs.length);
  // decode & concat
  const decoded=streamRefs.map(ref=>{const raw=ctx.lookup(ref,PDFRawStream);return decodePDFRawStream(raw).decode()});
  const text=decoded.map(u=>Buffer.from(u).toString('latin1')).join('\n');
  console.log('--- original stream head ---');console.log(text.slice(0,250));

  // strip the "Total due" line at its PDF point (72, 691.8898) — same as our earlier manual check
  const r=pdfStripText(text,[{x:72,y:691.8898}]);
  console.log('matched ops:',r.matched);
  const newBytes=Buffer.from(r.out,'latin1');
  const newStream=ctx.flateStream(newBytes,{});
  const newRef=ctx.register(newStream);
  node.set(PDFName.of('Contents'),newRef); // single stream now

  // draw replacement text with a matched font, same size/position/colour
  const font=await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Total due: $0.00 (settled)',{x:72,y:691.8898-2.2 /*baseline nudge for parity, see note*/,size:12,font,color:rgb(0,0,0)});

  const out=await doc.save();
  fs.writeFileSync('/tmp/t1.edited.pdf',out);
  console.log('saved', out.length,'bytes');
})();
