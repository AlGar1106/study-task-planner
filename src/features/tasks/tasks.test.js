import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTask, isValidDate, isOverdue, localDate, selectTasks, readTasks, writeTasks, STORAGE_KEY} from './tasks.js';
const task = (id, overrides = {}) => ({id, title: 'Лабораторная', subject: 'Математика', due_date: '2026-11-07', status: 'planned', description: '', ...overrides});

test('валидация обязательных полей, пробелов и ограничений', () => {
  const {data, errors} = validateTask(task('1', {title: '  План  '}));
  assert.equal(data.title, 'План'); assert.deepEqual(errors, {});
  for (const field of ['title', 'subject', 'due_date']) assert.ok(validateTask(task('1', {[field]: '  '})).errors[field]);
  assert.ok(validateTask(task('1', {title: 'x'.repeat(121)})).errors.title);
  assert.ok(validateTask(task('1', {status: '__proto__'})).errors.status);
});
test('календарные даты, включая високосный год', () => {
  assert.ok(isValidDate('2028-02-29')); assert.ok(!isValidDate('2026-02-29'));
  assert.ok(!isValidDate('2026-04-31')); assert.ok(!isValidDate('2026-1-01')); assert.ok(!isValidDate(''));
});
test('просрочка не включает сегодня и выполненные задачи', () => {
  const today = '2026-11-07';
  assert.ok(isOverdue(task('1', {due_date: '2026-11-06'}), today));
  assert.ok(!isOverdue(task('1'), today));
  assert.ok(!isOverdue(task('1', {due_date: '2026-11-06', status: 'completed'}), today));
  assert.equal(localDate(new Date(2026, 0, 9, 23)), '2026-01-09');
});
test('поиск, дисциплина и статус применяются совместно', () => {
  const items = [task('1'), task('2', {subject: 'История'}), task('3', {status: 'completed'}), task('4', {title: 'Конспект'})];
  assert.deepEqual(selectTasks(items, {query: ' ЛАБ ', subject: 'Математика', status: 'planned'}).map(t => t.id), ['1']);
  assert.equal(selectTasks(items, {query: 'нет совпадения'}).length, 0);
});
test('сортировка детерминирована и не изменяет исходный массив', () => {
  const items = [task('b'), task('a'), task('c', {due_date: '2026-11-08'})];
  assert.deepEqual(selectTasks(items).map(t => t.id), ['a', 'b', 'c']);
  assert.deepEqual(selectTasks(items, {sort: 'desc'}).map(t => t.id), ['c', 'a', 'b']);
  assert.deepEqual(items.map(t => t.id), ['b', 'a', 'c']);
});
test('сохранение и чтение всех полей', () => {
  const map = new Map(); const storage = {getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v)};
  assert.deepEqual(readTasks(storage), []); writeTasks(storage, [task('1', {description: '<script>текст</script>'})]);
  assert.deepEqual(readTasks(storage), [task('1', {description: '<script>текст</script>'})]);
});
test('повреждённое хранилище не перезаписывается при чтении', () => {
  let writes = 0;
  for (const raw of ['{broken', '{"version":2,"tasks":[]}', JSON.stringify({version: 1, tasks: [task('1'), task('1')]}), JSON.stringify({version: 1, tasks: [task('1', {due_date: 'wrong'})]})]) {
    assert.throws(() => readTasks({getItem: () => raw, setItem: () => writes++}));
  }
  assert.equal(writes, 0);
});
test('ошибка доступа или переполнения хранилища передаётся интерфейсу', () => {
  assert.throws(() => readTasks({getItem() {throw new Error('denied');}}));
  assert.throws(() => writeTasks({setItem() {throw new Error('quota');}}, [task('1')]));
});
