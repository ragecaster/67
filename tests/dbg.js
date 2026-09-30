const { chromium } = require('playwright');
(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROME_PATH});
const p=await b.newPage();
p.on('console',m=>console.log('C:',m.type(),m.text().slice(0,200)));
p.on('pageerror',e=>console.log('PE:',e.message));

await p.goto('file:///home/user/67/index.html');
await p.waitForTimeout(8000);
console.log(await p.evaluate(()=>typeof G+' '+(typeof G!=='undefined'&&G.state)));
await b.close();})();
