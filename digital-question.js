const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(v,fallback=0,min=-4000,max=4000)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
const color=(v,fallback='none')=>typeof v==='string'&&/^(#[0-9a-f]{3,8}|none|black|white|red|blue|green|yellow|orange|purple|gray)$/i.test(v)?v:fallback;
export function normalizeDiagram(value){
 if(!value)return null;if(typeof value!=='object'||!Array.isArray(value.elements))throw Error('电子题图形格式不正确。');let count=0;
 function element(e,depth=0){if(!e||typeof e!=='object'||depth>3||++count>180)throw Error('题图过于复杂，请拆成一题或简化图形。');const common={type:e.type,dx:number(e.dx),dy:number(e.dy),fill:color(e.fill),stroke:color(e.stroke,'#111111'),strokeWidth:number(e.strokeWidth,2,0,12)};
  if(e.type==='group'){if(!Array.isArray(e.children))throw Error('图形分组不正确。');return {...common,children:e.children.map(x=>element(x,depth+1))};}
  if(e.type==='text')return {...common,x:number(e.x),y:number(e.y),text:String(e.text??'').slice(0,160),fontSize:number(e.fontSize,24,8,96),anchor:['start','middle','end'].includes(e.anchor)?e.anchor:'start',fill:color(e.fill,'#111111'),stroke:'none'};
  if(e.type==='line')return {...common,x1:number(e.x1),y1:number(e.y1),x2:number(e.x2),y2:number(e.y2)};
  if(e.type==='rect')return {...common,x:number(e.x),y:number(e.y),width:number(e.width,40,0,4000),height:number(e.height,40,0,4000),rx:number(e.rx,0,0,300)};
  if(e.type==='circle')return {...common,cx:number(e.cx),cy:number(e.cy),r:number(e.r,20,0,2000)};
  if(e.type==='ellipse')return {...common,cx:number(e.cx),cy:number(e.cy),rx:number(e.rx,20,0,2000),ry:number(e.ry,20,0,2000)};
  if(e.type==='polygon'){if(!Array.isArray(e.points)||e.points.length>100)throw Error('图形轮廓不正确。');return {...common,points:e.points.map(p=>({x:number(p.x),y:number(p.y)}))};}
  if(e.type==='path'){if(typeof e.d!=='string'||e.d.length>12000||!e.d.trim()||!/^[MmLlHhVvCcSsQqTtAaZzEe0-9.,+\-\s]+$/.test(e.d))throw Error('图形路径不正确。');return {...common,d:e.d};}
  throw Error('这种图形暂不支持编辑，请改用线条、圆形或文字。');
 }
 return {afterParagraph:number(value.afterParagraph,99,0,40),width:number(value.width,800,100,2400),height:number(value.height,300,40,2400),elements:value.elements.map(e=>element(e))};
}
export function renderDiagram(value,{interactive=false,selected=-1}={}){
 const d=normalizeDiagram(value);if(!d||!d.elements.length)return '';
 function shape(e,path){let body='';const style=`fill="${esc(e.fill)}" stroke="${esc(e.stroke)}" stroke-width="${e.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;
  if(e.type==='group')body=e.children.map((child,i)=>shape(child,path+'.'+i)).join('');
  if(e.type==='text')body=`<text x="${e.x}" y="${e.y}" font-size="${e.fontSize}" text-anchor="${e.anchor}" fill="${esc(e.fill)}" font-family="Arial, PingFang SC, sans-serif">${esc(e.text)}</text>`;
  if(e.type==='line')body=`<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" ${style}/>`;
  if(e.type==='rect')body=`<rect x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" rx="${e.rx}" ${style}/>`;
  if(e.type==='circle')body=`<circle cx="${e.cx}" cy="${e.cy}" r="${e.r}" ${style}/>`;
  if(e.type==='ellipse')body=`<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" ${style}/>`;
  if(e.type==='polygon')body=`<polygon points="${e.points.map(p=>p.x+','+p.y).join(' ')}" ${style}/>`;
  if(e.type==='path')body=`<path d="${esc(e.d)}" ${style}/>`;
  return `<g transform="translate(${e.dx} ${e.dy})" ${interactive?`data-diagram-path="${path}" class="${String(selected)===path?'diagram-selected':''}"`:''}>${body}</g>`;
 }
 return `<svg class="question-diagram" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.width} ${d.height}" role="img" aria-label="电子题图形">${d.elements.map((e,i)=>shape(e,String(i))).join('')}</svg>`;
}
export function renderQuestionContent(q,context='parent'){
 const text=q.text?`<div class="${context==='print'?'q-line':'question-text'}">${esc(q.text).replace(/\n/g,'<br>')}</div>`:'';
 if(q.renderMode==='digital'){
  const paragraphs=String(q.text||'').split(/\n\s*\n/).filter(p=>p.trim()),position=Math.min(paragraphs.length,q.diagram?.afterParagraph??99),figure=renderDiagram(q.diagram);
  let content=position===0?figure:'';paragraphs.forEach((p,i)=>{content+=`<div class="${context==='print'?'q-line':'question-text'}">${esc(p).replace(/\n/g,'<br>')}</div>`;if(i+1===position)content+=figure;});return `<div class="digital-question">${content}</div>`;
 }
 return `${text}${q.image?`<img class="${context==='print'?'print-question-image':'question-image'}" src="${esc(q.image)}" alt="题目图片" ${context==='parent'?`data-action="image" data-id="${esc(q.id)}" loading="lazy"`:''}>`:''}`;
}
export function normalizeRecognition(value){
 if(!value||typeof value!=='object'||typeof value.text!=='string')throw Error('识别结果格式不正确，原图仍然保留。');
 const result={text:value.text.slice(0,12000).trim(),diagram:normalizeDiagram(value.diagram),issues:Array.isArray(value.issues)?value.issues.slice(0,20).map(x=>String(x).slice(0,300)):[],needsCrop:!!value.needsCrop,needsManualFigure:!!value.needsManualFigure};
 if(!result.needsCrop&&!result.text&&!result.diagram?.elements.length)throw Error('没有识别到印刷题目，请裁剪一题或重新拍摄。');return result;
}
