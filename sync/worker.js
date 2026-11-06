import {emptyState,applyOperation,childSnapshot} from '../logic.js';
const enc=new TextEncoder();
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function hash(value){return hex(await crypto.subtle.digest('SHA-256',enc.encode(value)));}
const b64url=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function key(secret){return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function sign(payload,secret){const data=b64url(enc.encode(JSON.stringify(payload)));return data+'.'+b64url(await crypto.subtle.sign('HMAC',await key(secret),enc.encode(data)));}
export async function verify(token,secret){try{const [data,sig,extra]=token.split('.');if(extra||!await crypto.subtle.verify('HMAC',await key(secret),bytes(sig),enc.encode(data)))return null;const p=JSON.parse(new TextDecoder().decode(bytes(data)));return p.exp>Date.now()&&['parent','child'].includes(p.role)?p:null;}catch{return null;}}
export class HTTPError extends Error{constructor(status,message){super(message);this.status=status;}}
async function readJSON(req,limit=12*1024*1024){const reader=req.body?.getReader();if(!reader)throw new HTTPError(400,'缺少数据。');let n=0,parts=[];while(true){const {value,done}=await reader.read();if(done)break;n+=value.length;if(n>limit){await reader.cancel();throw new HTTPError(413,'数据太大，请分批上传。');}parts.push(value);}const data=new Uint8Array(n);let at=0;for(const p of parts){data.set(p,at);at+=p.length;}try{return JSON.parse(new TextDecoder().decode(data));}catch{throw new HTTPError(400,'数据格式不正确。');}}
function binaryBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
export class GitHubStore{
  constructor(env){this.env=env;this.base=`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/`;}
  async api(path,method='GET',body,raw=false){
    const r=await fetch(this.base+path+(method==='GET'?'?ref='+encodeURIComponent(this.env.GITHUB_BRANCH||'main'):''),{method,headers:{Authorization:`Bearer ${this.env.GITHUB_TOKEN}`,Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'wenzhi-mistakes-sync','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    if(r.status===404){if(method==='GET')return null;throw new HTTPError(404,'数据仓库不可写，请检查服务器权限。');}if(r.status===409||r.status===422)throw new HTTPError(409,'云端已变化，请重试同步。');if(!r.ok)throw new HTTPError(502,r.status===403||r.status===429?'GitHub 暂时限制请求，请稍后重试。':'GitHub 数据服务暂时不可用。');return raw?r:await r.json();
  }
  async read(){const file=await this.api('state.json');if(!file)return {state:emptyState(),sha:null};let value;
    if(file.encoding==='base64')value=new TextDecoder().decode(bytes(file.content.replace(/\s/g,'')));else value=await (await this.api('state.json','GET',undefined,true)).text();
    return {state:JSON.parse(value),sha:file.sha};
  }
  async write(state,sha){return this.api('state.json','PUT',{message:'Sync family notebook',branch:this.env.GITHUB_BRANCH||'main',content:binaryBase64(enc.encode(JSON.stringify(state))),...(sha?{sha}:{})});}
  async asset(ref){const r=await this.api('assets/'+ref,'GET',undefined,true);return r?new Uint8Array(await r.arrayBuffer()):null;}
  async putAsset(ref,data){try{await this.api('assets/'+ref,'PUT',{message:'Add notebook image',branch:this.env.GITHUB_BRANCH||'main',content:binaryBase64(data)});}catch(e){if(e.status!==409)throw e;const existing=await this.asset(ref);if(!existing)throw e;}}
}
const goodRef=s=>typeof s==='string'&&/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(s);
function checkAssets(value){if(!value||typeof value!=='object')return;for(const [k,v]of Object.entries(value)){if(['image','originalImage','photo'].includes(k)&&v)throw new HTTPError(400,'请先上传照片，再同步记录。');if(['imageRef','originalImageRef','photoRef'].includes(k)&&v&&!goodRef(v))throw new HTTPError(400,'图片编号不正确。');if(v&&typeof v==='object')checkAssets(v);}}
export function createHandler(storeFactory=env=>new GitHubStore(env)){
  return async function handle(req,env){
    const origin=req.headers.get('Origin'),allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
    const headers={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    if(origin&&allowed.includes(origin)){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='Authorization,Content-Type';headers['Access-Control-Allow-Methods']='GET,POST,OPTIONS';}
    const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers});
    try{
      if(origin&&!allowed.includes(origin))throw new HTTPError(403,'这个网页尚未获得同步许可。');
      if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
      if(!env.SESSION_SECRET||!env.PARENT_PASSWORD_HASH||!env.GITHUB_TOKEN)throw new HTTPError(503,'家庭同步尚未配置完成。');
      const path=new URL(req.url).pathname;
      if(path==='/health'&&req.method==='GET')return json({ready:true,version:1});
      if(path==='/auth/parent'&&req.method==='POST'){
        const ip=await hash(req.headers.get('CF-Connecting-IP')||'local');
        if(env.AUTH_GATE){const gate=env.AUTH_GATE.get(env.AUTH_GATE.idFromName('family'));const r=await gate.fetch('https://gate/limit',{method:'POST',body:JSON.stringify({ip})});if(!r.ok)throw new HTTPError(429,'尝试次数较多，请 15 分钟后再试。');}
        const p=await readJSON(req,4096),actual=await hash(String(p.password||''));
        const a=enc.encode(actual),b=enc.encode(env.PARENT_PASSWORD_HASH.toLowerCase());let diff=a.length^b.length;for(let i=0;i<a.length;i++)diff|=a[i]^(b[i]||0);
        if(diff)throw new HTTPError(401,'家长密码不正确。');
        return json({token:await sign({role:'parent',exp:Date.now()+12*3600000},env.SESSION_SECRET)});
      }
      const user=await verify((req.headers.get('Authorization')||'').replace(/^Bearer /,''),env.SESSION_SECRET);
      if(!user)throw new HTTPError(401,'连接已过期，请家长重新登录或配对。');
      const store=storeFactory(env);
      if(path==='/api/pair'&&req.method==='POST'){
        if(user.role!=='parent')throw new HTTPError(403,'只有家长可以生成配对链接。');
        return json({token:await sign({role:'child',device:crypto.randomUUID(),exp:Date.now()+90*86400000},env.SESSION_SECRET),expiresInDays:90});
      }
      if(path==='/api/state'&&req.method==='GET'){
        const {state}=await store.read();return json(user.role==='parent'?state:childSnapshot(state));
      }
      if(path==='/api/operations'&&req.method==='POST'){
        const {operations}=await readJSON(req);if(!Array.isArray(operations)||!operations.length||operations.length>100)throw new HTTPError(400,'一次最多同步 100 项更改。');
        for(const op of operations){if(user.role!=='parent'&&op.type!=='submit')throw new HTTPError(403,'只有家长可以修改题目和确认结果。');checkAssets(op);}
        for(let retry=0;retry<4;retry++){
          const {state,sha}=await store.read();let next=state;
          try{for(const op of operations)next=applyOperation(next,op,user.role).state;}catch(e){throw new HTTPError(409,e.message);}
          try{if(next!==state)await store.write(next,sha);return json({ack:operations.map(x=>x.id),state:user.role==='parent'?next:childSnapshot(next)});}catch(e){if(e.status!==409||retry===3)throw e;}
        }
      }
      if(path==='/api/assets'&&req.method==='POST'){
        const {data}=await readJSON(req);const m=typeof data==='string'&&data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);if(!m)throw new HTTPError(400,'仅支持 JPG、PNG 或 WebP 图片。');const raw=bytes(m[2]);if(raw.length>7*1024*1024)throw new HTTPError(413,'照片太大，请先缩小。');
        const valid=m[1]==='jpeg'?raw[0]===255&&raw[1]===216:m[1]==='png'?raw[0]===137&&raw[1]===80:raw[0]===82&&raw[8]===87;
        if(!valid)throw new HTTPError(400,'照片内容与格式不一致。');
        const ref=hex(await crypto.subtle.digest('SHA-256',raw))+'.'+({jpeg:'jpg',png:'png',webp:'webp'}[m[1]]);await store.putAsset(ref,raw);return json({ref});
      }
      if(path.startsWith('/api/assets/')&&req.method==='GET'){
        const ref=path.split('/').pop();if(!goodRef(ref))throw new HTTPError(400,'图片编号不正确。');const {state}=await store.read();
        const allowed=user.role==='parent'?Object.values(state.questions).some(q=>q.imageRef===ref||q.originalImageRef===ref)||Object.values(state.attempts).some(a=>a.photoRef===ref):Object.values(state.questions).some(q=>!q.deletedAt&&q.status!=='mastered'&&q.imageRef===ref);
        if(!allowed)throw new HTTPError(403,'无权打开这张图片。');const data=await store.asset(ref);if(!data)throw new HTTPError(404,'图片不存在。');return new Response(data,{headers:{...headers,'Content-Type':ref.endsWith('.jpg')?'image/jpeg':ref.endsWith('.png')?'image/png':'image/webp'}});
      }
      throw new HTTPError(404,'接口不存在。');
    }catch(e){return json({error:e.status?e.message:'同步暂未完成，请稍后重试。'},e.status||500);}
  };
}
export default {fetch:createHandler()};
export class AuthGate{
  constructor(ctx){this.ctx=ctx;}
  async fetch(req){const {ip}=await req.json();let allowed;
    await this.ctx.storage.transaction(async t=>{const now=Date.now(),entry=await t.get(ip);const next=!entry||entry.until<now?{count:1,until:now+15*60000}:{...entry,count:entry.count+1};allowed=next.count<=10;await t.put(ip,next);});
    if(!await this.ctx.storage.getAlarm())await this.ctx.storage.setAlarm(Date.now()+15*60000);
    return new Response(null,{status:allowed?204:429});
  }
  async alarm(){const all=await this.ctx.storage.list(),expired=[];let next=Infinity;for(const [id,entry]of all){if(entry.until<=Date.now())expired.push(id);else next=Math.min(next,entry.until);}if(expired.length)await this.ctx.storage.delete(expired);if(Number.isFinite(next))await this.ctx.storage.setAlarm(next);}
}
