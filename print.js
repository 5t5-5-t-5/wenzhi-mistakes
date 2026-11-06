import {$,esc,toast} from './ui.js';
let active;
export function initPrint(){
  $('printTitle').oninput=render;$('printSpace').onchange=render;
  $('startPrint').onclick=async()=>{await Promise.all([...$('printPaper').querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));window.print();};
}
export function openPrint(q,name='问之'){
  if(!q)return toast('请先选择一道题。');active={q,name};$('printTitle').value='今天的小任务';$('printCount').textContent='只打印当前这一题，打印不代表已完成。';render();$('printDialog').showModal();
}
function render(){if(!active)return;const {q,name}=active;
  $('printPaper').className='paper question-only';
  $('printPaper').innerHTML=`<div class="paper-topline"><span>${esc(name)}的小任务</span><span>日期：____ 月 ____ 日</span></div><h1>${esc($('printTitle').value||'今天的小任务')}</h1><p class="paper-subtitle">认真看一看，慢慢想一想。</p><section class="paper-question"><div class="q-line">${esc(q.text).replace(/\n/g,'<br>')}</div>${q.image?`<img style="max-height:${Math.max(35,175-(Number($('printSpace').value)||60)-q.text.split('\n').reduce((n,l)=>n+Math.max(1,Math.ceil(l.length/36)),0)*10)}mm" class="print-question-image" src="${esc(q.image)}" alt="题目图片">`:''}<div class="work-space" style="height:${Number($('printSpace').value)||60}mm"></div></section><div class="paper-end">做完这一题，就很棒。</div>`;
}
