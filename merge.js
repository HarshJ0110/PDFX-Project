const PDFMerger = require('pdf-merger-js');
var merger = new PDFMerger();

megrePdfs = async (list) => {
  await merger.reset();
  for(let i = 0;i < list.length; i++){
    await merger.add(list[i])
  }
  
  let d = new Date().getTime();
  await merger.save(`public/${d}.pdf`);
  //save under given name and reset the internal document
   return d;
  // Export the merged PDF as a nodejs Buffer
  // const mergedPdfBuffer = await merger.saveAsBuffer();
  // fs.writeSync('merged.pdf', mergedPdfBuffer);
} 

module.exports = megrePdfs  


