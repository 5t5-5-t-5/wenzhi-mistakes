import {$,loadImage,compressPhoto,toast} from './ui.js';
export class PhotoEditor{
  constructor(onSave){
    this.onSave=onSave;this.canvas=$('imageCanvas');this.ctx=this.canvas.getContext('2d');this.tool='crop';this.undo=[];
    $('cropTool').onclick=()=>this.setTool('crop');$('maskTool').onclick=()=>this.setTool('mask');
    $('undoImage').onclick=()=>{if(this.undo.length)this.draw(this.undo.pop());};
    $('resetImage').onclick=async()=>{this.remember();await this.draw(this.original);};
    $('useImage').onclick=()=>{this.onSave({image:this.canvas.toDataURL('image/jpeg',.94),originalImage:this.original});$('imageDialog').close();};
    $('pdfPrev').onclick=()=>this.pdfPage(this.page-1);$('pdfNext').onclick=()=>this.pdfPage(this.page+1);
    this.canvas.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();this.start=this.point(e);this.canvas.setPointerCapture(e.pointerId);};
    this.canvas.onpointermove=e=>{if(!this.start)return;this.selection(this.start,this.point(e));};
    this.canvas.onpointerup=e=>this.finish(e);this.canvas.onpointercancel=()=>{this.start=null;$('imageSelection').hidden=true;};
  }
  setTool(tool){this.tool=tool;for(const [id,value]of [['cropTool','crop'],['maskTool','mask']]){$(id).classList.toggle('active',tool===value);$(id).setAttribute('aria-pressed',String(tool===value));}$('editorHint').textContent=tool==='crop'?'拖一个框，松开后保留框里的题目。可以撤销。':'拖一个白框，遮住手写答案或批改痕迹。';}
  point(e){const r=this.canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(this.canvas.width,(e.clientX-r.left)*this.canvas.width/r.width)),y:Math.max(0,Math.min(this.canvas.height,(e.clientY-r.top)*this.canvas.height/r.height))};}
  selection(a,b){const s=$('imageSelection'),ratio=this.canvas.clientWidth/this.canvas.width;s.hidden=false;s.className=this.tool==='mask'?'mask':'';Object.assign(s.style,{left:Math.min(a.x,b.x)*ratio+'px',top:Math.min(a.y,b.y)*ratio+'px',width:Math.abs(a.x-b.x)*ratio+'px',height:Math.abs(a.y-b.y)*ratio+'px'});}
  remember(){this.undo.push(this.canvas.toDataURL('image/png'));if(this.undo.length>12)this.undo.shift();}
  async draw(src){const img=await loadImage(src);this.canvas.width=img.width;this.canvas.height=img.height;this.ctx.drawImage(img,0,0);}
  finish(e){if(!this.start)return;const a=this.start,b=this.point(e);this.start=null;$('imageSelection').hidden=true;const x=Math.floor(Math.min(a.x,b.x)),y=Math.floor(Math.min(a.y,b.y)),w=Math.floor(Math.abs(a.x-b.x)),h=Math.floor(Math.abs(a.y-b.y));if(w<8||h<8)return;this.remember();
    if(this.tool==='mask'){this.ctx.fillStyle='#fff';this.ctx.fillRect(x,y,w,h);}else{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(this.canvas,x,y,w,h,0,0,w,h);this.canvas.width=w;this.canvas.height=h;this.ctx.drawImage(c,0,0);}
  }
  async open(original,current){this.original=original;this.undo=[];this.setTool('crop');$('pdfControls').hidden=!this.pdf;await this.draw(current||original);if(!$('imageDialog').open)$('imageDialog').showModal();}
  async file(file){
    if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
      if(file.size>40*1024*1024)throw Error('PDF 超过 40 MB，请先拆成几份。');
      toast('正在打开 PDF，请稍等……');const pdfjs=await import('./vendor/pdfjs/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
      this.pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:new URL('./vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,wasmUrl:new URL('./vendor/pdfjs/wasm/',import.meta.url).href,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href,isEvalSupported:false}).promise;
      await this.pdfPage(1);
    }else{this.pdf=null;await this.open(await compressPhoto(file));}
  }
  async pdfPage(number){if(!this.pdf||number<1||number>this.pdf.numPages)return;
    try{$('pdfPrev').disabled=$('pdfNext').disabled=true;const p=await this.pdf.getPage(number);const base=p.getViewport({scale:1});const viewport=p.getViewport({scale:Math.min(3,2400/Math.max(base.width,base.height))});const c=document.createElement('canvas');c.width=Math.round(viewport.width);c.height=Math.round(viewport.height);await p.render({canvasContext:c.getContext('2d'),viewport,background:'white'}).promise;this.page=number;await this.open(c.toDataURL('image/jpeg',.94));$('pdfPageLabel').textContent=`第 ${number} / ${this.pdf.numPages} 页`;}
    catch(e){toast('这一页无法打开：'+e.message);}
    finally{$('pdfPrev').disabled=this.page===1;$('pdfNext').disabled=this.page===this.pdf.numPages;}
  }
  async repeatPage(){if(this.original)await this.open(this.original);}
}
