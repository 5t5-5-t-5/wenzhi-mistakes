import {DirectTransport,GitHubRepository,parseRepository,directURL,createLock,checkLock,sealPair,unsealPair} from './github-direct.js';
import {sha256,dataURL} from './data.js';
const KEY='wenzhi-connection-';
export function connection(role){try{return JSON.parse(localStorage.getItem(KEY+role)||'null');}catch{return null;}}
export function validEndpoint(value){const u=new URL(value);if(u.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error('同步地址需要以 https:// 开头。');if(u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('请填写接口根地址，例如 https://xxx.workers.dev');return u.origin;}
export async function childDatabaseName(){const c=connection('child');return c?'wenzhi-mistakes-child-'+(await sha256(c.url)).slice(0,16):'wenzhi-mistakes-v2';}
export class SyncClient{
  constructor(db,role,onChange=()=>{},onStatus=()=>{}){this.db=db;this.role=role;this.onChange=onChange;this.onStatus=onStatus;this.config=connection(role);this.assetCache=new Map();this.lastError='';this.busy=false;
    window.addEventListener('online',()=>this.sync());document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.sync();});this.interval=setInterval(()=>{if(!document.hidden)this.sync();},60000);
  }
  transport(){if(!this.direct||this.direct.config!==this.config)this.direct=new DirectTransport(this.config,this.role);return this.direct;}
  token(){if(this.config?.kind==='github')return this.transport().token();return this.role==='parent'?sessionStorage.getItem('wenzhi-parent-token-'+this.config?.url):this.config?.token;}
  async request(path,{method='GET',body,token=this.token(),blob=false}={}){
    if(!this.config)throw Error('请先连接家庭同步。');if(this.config.kind==='github')return this.transport().request(path,{method,body,token,blob});const r=await fetch(this.config.url+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000),cache:'no-store'});
    if(!r.ok){let message='同步接口暂时不可用。';try{message=(await r.json()).error||message;}catch{}const e=Error(message);e.status=r.status;throw e;}return blob?r.blob():r.json();
  }
  async login(url,password){if(this.config?.kind==='github'&&url===this.config.url)return this.transport().unlock(password);const endpoint=validEndpoint(url),previous=this.config;this.config={url:endpoint};this.assetCache.clear();try{const {token}=await this.request('/auth/parent',{method:'POST',body:{password},token:''});sessionStorage.setItem('wenzhi-parent-token-'+endpoint,token);if(this.role==='parent')localStorage.setItem(KEY+'parent',JSON.stringify(this.config));else this.config=previous;return token;}catch(e){this.config=previous;throw e;}}
  async configureGitHub(repository,token,password){
    const {owner,repo}=parseRepository(repository);if(!/^github_pat_[A-Za-z0-9_]+$/.test(token))throw Error('请使用只授权这个私有仓库的 Fine-grained GitHub 密钥。');
    const c={kind:'github',owner,repo,branch:'main',token};c.url=directURL(c);const store=new GitHubRepository(c);await store.checkPrivate();const {state}=await store.read();
    const newLock=!state.settings.parentAuth;c.lock=state.settings.parentAuth||await createLock(password);if(!await checkLock(password,c.lock))throw Error('家长密码不正确。');
    const transport=new DirectTransport(c,this.role,store);await transport.unlock(password);this.config=c;this.direct=transport;this.assetCache.clear();localStorage.setItem(KEY+this.role,JSON.stringify(c));return {lock:c.lock,newLock};
  }
  async pairLink(password){if(this.role!=='parent')throw Error('请在家长端配对。');let payload;
    if(this.config?.kind==='github'){if(!this.token())throw Error('请先输入家长密码连接同步。');payload=await sealPair(this.config,password);}
    else{const {token}=await this.request('/api/pair',{method:'POST',body:{}});payload={url:this.config.url,token};}
    const url=new URL('child.html',location.href);url.search='';url.hash='connect='+encodeURIComponent(JSON.stringify(payload));return url.href;
  }
  async acceptPair(link,password){let payload;try{const u=new URL(link);payload=JSON.parse(new URLSearchParams(u.hash.slice(1)).get('connect'));}catch{throw Error('配对链接不完整，请重新复制。');}
    let c;if(payload?.kind==='github-pair')c=await unsealPair(payload,password);
    else{if(!payload?.token||typeof payload.token!=='string'||payload.token.length>2000)throw Error('配对链接不正确。');c={url:validEndpoint(payload.url),token:payload.token};}
    const old=this.config;this.config=c;this.direct=null;try{await this.request('/api/state');localStorage.setItem(KEY+'child',JSON.stringify(c));return c;}catch(e){this.config=old;this.direct=null;throw e;}
  }
  async uploadImages(value){
    if(!value||typeof value!=='object')return value;const out=Array.isArray(value)?[]:{};
    for(const [k,v]of Object.entries(value)){
      if(k==='_localOrder')continue;
      if(['image','originalImage','photo'].includes(k)&&v){
        const digest=await sha256(v);let ref=this.assetCache.get(digest)||(await this.db.get('meta','upload:'+this.config.url+':'+digest))?.value;
        if(!ref){({ref}=await this.request('/api/assets',{method:'POST',body:{data:v}}));this.assetCache.set(digest,ref);await this.db.write('meta',{id:'upload:'+this.config.url+':'+digest,value:ref});}
        out[k+'Ref']=ref;out[k]='';
      }else if(['imageRef','originalImageRef','photoRef'].includes(k)&&out[k])continue;
      else out[k]=v&&typeof v==='object'?await this.uploadImages(v):v;
    }return out;
  }
  async hydrate(state,token){
    const current=await this.db.state(),byRef=new Map();
    for(const x of [...Object.values(current.questions),...Object.values(current.attempts)])for(const k of ['image','originalImage','photo'])if(x[k+'Ref']&&x[k])byRef.set(x[k+'Ref'],x[k]);
    for(const x of [...Object.values(state.questions),...Object.values(state.attempts)])for(const k of ['image','originalImage','photo']){
      const ref=x[k+'Ref'];if(!ref||x[k])continue;let image=byRef.get(ref)||(await this.db.get('meta','asset:'+this.config.url+':'+ref))?.value;
      if(!image){image=await dataURL(await this.request('/api/assets/'+ref,{blob:true,...(token?{token}:{})}));await this.db.write('meta',{id:'asset:'+this.config.url+':'+ref,value:image});}
      x[k]=image;
    }return state;
  }
  async status(){const queued=await this.db.all('outbox'),count=queued.length;const last=(await this.db.get('meta','lastSync'))?.value;this.onStatus({parentOps:queued.some(o=>o.type!=='submit'),configured:!!this.config,count,busy:this.busy,error:this.lastError,last,needsLogin:!!this.config&&!this.token()});}
  schedule(){this.status();clearTimeout(this.timer);this.timer=setTimeout(()=>this.sync(),700);}
  async sync({token}={}){
    if(this.busy)return false;if(!this.config){await this.status();return false;}if(!token&&!this.token()){await this.status();return false;}
    this.busy=true;this.lastError='';await this.status();
    try{
      let queued=(await this.db.all('outbox')).sort((a,b)=>(a._localOrder||0)-(b._localOrder||0));let remote;
      // Each batch is atomic on the server. A failed batch stays intact on this device.
      while(queued.length){const batch=queued.slice(0,25),prepared=[];for(const op of batch)prepared.push(await this.uploadImages(op));const result=await this.request('/api/operations',{method:'POST',body:{operations:prepared},...(token?{token}:{})});remote=await this.hydrate(result.state,token);await this.db.replace(remote,result.ack);queued=(await this.db.all('outbox')).sort((a,b)=>(a._localOrder||0)-(b._localOrder||0));}
      if(!remote)remote=await this.hydrate(await this.request('/api/state',token?{token}:{}),token);
      const state=await this.db.replace(remote);await this.db.write('meta',{id:'lastSync',value:new Date().toISOString()});this.onChange(state);return true;
    }catch(e){this.lastError=e.name==='TimeoutError'?'连接超时，记录保留在本机。':e.name==='TypeError'?'网络未连接，记录保留在本机。':e.message||'网络未连接，记录保留在本机。';return false;}
    finally{this.busy=false;await this.status();}
  }
}
