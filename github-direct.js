import {emptyState,applyOperation,childSnapshot,validateBackup} from './logic.js';
const encoder=new TextEncoder(),decoder=new TextDecoder();
const bytes64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const base64=b=>{let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s);};
const hex=b=>[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
export class DirectError extends Error{constructor(status,message){super(message);this.status=status;}}
export function parseRepository(value){const match=String(value).trim().replace(/^https:\/\/github\.com\//,'').replace(/\/$/,'').match(/^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9_.-]{1,100})$/);if(!match)throw Error('请填写“GitHub 用户名/仓库名”。');return {owner:match[1],repo:match[2]};}
export const directURL=c=>`github:${c.owner}/${c.repo}@${c.branch||'main'}`;
async function derive(password,salt){return crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes64(salt),iterations:210000},await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']),256);}
export async function createLock(password){if(typeof password!=='string'||password.length<8||password.length>128)throw Error('家长密码请设为 8–128 位。');const salt=base64(crypto.getRandomValues(new Uint8Array(16)));return {v:1,salt,hash:hex(await derive(password,salt))};}
export async function checkLock(password,lock){if(!lock?.salt||lock.v!==1||typeof lock.hash!=='string')return false;try{const actual=hex(await derive(password,lock.salt));let diff=actual.length^lock.hash.length;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^lock.hash.charCodeAt(i);return diff===0;}catch{return false;}}
export async function sealPair(config,password){if(!await checkLock(password,config.lock))throw Error('家长密码不正确。');const salt=base64(crypto.getRandomValues(new Uint8Array(16))),iv=crypto.getRandomValues(new Uint8Array(12)),key=await crypto.subtle.importKey('raw',await derive(password,salt),'AES-GCM',false,['encrypt']);const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(config)));return {kind:'github-pair',v:1,salt,iv:base64(iv),cipher:base64(new Uint8Array(cipher))};}
export async function unsealPair(value,password){if(!password){const e=Error('请家长输入配对密码。');e.code='PAIR_PASSWORD';throw e;}try{if(value.v!==1||value.cipher.length>16000)throw Error();const key=await crypto.subtle.importKey('raw',await derive(password,value.salt),'AES-GCM',false,['decrypt']);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes64(value.iv)},key,bytes64(value.cipher));const c=JSON.parse(decoder.decode(plain));parseRepository(c.owner+'/'+c.repo);if(c.kind!=='github'||!/^github_pat_[A-Za-z0-9_]+$/.test(c.token)||!await checkLock(password,c.lock))throw Error();c.url=directURL(c);return c;}catch{throw Error('配对密码不正确，或链接不完整。');}}
export class GitHubRepository{
  constructor(config,fetcher=(...args)=>fetch(...args)){this.config=config;this.fetcher=fetcher;this.root=`https://api.github.com/repos/${config.owner}/${config.repo}`;}
  async api(path,{method='GET',body,raw=false}={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
    try{const r=await this.fetcher(this.root+path,{method,headers:{Authorization:'Bearer '+this.config.token,Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,cache:'no-store'});
      if(r.status===404&&method==='GET')return null;
      if(!r.ok)throw new DirectError(r.status,r.status===401?'GitHub 密钥已失效，请家长更新。':r.status===403||r.status===429?'GitHub 拒绝了请求：请检查密钥权限、有效期，或稍后重试。':r.status===409||r.status===422?'云端已有更改，请重试同步。':r.status===404?'私有仓库不可写，请检查专用密钥权限。':'GitHub 暂时不可用，记录保留在本机。');
      return raw?r:await r.json();
    }finally{clearTimeout(timer);}
  }
  async checkPrivate(){const repo=await this.api('');if(!repo)throw new DirectError(404,'找不到私有仓库，或密钥没有访问权限。');if(!repo.private)throw new DirectError(400,'错题与照片请使用私有仓库，不能连接公开仓库。');return repo;}
  path(file){return '/contents/'+file+'?ref='+encodeURIComponent(this.config.branch||'main');}
  async read(){const file=await this.api(this.path('state.json'));if(!file){await this.checkPrivate();return {state:emptyState(),sha:null};}try{const raw=file.encoding==='base64'?decoder.decode(bytes64(file.content.replace(/\s/g,''))):await(await this.api(this.path('state.json'),{raw:true})).text();const state=JSON.parse(raw);validateBackup({app:'wenzhi-mistakes',version:1,state});if(!Array.isArray(state.applied)||!Number.isFinite(state.revision))throw Error();return {state,sha:file.sha};}catch(e){if(e.status)throw e;throw Error('云端记录格式不正确，请先保留本机备份，再联系家长处理。');}}
  async write(state,sha){const r=await this.api('/contents/state.json',{method:'PUT',body:{message:'Sync family notebook',branch:this.config.branch||'main',content:base64(encoder.encode(JSON.stringify(state))),...(sha?{sha}:{})}});if(!r?.commit?.sha)throw Error('GitHub 未确认保存，记录仍在本机。');return r;}
  async asset(ref){if(!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(ref))throw Error('图片编号不正确。');const r=await this.api(this.path('assets/'+ref),{raw:true});if(!r)throw new DirectError(404,'题图未找到，记录仍在本机。');return r.blob();}
  async upload(data){const m=typeof data==='string'&&data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);if(!m)throw Error('仅支持 JPG、PNG 或 WebP 照片。');const bytes=bytes64(m[2]);if(bytes.length>7*1024*1024)throw Error('照片太大，请缩小后重试。');const ref=hex(await crypto.subtle.digest('SHA-256',bytes))+'.'+({jpeg:'jpg',png:'png',webp:'webp'}[m[1]]);
    try{await this.api('/contents/assets/'+ref,{method:'PUT',body:{message:'Add notebook image',branch:this.config.branch||'main',content:m[2]}});}catch(e){if(e.status!==409&&e.status!==422)throw e;const existing=await this.api(this.path('assets/'+ref));if(!existing)throw e;}
    return {ref};
  }
}
const cleanMetadata=value=>{if(!value||typeof value!=='object')return;for(const [k,v]of Object.entries(value)){if(['image','originalImage','photo'].includes(k)&&v)throw Error('请先上传照片，再同步记录。');if(['imageRef','originalImageRef','photoRef'].includes(k)&&v&&!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(v))throw Error('图片编号不正确。');if(v&&typeof v==='object')cleanMetadata(v);}};
// This adapter provides UI protection, not a separate GitHub authorization role.
// The dedicated repository token has the same repository rights on either device.
export class DirectTransport{
  constructor(config,role,repository){this.config=config;this.role=role;this.repository=repository||new GitHubRepository(config);this.grant=null;if(role==='parent'){try{const saved=JSON.parse(sessionStorage.getItem('wenzhi-direct-unlock-'+config.url));if(saved?.expires>Date.now())this.grant=saved;}catch{}}}
  token(){return this.role==='child'?this.config.token:this.grant?.expires>Date.now()?this.grant.id:null;}
  async unlock(password){const {state}=await this.repository.read();const lock=state.settings.parentAuth||this.config.lock;if(!await checkLock(password,lock))throw new DirectError(401,'家长密码不正确。');this.config.lock=lock;this.grant={id:'parent-ui:'+crypto.randomUUID(),expires:Date.now()+12*3600000};if(this.role==='parent')sessionStorage.setItem('wenzhi-direct-unlock-'+this.config.url,JSON.stringify(this.grant));return this.grant.id;}
  async request(path,{method='GET',body,token=this.token()}={}){
    const parent=!!this.grant&&this.grant.expires>Date.now()&&token===this.grant.id;
    if(this.role==='parent'&&!parent)throw new DirectError(401,'请家长输入密码解锁同步。');
    const snapshot=s=>parent?s:childSnapshot(s);
    if(path==='/api/state'&&method==='GET')return snapshot((await this.repository.read()).state);
    if(path==='/api/assets'&&method==='POST')return this.repository.upload(body.data);
    if(path.startsWith('/api/assets/')&&method==='GET')return this.repository.asset(path.split('/').pop());
    if(path==='/api/operations'&&method==='POST'){
      const ops=body.operations;if(!Array.isArray(ops)||!ops.length||ops.length>100)throw Error('一次最多同步 100 项更改。');
      for(const op of ops){if(!parent&&op.type!=='submit')throw new DirectError(403,'请家长输入密码确认。');cleanMetadata(op);}
      for(let retry=0;retry<4;retry++){const {state,sha}=await this.repository.read();let next=state;for(const op of ops)next=applyOperation(next,op,parent?'parent':'child').state;
        try{if(next!==state)await this.repository.write(next,sha);return {ack:ops.map(o=>o.id),state:snapshot(next)};}catch(e){if(![409,422].includes(e.status)||retry===3)throw e;}
      }
    }throw new DirectError(404,'不支持这个同步操作。');
  }
}
