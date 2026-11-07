import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium as playwright} from 'playwright';

const root=path.resolve(import.meta.dirname, '../dist');
const artifacts=path.resolve(import.meta.dirname,'../test-results');
await fs.mkdir(artifacts,{recursive:true});
const server=http.createServer(async(req,res)=>{
 try {const requested=new URL(req.url,'http://localhost').pathname;const file=path.join(root, requested==='/'?'index.html':requested);const data=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);}catch {res.statusCode=404;res.end('Not found');}
});
await new Promise(r=>server.listen(5188,'127.0.0.1',r));
const browser=await playwright.launch({headless:true,args:JSON.parse(process.env.PLANNER_BROWSER_ARGS || '[]'),executablePath:process.env.PLANNER_BROWSER_EXECUTABLE || undefined});
const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];
page.on('pageerror', e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const url='http://127.0.0.1:5188';
try{
 await page.goto(url);await page.getByRole('heading',{name:'Задач пока нет',exact:true}).waitFor();
 await page.getByRole('button',{name:'Добавить задачу',exact:true}).click();await page.getByText('Введите название задачи.',{exact:true}).waitFor();
 async function add(title,subject,date){await page.locator('#new-task').getByLabel('Название задачи',{exact:true}).fill(title);await page.locator('#new-task').getByLabel('Дисциплина',{exact:true}).fill(subject);await page.locator('#new-task').getByLabel('Срок выполнения',{exact:true}).fill(date);await page.getByRole('button',{name:'Добавить задачу',exact:true}).click();await page.getByRole('heading',{name:title,exact:true}).waitFor();}
 await add('Лабораторная работа 6','Веб разработка','2026-01-01');
 await page.getByRole('status').filter({hasText:'Задача добавлена.'}).waitFor();
 await page.reload();await page.getByRole('heading',{name:'Лабораторная работа 6',exact:true}).waitFor();
 let card=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Лабораторная работа 6',exact:true})});
 await card.getByText('Просрочена',{exact:true}).waitFor();
 await card.getByRole('button',{name:'Редактировать',exact:true}).click();
 await page.locator('#new-task').getByLabel('Название задачи',{exact:true}).fill('Исправленная лабораторная');
 await page.locator('#new-task').getByLabel('Описание (необязательно)',{exact:true}).fill('<script>window.injected = true</script>');
 await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
 card=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Исправленная лабораторная',exact:true})});
 await card.getByText('<script>window.injected = true</script>',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.injected),undefined);
 await card.getByLabel('Изменить статус',{exact:true}).selectOption('completed');assert.equal(await card.getByText('Просрочена',{exact:true}).count(),0);
 await page.reload();card=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Исправленная лабораторная',exact:true})});assert.equal(await card.getByLabel('Изменить статус',{exact:true}).inputValue(),'completed');
 await card.getByLabel('Изменить статус',{exact:true}).selectOption('in_progress');
 await add('Прочитать конспект','История','2026-12-20');
 await page.locator('#new-task').getByLabel('Название задачи',{exact:true}).fill('Черновик');await page.getByRole('button',{name:'Очистить поля',exact:true}).click();assert.equal(await page.locator('#new-task').getByLabel('Название задачи',{exact:true}).inputValue(),'');
 await page.getByRole('searchbox',{name:'Название задачи',exact:true}).fill('ЛАБ');
 await page.locator('#subject-filter').selectOption('Веб разработка');await page.locator('#status-filter').selectOption('in_progress');assert.equal(await page.getByRole('article').count(),1);
 await page.getByRole('searchbox',{name:'Название задачи',exact:true}).fill('нет совпадений');await page.getByRole('heading',{name:'Ничего не найдено',exact:true}).waitFor();
 await page.getByRole('button',{name:'Сбросить фильтры',exact:true}).click();assert.equal(await page.getByRole('article').count(),2);
 await page.locator('#sort').selectOption('desc');assert.equal(await page.getByRole('article').first().getByRole('heading').textContent(),'Прочитать конспект');
 await card.getByRole('button',{name:'Удалить',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('dialog').getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(await card.count(),1);
 await card.getByRole('button',{name:'Удалить',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await card.getByRole('button',{name:'Удалить',exact:true}).click();await page.getByRole('button',{name:'Удалить задачу',exact:true}).click();assert.equal(await card.count(),0);
 await page.reload();assert.equal(await page.getByRole('article').count(),1);
 for(const width of [360,768,1440]){await page.setViewportSize({width,height:1000});const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert.ok(sizes.scroll<=sizes.client,`Overflow at ${width}: ${JSON.stringify(sizes)}`);await page.screenshot({path:path.join(artifacts,`lab6-${width}.png`),fullPage:true});}
 await page.setViewportSize({width:1440,height:1000});await page.keyboard.press('Control+Home');await page.reload();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Перейти к задачам');
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError');};});
 await page.locator('#new-task').getByLabel('Название задачи',{exact:true}).fill('Не потерять ввод');await page.locator('#new-task').getByLabel('Дисциплина',{exact:true}).fill('Тест');await page.locator('#new-task').getByLabel('Срок выполнения',{exact:true}).fill('2026-12-25');await page.getByRole('button',{name:'Добавить задачу',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Не удалось сохранить изменения.'}).waitFor();assert.equal(await page.locator('#new-task').getByLabel('Название задачи',{exact:true}).inputValue(),'Не потерять ввод');assert.equal(await page.getByRole('article').count(),1);
 await page.reload();await page.evaluate(()=>localStorage.setItem('study-task-planner:v1','{broken'));await page.reload();await page.getByRole('heading',{name:'Проблема с сохранёнными данными',exact:true}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('study-task-planner:v1')),'{broken');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Начать новый список',exact:true}).click();assert.equal(await page.evaluate(()=>localStorage.getItem('study-task-planner:v1')),'{broken');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Начать новый список',exact:true}).click();await page.getByRole('heading',{name:'Задач пока нет',exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: production page, required fields, create, reload, edit, XSS text, status/reopen, joint filters, empty results, sort, delete cancellation/Escape/confirm, persistence, keyboard, 360/768/1440 no overflow, quota error preserves input, corrupt storage guarded, console clean.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
