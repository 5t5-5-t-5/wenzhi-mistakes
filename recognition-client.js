import {normalizeRecognition} from './digital-question.js';
const enc=new TextEncoder(),dec=new TextDecoder();
function base64(text){let s='';for(const b of enc.encode(text))s+=String.fromCharCode(b);return btoa(s);}
export class RecognitionClient{
 constructor(sync){this.sync=sync;}
 repository(){if(this.sync?.config?.kind!=='github')throw Error('请先在“同步设置”连接 GitHub，才能提交AI识别。');if(this.sync.role!=='parent'||!this.sync.token())throw Error('请先在“同步设置”输入家长密码解锁。');return this.sync.transport().repository;}
 async readJSON(path){const repo=this.repository(),file=await repo.api(repo.path(path));if(!file)return null;let text;if(file.encoding==='base64')text=dec.decode(Uint8Array.from(atob(file.content.replace(/\s/g,'')),c=>c.charCodeAt(0)));else text=await(await repo.api(repo.path(path),{raw:true})).text();return JSON.parse(text);}
 async service(){const service=await this.readJSON('recognition/service.json');if(service?.enabled!==true)throw Error('AI识别后台尚未开通，当前可先直接编辑电子题。');return service;}
 async prepare(image,subject){await this.service();const repo=this.repository();await repo.checkPrivate();const {ref}=await repo.upload(image);return {id:crypto.randomUUID(),imageRef:ref,subject,createdAt:new Date().toISOString(),version:1};}
 async submit(job){const repo=this.repository(),path='recognition/requests/'+job.id+'.json';try{const r=await repo.api('/contents/'+path,{method:'PUT',body:{message:'Request clean digital question',branch:repo.config.branch||'main',content:base64(JSON.stringify(job))}});if(!r?.commit?.sha)throw Error('GitHub尚未确认识别请求。');}catch(e){const existing=await this.readJSON(path).catch(()=>null);if(existing?.id!==job.id||existing?.imageRef!==job.imageRef)throw e;}return job;}
 async result(id){if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error('识别任务编号不正确。');const value=await this.readJSON('recognition/results/'+id+'.json');if(!value)return null;if(value.status==='failed'){const e=Error(String(value.error||'识别没有完成，原图仍然保留。'));e.permanent=true;throw e;}if(value.status!=='ready')return null;return normalizeRecognition(value.result);}
}
