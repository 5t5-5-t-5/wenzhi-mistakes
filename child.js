import {renderQuestionContent} from './digital-question.js';
import {NotebookDB,SUBJECTS,chooseQuestion,titleOf,operation} from './data.js';
import {$,esc,toast,initDialogs,compressPhoto,registerOffline} from './ui.js';
import {initPrint,openPrint} from './print.js';
import {SyncClient,childDatabaseName,connection} from './sync-client.js';
let db,sync,state,task=null,photo='',parentToken='',needsParentSync=false;
const subjectOf=id=>SUBJECTS.find(s=>s.id===id);
async function saveTask(){await db.write('meta',{id:'currentTask',value:task});}
const qNow=()=>task&&state.questions[task.questionId];
function render(){const q=qNow();document.title=state.settings.name+'的小任务';document.querySelector('.child-header .brand>span:last-child').textContent=state.settings.name+'的小任务';
  if(task?.phase==='finished'||task&&(!q||q.status==='mastered'))return renderFinished(true);
  if(task?.phase==='ready')return renderReady();
  if(task?.phase==='submitted'||q?.status==='pending')return renderFinished(false);
  if(task&&q)return renderQuestion(q);
  const s=state.settings.assignment;
  if(s.subject){start(s.subject,s.unitId).catch(e=>toast(e.message));return;}
  renderHome();
}
function renderHome(){$('childContent').innerHTML=`<section class="child-welcome"><p class="eyebrow">${esc(state.settings.name)}的小任务</p><h1>今天，想先试试什么？</h1><p>选一本小册，眼前只有一道题。</p></section><section class="child-subjects">${SUBJECTS.map(s=>`<button class="child-subject" style="--book-bg:${s.light};--book-ink:${s.color}" data-action="start" data-id="${s.id}"><span class="book-symbol">${s.symbol}</span><strong>${s.name}</strong><small>打开小任务 →</small></button>`).join('')}</section><p class="child-home-note">慢慢想，不着急。</p>`;}
async function start(subject,unitId){const q=chooseQuestion(Object.values(state.questions),{subject,unitId,lastId:(await db.get('meta','lastQuestion'))?.value});
  if(!q){$('childContent').innerHTML=`<section class="finish-card"><div class="finish-symbol">☀</div><h1>现在可以休息啦。</h1><p>这里暂时没有需要再练的小任务。<br>请家长来整理小册。</p><button class="quiet" data-action="home">回到首页</button></section>`;return;}
  task={questionId:q.id,subject,phase:'working'};photo='';await saveTask();await db.write('meta',{id:'lastQuestion',value:q.id});renderQuestion(q);
}
function renderQuestion(q){const s=subjectOf(q.subject);$('childContent').innerHTML=`<section class="child-welcome"><p class="eyebrow">一点点进步，也很了不起</p><h1>先看眼前这一题。</h1></section><article class="child-question"><div class="child-q-label"><span>${s.name}小任务</span><span>慢慢想 · 不着急</span></div>${renderQuestionContent(q,'child')}</article><div class="child-actions"><button class="secondary" data-action="print">▧ 打印这一题</button><button class="primary" data-action="done">我做完了 ✓</button></div><p class="child-after-note">可以在纸上写，也可以先想一想。做完就停下来。</p><div class="child-actions"><button class="quiet small" data-action="home">先休息一下</button></div>`;}
function renderReady(){$('childContent').innerHTML=`<section class="finish-card"><div class="finish-symbol">✓</div><h1>这一题，完成啦。</h1><p>请家长来看看你的作答。</p><label class="finish-photo"><span>${photo?'作答照片已选好 · 可以重拍':'可以拍下作答（选填）'}</span><input id="workPhoto" type="file" accept="image/*" capture="environment" hidden>${photo?`<img src="${esc(photo)}" alt="你拍下的作答">`:''}</label><div class="child-actions"><button class="primary" data-action="submit">交给家长确认</button></div><p class="child-after-note">今天先到这里，休息一下吧。</p><button class="quiet" data-action="backQuestion">再看一眼题目</button></section>`;
  $('workPhoto').onchange=async e=>{if(e.target.files[0])try{photo=await compressPhoto(e.target.files[0],1800);renderReady();}catch(e){toast(e.message);}};
}
function renderFinished(confirmed){$('childContent').innerHTML=`<section class="finish-card"><div class="finish-symbol">${confirmed?'✓':'✦'}</div><h1>${confirmed?'认真完成，就很棒。':'小任务已交给家长。'}</h1><p>${confirmed?'今天先到这里，休息一下吧。':'今天先休息一下。<br>家长确认后，这道题的记录就会更新。'}</p>${!confirmed||needsParentSync?'<div class="child-actions"><button class="secondary" data-action="parent">'+(needsParentSync?'请家长同步确认结果':'请家长确认')+'</button></div>':''}<p class="child-after-note">做一点，进步一点。</p><button class="quiet" data-action="home">回到首页</button></section>`;}
async function submit(){const q=qNow();if(!q)return;const op=operation('submit',{questionId:q.id,photo});state=await db.commit(op);task.phase='submitted';await saveTask();render();sync.schedule();}
async function showParent(){parentToken='';$('confirmError').hidden=true;$('confirmPassword').value='';$('confirmPasswordLabel').hidden=!sync.config;$('confirmAnswer').hidden=true;$('parentConfirmHint').textContent=sync.config?'请家长输入同步密码，核对纸上作答后选择结果。':'请家长核对孩子的纸上作答，再选择结果。确认做对后退出日常轮转。';
  const q=qNow();if(!sync.config&&q?.answer){$('confirmAnswer').textContent='家长核对答案：'+q.answer;$('confirmAnswer').hidden=false;}$('parentConfirmDialog').showModal();
}
async function review(result){const buttons=[$('childCorrect'),$('childRetry')];buttons.forEach(b=>b.disabled=true);
  try{
    if(sync.config){
      parentToken=await sync.login(sync.config.url,$('confirmPassword').value);
      const ok=await sync.sync({token:parentToken});if(!ok)throw Error(sync.lastError||'请先联网同步，再确认结果。');state=await db.state();
    }
    const q=qNow();if(!q||q.status==='mastered'){task.phase='finished';await saveTask();$('parentConfirmDialog').close();render();return;}
    state=await db.commit(operation('review',{questionId:q.id,result,baseStatusVersion:q.statusVersion}));
    if(sync.config){const ok=await sync.sync({token:parentToken});if(!ok)throw Error('结果已保存在本机，尚未同步：'+sync.lastError);}
    task.phase='finished';await saveTask();$('parentConfirmDialog').close();render();toast(result==='correct'?'家长已确认做对。':'已记录，以后再练。');if(!sync.config)sync.schedule();
  }catch(e){$('confirmError').hidden=false;$('confirmError').textContent=e.message;}
  finally{buttons.forEach(b=>b.disabled=false);$('confirmPassword').value='';parentToken='';}
}
const actions={start:id=>start(id),home:async()=>{task=null;await saveTask();renderHome();},print:()=>openPrint(qNow(),state.settings.name),done:async()=>{task.phase='ready';await saveTask();renderReady();},backQuestion:async()=>{task.phase='working';await saveTask();render();},submit,parent:showParent};
$('childContent').onclick=e=>{const t=e.target.closest('[data-action]');if(t){t.disabled=true;Promise.resolve(actions[t.dataset.action]?.(t.dataset.id)).catch(e=>toast(e.message)).finally(()=>t.disabled=false);}};
$('childCorrect').onclick=()=>review('correct');$('childRetry').onclick=()=>review('retry');$('childConnect').onclick=()=>$('childConnectDialog').showModal();$('applyPairLink').onclick=async()=>{try{await sync.acceptPair($('pairLink').value,$('pairPassword').value);location.replace('child.html');}catch(e){toast(e.message);}};
initDialogs();initPrint();
try{
  db=await new NotebookDB().open(await childDatabaseName());state=await db.state();task=(await db.get('meta','currentTask'))?.value||null;
  sync=new SyncClient(db,'child',next=>{state=next;render();},info=>{const old=needsParentSync;needsParentSync=!!info.configured&&info.parentOps;if(old!==needsParentSync&&task&&(task.phase==='submitted'||task.phase==='finished'||qNow()?.status==='mastered'))render();$('childSyncStatus').textContent=info.busy?'正在同步':!info.configured?'仅本机':info.error?'记录已保存，待同步':info.count?'待同步':info.last?'已同步':'已连接';});
  if(location.hash.startsWith('#connect=')){
    try{await sync.acceptPair(location.href);history.replaceState(null,'',location.pathname);location.reload();}
    catch(e){if(e.code!=='PAIR_PASSWORD')throw e;renderHome();$('pairLink').value=location.href;$('childConnectDialog').showModal();}
  }
  else{render();sync.sync();registerOffline();window.addEventListener('focus',async()=>{state=await db.state();render();sync.sync();});}
}catch(e){$('childContent').innerHTML=`<div class="empty-state"><h1>请家长来帮忙连接</h1><p>${esc(e.message)}</p></div>`;}
