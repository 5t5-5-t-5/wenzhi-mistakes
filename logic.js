export const SUBJECTS = [
  { id:'math', name:'数学', short:'数', symbol:'1 + 2', color:'#cb6b43', light:'#fbebdf', edition:'北师大版' },
  { id:'chinese', name:'语文', short:'语', symbol:'字 · 词', color:'#4d7862', light:'#e6efe6', edition:'统编版 · 人民教育出版社' },
  { id:'english', name:'英语', short:'英', symbol:'A b c', color:'#5b73aa', light:'#e9edf8', edition:'沪教版 · 深圳用' }
];
export const STATUS = { todo:{label:'待巩固'}, pending:{label:'待确认'}, practicing:{label:'再练中'}, mastered:{label:'已掌握'} };
export const uid = () => crypto.randomUUID();
export function defaults() {
  return {id:'main',version:0,name:'问之',grade:'一年级',term:'上册',assignment:{subject:null,unitId:null},
    editions:Object.fromEntries(SUBJECTS.map(s=>[s.id,s.edition])),
    units:SUBJECTS.flatMap(s=>[...Array(8)].map((_,i)=>({id:s.id+'-unit-'+(i+1),subject:s.id,name:'第'+'一二三四五六七八'[i]+'单元',order:i})))
  };
}
export function emptyState(){return {schema:1,revision:0,settings:defaults(),questions:{},attempts:{},applied:[]};}
const goodId=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(s)&&!Object.hasOwn(Object.prototype,s);
const cut = (value,n=12000)=>String(value??'').slice(0,n);
export function questionOf(q){
  if(q?.id&&!goodId(q.id))throw Error('题目编号不正确。');
  if(!q||!SUBJECTS.some(s=>s.id===q.subject))throw Error('请选择科目。');
  return {id:q.id||uid(),subject:q.subject,unitId:cut(q.unitId,100),title:cut(q.title,120).trim(),
    text:cut(q.text).trim(),answer:cut(q.answer),analysis:cut(q.analysis),tags:cut(q.tags,150),reason:cut(q.reason,100),
    sourceType:['book','test','practice','other'].includes(q.sourceType)?q.sourceType:'book',
    source:cut(q.source,180),page:cut(q.page,40),number:cut(q.number,40),
    image:q.image||'',originalImage:q.originalImage||'',imageRef:q.imageRef||'',originalImageRef:q.originalImageRef||'',
    imageEdits:q.imageEdits||null,status:STATUS[q.status]?q.status:'todo',version:q.version||0,statusVersion:q.statusVersion||0,
    createdAt:q.createdAt||new Date().toISOString(),updatedAt:q.updatedAt||new Date().toISOString(),
    lastPracticedAt:q.lastPracticedAt||null,deletedAt:q.deletedAt||null};
}
export function titleOf(q){return q.title||q.text.split('\n')[0].slice(0,40)||'照片题目';}
export function eligible(questions,subject,unitId){
  return questions.filter(q=>!q.deletedAt&&q.status!=='mastered'&&q.status!=='pending'&&
    (!subject||q.subject===subject)&&(!unitId||q.unitId===unitId));
}
export function chooseQuestion(questions,{subject=null,unitId=null,lastId=null}={}){
  return eligible(questions,subject,unitId).sort((a,b)=>
    Number(a.id===lastId)-Number(b.id===lastId)||
    (Date.parse(a.lastPracticedAt)||0)-(Date.parse(b.lastPracticedAt)||0)||
    Date.parse(a.createdAt)-Date.parse(b.createdAt))[0]||null;
}
export function normalizeSettings(s){
  const d=defaults();const seen=new Set();
  if(!s||!Array.isArray(s.units)||s.units.length>200)throw Error('单元设置不正确。');
  for(const u of s.units){
    if(!u||!SUBJECTS.some(x=>x.id===u.subject)||!goodId(u.id)||seen.has(u.id)||!String(u.name||'').trim())throw Error('单元名称或编号不正确。');
    seen.add(u.id);
  }
  return {...d,...s,id:'main',name:cut(s.name||d.name,20),grade:cut(s.grade||d.grade,30),term:['上册','下册'].includes(s.term)?s.term:'上册',
    units:s.units.map((u,i)=>({id:cut(u.id,100),subject:u.subject,name:cut(u.name,80),order:Number.isFinite(u.order)?u.order:i})),
    assignment:{subject:SUBJECTS.some(x=>x.id===s.assignment?.subject)?s.assignment.subject:null,unitId:s.units.some(u=>u.id===s.assignment?.unitId&&(!s.assignment?.subject||u.subject===s.assignment.subject))?s.assignment.unitId:null}};
}
export function operation(type,payload){return {id:uid(),type,payload,at:new Date().toISOString()};}
export function applyOperation(input,op,role='parent'){
  if(!op||!goodId(op.id)||!op.payload)throw Error('操作格式不正确。');
  if(input.applied.includes(op.id))return {state:input,duplicate:true};
  const state=structuredClone(input),p=op.payload;
  if(role!=='parent'&&op.type!=='submit')throw Error('需要家长确认。');
  if(op.type==='save'){
    const q=questionOf(p.question),old=state.questions[q.id];
    if(old&&(p.baseVersion??0)!==old.version)throw Error('这道题已在另一台设备修改，请先同步。');
    if(!q.text&&!q.image&&!q.imageRef)throw Error('请上传题目图片或填写题干。');
    if(!state.settings.units.some(u=>u.id===q.unitId&&u.subject===q.subject))throw Error('请选择有效单元。');
    q.version=(old?.version||0)+1;q.statusVersion=old?.statusVersion||0;
    q.status=old?.status||q.status;q.updatedAt=op.at;q.deletedAt=old?.deletedAt||null;
    state.questions[q.id]=q;
  }else if(op.type==='settings'){
    if((p.baseVersion??0)!==state.settings.version)throw Error('设置已在另一台设备修改，请先同步。');
    const next=normalizeSettings(p.settings);
    for(const q of Object.values(state.questions)){
      if(!next.units.some(u=>u.id===q.unitId&&u.subject===q.subject))throw Error('请先移走单元中的题目，再删除单元。');
    }
    next.version=state.settings.version+1;state.settings=next;
  }else if(op.type==='remove'||op.type==='restore'){
    const q=Object.hasOwn(state.questions,p.questionId)?state.questions[p.questionId]:null;if(!q)throw Error('题目不存在。');
    if(op.type==='remove')q.deletedAt=op.at;else{q.deletedAt=null;q.status='todo';q.statusVersion++;}
    q.version++;q.updatedAt=op.at;
  }else if(op.type==='submit'){
    const q=Object.hasOwn(state.questions,p.questionId)?state.questions[p.questionId]:null;if(!q||q.deletedAt)throw Error('题目已移除。');
    const id=p.attemptId||op.id;if(!goodId(id))throw Error('作答编号不正确。');
    if(state.attempts[id]||q.status==='mastered')return {state:input,duplicate:true};
    state.attempts[id]={id,questionId:q.id,at:op.at,result:'pending',photo:p.photo||'',photoRef:p.photoRef||'',note:cut(p.note,1000)};
    if(q.status!=='pending'){q.status='pending';q.statusVersion++;q.version++;q.updatedAt=op.at;}
  }else if(op.type==='review'){
    const q=Object.hasOwn(state.questions,p.questionId)?state.questions[p.questionId]:null;if(!q||q.deletedAt)throw Error('题目不存在。');
    if(!['correct','retry'].includes(p.result))throw Error('请选择做对或再练。');
    if((p.baseStatusVersion??0)!==q.statusVersion)throw Error('这道题已有更新的批改结果，请先同步。');
    const a=p.attemptId?state.attempts[p.attemptId]:null;
    if(p.attemptId&&(!a||a.questionId!==q.id))throw Error('提交记录不正确。');
    const attempt=a||{id:op.id,questionId:q.id,at:op.at,photo:'',photoRef:''};
    attempt.result=p.result;attempt.reviewedAt=op.at;state.attempts[attempt.id]=attempt;
    for(const old of Object.values(state.attempts))if(old.questionId===q.id&&old.result==='pending'){old.result=p.result;old.reviewedAt=op.at;}
    q.status=p.result==='correct'?'mastered':'practicing';q.statusVersion++;q.version++;q.lastPracticedAt=op.at;q.updatedAt=op.at;
  }else if(op.type==='importBackup'){
    const b=validateBackup(p.backup),virgin=!Object.keys(state.questions).length&&state.settings.version===0;if(virgin)state.settings={...normalizeSettings(b.state.settings),version:0};
    const units=new Set(state.settings.units.map(u=>u.id));
    for(const u of b.state.settings.units)if(!units.has(u.id)){state.settings.units.push(u);units.add(u.id);}
    state.settings.version++;
    for(const [id,raw]of Object.entries(b.state.questions)){
      const old=state.questions[id];if(old&&Date.parse(old.updatedAt)>=Date.parse(raw.updatedAt))continue;
      const q=questionOf(raw);q.version=(old?.version||0)+1;q.statusVersion=(old?.statusVersion||0)+1;state.questions[id]=q;
    }
    for(const [id,a]of Object.entries(b.state.attempts)){
      const old=state.attempts[id];
      if(state.questions[a.questionId]&&(!old||Date.parse(a.reviewedAt||a.at)>Date.parse(old.reviewedAt||old.at)))state.attempts[id]=structuredClone(a);
    }
  }else throw Error('不支持的操作。');
  state.applied=[...state.applied,op.id].slice(-10000);state.revision++;
  return {state,duplicate:false};
}
export function childSnapshot(state){
  const q=Object.values(state.questions).filter(x=>!x.deletedAt&&x.status!=='mastered');
  const settings={...state.settings};delete settings.parentPinHash;
  return {schema:1,revision:state.revision,settings,questions:Object.fromEntries(q.map(x=>{
    const {answer,analysis,reason,originalImage,originalImageRef,imageEdits,...safe}=x;
    return [x.id,safe];
  })),attempts:{},applied:[]};
}
export function validateBackup(b){
  if(b?.app!=='wenzhi-mistakes'||b.version!==1||!b.state||!b.state.questions||!b.state.attempts)throw Error('这不是错题小册的备份。');
  normalizeSettings(b.state.settings);
  if(Object.keys(b.state.questions).length>5000)throw Error('一次最多导入 5000 道题。');
  for(const [id,q]of Object.entries(b.state.questions)){
    if(id!==q.id||!goodId(id))throw Error('题目编号不正确。');
    questionOf(q);
    if(!b.state.settings.units.some(u=>u.id===q.unitId&&u.subject===q.subject))throw Error('备份中有题目没有对应单元。');
    for(const key of ['image','originalImage'])if(q[key]&&!/^data:image\/(jpeg|png|webp);base64,/.test(q[key]))throw Error('题目图片格式不正确。');
    if(!Number.isFinite(Date.parse(q.createdAt))||!Number.isFinite(Date.parse(q.updatedAt)))throw Error('题目日期不正确。');
  }
  if(Object.keys(b.state.attempts).length>30000)throw Error('备份记录过多。');
  for(const [id,a]of Object.entries(b.state.attempts)){
    if(id!==a.id||!goodId(id)||!b.state.questions[a.questionId]||!['pending','correct','retry'].includes(a.result)||!Number.isFinite(Date.parse(a.at)))throw Error('作答记录不正确。');
    if(a.photo&&!/^data:image\/(jpeg|png|webp);base64,/.test(a.photo))throw Error('作答照片格式不正确。');
  }
  return b;
}
export function demoState(){
  let s=emptyState();const examples=[
    ['math',1,'看图列式','先画 5 个圆，再添上 2 个。一共有几个圆？\n请写出算式。','5 + 2 = 7','先看原来有几个，再看添上了几个。','数与计算'],
    ['math',1,'比较大小','在圆圈里填上 >、< 或 =。\n6 ○ 9　　 8 ○ 8　　 10 ○ 7','6 < 9；8 = 8；10 > 7','比较大小，再确认符号的方向。','比较大小'],
    ['math',2,'按顺序填数','2，3，（　），5，（　），7。\n后一个数比前一个数多几？','4，6；多 1','观察数的排列顺序。','数的顺序'],
    ['chinese',1,'找一找声母','读一读，圈出下面的声母。\nb　a　m　o　p　e','b、m、p','先分清声母和韵母。','拼音'],
    ['english',1,'Read and choose','Hello, I am Ben.\n选出正确的意思：\nA. 你好，我是本。　B. 再见，本。','A','Hello 是问好，I am 表示“我是”。','问候']
  ];
  examples.forEach((x,i)=>{
    const q=questionOf({id:'demo-'+i,subject:x[0],unitId:x[0]+'-unit-'+x[1],title:x[2],text:x[3],answer:x[4],analysis:x[5],tags:x[6],sourceType:i===1?'practice':'test',source:i===1?'53 练习册（示例）':'老师练习卷（示例）',page:'12',number:String(i+1),createdAt:new Date(Date.now()-i*86400000).toISOString()});
    s=applyOperation(s,operation('save',{question:q,baseVersion:0})).state;
  });return s;
}
