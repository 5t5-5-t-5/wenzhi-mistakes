import{createRequire}from'node:module';import{mkdirSync}from'node:fs';
export async function playwright(){if(process.env.PLAYWRIGHT_MODULES)return createRequire(process.env.PLAYWRIGHT_MODULES+'/')('playwright');return import('playwright');}
export const chromeOptions=process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:process.platform==='darwin'?{channel:'chrome'}:{};
mkdirSync('test-results',{recursive:true});
