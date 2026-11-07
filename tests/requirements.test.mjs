import {after, afterEach, before, beforeEach, describe, it} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {STORAGE_KEY} from '../src/features/tasks/tasks.js';

// Lab 7: three requirements, six independent browser tests.
// Each test starts with a new browser context and empty localStorage.
let server, browser, context, page, baseUrl;
let consoleErrors;
const root = path.resolve(import.meta.dirname, '../dist');

before(async () => {
  await fs.access(path.join(root, 'index.html'));
  server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
      const data = await fs.readFile(file);
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      response.end(data);
    } catch { response.writeHead(404).end('Not found'); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
});

beforeEach(async () => {
  // A fresh browser also supports single-process Chromium in restricted runners.
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLANNER_BROWSER_EXECUTABLE || undefined,
    args: JSON.parse(process.env.PLANNER_BROWSER_ARGS || '[]'),
  });
  context = await browser.newContext({viewport: {width: 1280, height: 900}, locale: 'ru-RU'});
  page = await context.newPage();
  consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') consoleErrors.push(message.text());});
  await page.goto(baseUrl);
  await page.getByRole('heading', {name: 'Задач пока нет', exact: true}).waitFor();
});

afterEach(async () => {
  try { assert.deepEqual(consoleErrors, [], 'В сценарии не должно быть ошибок JavaScript/console.error'); }
  finally { await context?.close(); await browser?.close(); }
});

const form = () => page.locator('#new-task');
const cards = () => page.getByRole('article');
async function saved() {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key);
    return raw === null ? [] : JSON.parse(raw).tasks;
  }, STORAGE_KEY);
}
async function fillTask(title, subject = 'Математика') {
  await form().getByLabel('Название задачи', {exact: true}).fill(title);
  await form().getByLabel('Дисциплина', {exact: true}).fill(subject);
  await form().getByLabel('Срок выполнения', {exact: true}).fill('2030-12-20');
}
async function addTask(title, subject) {
  await fillTask(title, subject);
  await form().getByRole('button', {name: 'Добавить задачу', exact: true}).click();
  await page.getByRole('heading', {name: title.trim(), exact: true}).waitFor();
}
function card(title) {
  return cards().filter({has: page.getByRole('heading', {name: title, exact: true})});
}
async function displayedTitles() {
  return cards().getByRole('heading').allTextContents();
}

// FR-05 / FE-018: search matches the title and all selected filters together.
describe('FR-05 — поиск и совместные фильтры', {concurrency: false}, () => {
  it('T01: поиск без учёта регистра показывает только совпадающие названия', async () => {
    await addTask('Лабораторная по CSS');
    await addTask('Повторить формулы');
    await addTask('Лабораторная по React');
    await page.getByRole('searchbox', {name: 'Название задачи', exact: true}).fill('  ЛАБОРАТОРНАЯ  ');
    assert.deepEqual((await displayedTitles()).sort(), ['Лабораторная по CSS', 'Лабораторная по React']);
    assert.equal((await saved()).length, 3, 'Поиск не удаляет исходные задачи');
  });
  it('T02: поиск, дисциплина и статус работают совместно; сброс возвращает все задачи', async () => {
    await addTask('Лабораторная один', 'Веб разработка');
    await addTask('Лабораторная два', 'История');
    await addTask('Лабораторная три', 'Веб разработка');
    await card('Лабораторная три').getByLabel('Изменить статус', {exact: true}).selectOption('completed');
    await page.getByRole('searchbox', {name: 'Название задачи', exact: true}).fill('лабораторная');
    await page.locator('#subject-filter').selectOption('Веб разработка');
    await page.locator('#status-filter').selectOption('planned');
    assert.deepEqual(await displayedTitles(), ['Лабораторная один']);
    await page.getByRole('searchbox', {name: 'Название задачи', exact: true}).fill('нет такой задачи');
    await page.getByRole('heading', {name: 'Ничего не найдено', exact: true}).waitFor();
    assert.equal(await cards().count(), 0);
    await page.getByRole('button', {name: 'Сбросить фильтры', exact: true}).click();
    assert.equal(await cards().count(), 3);
  });
});

// FR-02 / FE-012–013: invalid input never creates a task or changes storage.
describe('FR-02 — валидация и сохранение формы', {concurrency: false}, () => {
  it('T03: пустая форма показывает ошибки всех обязательных полей и ничего не сохраняет', async () => {
    await form().getByRole('button', {name: 'Добавить задачу', exact: true}).click();
    for (const message of ['Введите название задачи.', 'Введите дисциплину.', 'Укажите корректную дату.']) {
      await form().getByText(message, {exact: true}).waitFor();
    }
    assert.equal(await cards().count(), 0);
    assert.deepEqual(await saved(), []);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'task-title');
  });
  it('T04: пробельное название не создаёт задачу и не изменяет уже сохранённые данные', async () => {
    await addTask('Существующая задача');
    const before = await saved();
    await fillTask('   ', 'Веб разработка');
    await form().getByRole('button', {name: 'Добавить задачу', exact: true}).click();
    await form().getByText('Введите название задачи.', {exact: true}).waitFor();
    assert.deepEqual(await saved(), before);
    assert.equal(await cards().count(), 1);
  });
  it('T05: корректная форма создаёт ровно одну задачу с начальным статусом; данные остаются после перезагрузки', async () => {
    await addTask('  Подготовить отчёт  ', 'Веб разработка');
    const rows = await saved();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, 'Подготовить отчёт');
    assert.equal(rows[0].subject, 'Веб разработка');
    assert.equal(rows[0].due_date, '2030-12-20');
    assert.equal(rows[0].status, 'planned');
    await page.reload();
    await page.getByRole('heading', {name: 'Подготовить отчёт', exact: true}).waitFor();
    assert.equal(await cards().count(), 1);
    assert.deepEqual(await saved(), rows);
  });
});

// FR-04 / FE-016: the status is visible, persisted and can be changed back.
describe('FR-04 — изменение статуса', {concurrency: false}, () => {
  it('T06: каждый выбранный статус виден в карточке и сохраняется; выполненную задачу можно вернуть в работу', async () => {
    await addTask('Проверить статусы');
    const taskCard = card('Проверить статусы');
    for (const [value, label] of [['in_progress', 'В работе'], ['completed', 'Выполнена'], ['in_progress', 'В работе']]) {
      await taskCard.getByLabel('Изменить статус', {exact: true}).selectOption(value);
      assert.equal(await taskCard.locator('.status').textContent(), label);
      assert.equal((await saved())[0].status, value);
      await page.reload();
      await taskCard.getByRole('heading', {name: 'Проверить статусы', exact: true}).waitFor();
      assert.equal(await taskCard.getByLabel('Изменить статус', {exact: true}).inputValue(), value);
      assert.equal(await taskCard.locator('.status').textContent(), label);
    }
  });
});
