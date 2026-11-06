import {dataURL} from './data.js';
export const $=id=>document.getElementById(id);
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function toast(message){const n=$('toast');n.textContent=message;n.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>n.hidden=true,4200);}
export function showError(id,e){const n=$(id);n.hidden=false;n.textContent=e.message||e;}
export function initDialogs(){document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));}
export function download(name,value,type='application/json'){const u=URL.createObjectURL(new Blob([value],{type}));const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
export async function compressPhoto(file,max=2400){if(!file.type.startsWith('image/'))throw Error('请选择图片文件。');if(file.size>30*1024*1024)throw Error('图片超过 30 MB，请先压缩。');const raw=await dataURL(file),img=await loadImage(raw);const ratio=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*ratio);c.height=Math.round(img.height*ratio);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.9);}
export function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('图片无法打开，请换成 JPG 或 PNG。'));img.src=src;});}
export function sourceOf(q){return [q.source,q.page&&'第 '+q.page+' 页',q.number&&'第 '+q.number+' 题'].filter(Boolean).join(' · ');}
export async function registerOffline(){if('serviceWorker'in navigator){try{await navigator.serviceWorker.register('./sw.js');}catch{}}}
export function formatDate(s){return s?new Date(s).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'}):'—';}
export function setBusy(button,busy,label){button.disabled=busy;if(label)button.textContent=label;}
