import {emptyState,applyOperation,validateBackup,operation} from './logic.js';
export * from './logic.js';
export class NotebookDB{
  async open(name='wenzhi-mistakes-v2'){
    this.db=await new Promise((resolve,reject)=>{
      const r=indexedDB.open(name,1);
      r.onupgradeneeded=()=>{for(const n of ['state','meta','outbox'])r.result.createObjectStore(n,{keyPath:'id'});};
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('请关闭其他打开的小册页面，再刷新。'));
    });this.db.onversionchange=()=>this.db.close();return this;
  }
  async get(store,id){return new Promise((resolve,reject)=>{const r=this.db.transaction(store).objectStore(store).get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async all(store){return new Promise((resolve,reject)=>{const r=this.db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async write(store,value){return new Promise((resolve,reject)=>{const t=this.db.transaction(store,'readwrite');t.objectStore(store).put(value);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}
  async remove(store,id){return new Promise((resolve,reject)=>{const t=this.db.transaction(store,'readwrite');t.objectStore(store).delete(id);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}
  async state(){return (await this.get('state','main'))?.value||emptyState();}
  async commit(op){
    return new Promise((resolve,reject)=>{
      const tx=this.db.transaction(['state','outbox'],'readwrite'),store=tx.objectStore('state');let next;
      const r=store.get('main');r.onsuccess=()=>{try{next=applyOperation(r.result?.value||emptyState(),op).state;store.put({id:'main',value:next});tx.objectStore('outbox').put({...op,_localOrder:next.revision});}catch(e){tx.abort();reject(e);}};
      tx.oncomplete=()=>resolve(next);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('保存未完成。'));
    });
  }
  async replace(state,ack=[]){
    return new Promise((resolve,reject)=>{
      const tx=this.db.transaction(['state','outbox'],'readwrite'),out=tx.objectStore('outbox');let merged=state;
      const r=out.getAll();r.onsuccess=()=>{try{
        for(const op of r.result.filter(o=>!ack.includes(o.id)).sort((a,b)=>(a._localOrder||0)-(b._localOrder||0)))merged=applyOperation(merged,op).state;
        tx.objectStore('state').put({id:'main',value:merged});ack.forEach(id=>out.delete(id));
      }catch(e){tx.abort();reject(Error('同步冲突：'+e.message));}};
      tx.oncomplete=()=>resolve(merged);tx.onerror=()=>reject(tx.error);
    });
  }
  async importBackup(value){
    const backup=validateBackup(value),before=await this.state();
    const count=Object.values(backup.state.questions).filter(q=>!before.questions[q.id]||Date.parse(q.updatedAt)>Date.parse(before.questions[q.id].updatedAt)).length;
    const state=await this.commit(operation('importBackup',{backup}));return {count,state};
  }
  async discardOutbox(){return new Promise((resolve,reject)=>{const t=this.db.transaction('outbox','readwrite');t.objectStore('outbox').clear();t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}

}
export async function sha256(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function dataURL(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});}
