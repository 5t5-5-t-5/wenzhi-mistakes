import {randomBytes,createHash} from 'node:crypto';import {spawnSync}from'node:child_process';import process from'node:process';
const password=randomBytes(15).toString('base64url');
function secret(name,value){const command=process.platform==='win32'?'npx.cmd':'npx';const r=spawnSync(command,['wrangler','secret','put',name],{input:value+'\n',encoding:'utf8',stdio:['pipe','pipe','pipe']});if(r.status!==0){process.stderr.write('未能设置 '+name+'。请先运行 npx wrangler login，并检查 Workers 权限。\n');process.exit(1);}process.stdout.write(name+' 已设置。\n');}
if(!process.argv.includes('--password-only')){
 if(!process.stdin.isTTY){process.stderr.write('请在交互终端运行。\n');process.exit(1);}
 process.stdout.write('粘贴仅能读写私有数据仓库的 GitHub Token（输入不回显），按回车：');
 process.stdin.setRawMode(true);process.stdin.resume();let input='';
 const token=await new Promise((resolve,reject)=>{const listener=chunk=>{for(const c of chunk.toString()){if(c==='\u0003'){process.stdin.setRawMode(false);process.exit(130);}if(c==='\r'||c==='\n'){process.stdin.off('data',listener);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');resolve(input.trim());return;}if(c==='\u007f')input=input.slice(0,-1);else input+=c;}};process.stdin.on('data',listener);});
 if(!/^github_pat_/.test(token)){process.stderr.write('请使用 github_pat_ 开头的细粒度令牌，并只授权私有数据仓库。\n');process.exit(1);}
 secret('GITHUB_TOKEN',token);
}
secret('SESSION_SECRET',randomBytes(48).toString('base64url'));
secret('PARENT_PASSWORD_HASH',createHash('sha256').update(password).digest('hex'));
process.stdout.write('\n家长同步密码（仅显示这一次）：'+password+'\n请存入密码管理器。之后运行 npx wrangler deploy。\n');
