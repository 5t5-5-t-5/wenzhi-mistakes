import{spawnSync}from'node:child_process';import{readFileSync}from'node:fs';import{fileURLToPath}from'node:url';
const repository='5t5-5-t-5/wenzhi-mistakes-data';
function gh(args,input){const r=spawnSync('gh',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe']});if(r.status!==0){const error=Error(/workflow/i.test(r.stderr)?'当前GitHub授权缺少 workflow 权限。请先运行 gh auth refresh -h github.com -s workflow，完成GitHub授权后重试。':'GitHub配置失败，请确认已登录并有私有仓库管理权限。');throw error;}return r.stdout.trim();}
try{
 const providerArg=process.argv.find(arg=>arg.startsWith('--provider='));
 const provider=providerArg?providerArg.split('=')[1]:'openai';if(!['openai','dashscope'].includes(provider))throw Error('识别服务商配置不正确。');
 const model=provider==='dashscope'?'qwen3-vl-plus':'gpt-4.1',secret=provider==='dashscope'?'DASHSCOPE_API_KEY':'OPENAI_API_KEY';
 if(gh(['api','repos/'+repository,'--jq','.private'])!=='true')throw Error('识别后台只能安装到私有数据仓库。');
 const sha=gh(['api','repos/5t5-5-t-5/wenzhi-mistakes/commits/main','--jq','.sha']);if(!/^[a-f0-9]{40}$/.test(sha))throw Error('没有找到已发布的处理程序。');
 const template=readFileSync(fileURLToPath(new URL('./workflow.yml.template',import.meta.url)),'utf8').replace('__PINNED_SHA__',sha).replaceAll('__SECRET__',secret).replace('__PROVIDER__',provider).replace('__MODEL__',model);
 let previous;try{previous=JSON.parse(gh(['api','repos/'+repository+'/contents/.github/workflows/digitize.yml']));}catch{}
 gh(['api','repos/'+repository+'/contents/.github/workflows/digitize.yml','--method','PUT','--input','-'],JSON.stringify({message:'Install trusted question recognition workflow',content:Buffer.from(template).toString('base64'),...(previous?.sha?{sha:previous.sha}:{})}));
 if(process.argv.includes('--use-env-key')){if(!process.env[secret])throw Error('当前环境没有所选服务商的AI接口密钥。');gh(['secret','set',secret,'--repo',repository],process.env[secret]+'\n');console.log('AI接口密钥已写入私有仓库 Secrets，未输出或写入代码。');}
 else console.log('工作流已安装。请在私有仓库 Settings → Secrets and variables → Actions 添加 '+secret+'。');
 gh(['workflow','run','digitize.yml','--repo',repository]);console.log('已启动服务检查。配置自己的密钥并检查成功后，网页才可提交识别请求。');
}catch(e){console.error(e.message);process.exitCode=1;}
