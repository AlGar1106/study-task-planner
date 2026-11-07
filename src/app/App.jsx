import {useEffect, useState} from 'react';
import TaskForm from '../components/TaskForm.jsx';
import DeleteDialog from '../components/DeleteDialog.jsx';
import {STATUS_LABELS, localDate, isOverdue, readTasks, writeTasks, selectTasks} from '../features/tasks/tasks.js';

function initialState() {
  try { return {tasks: readTasks(window.localStorage), error: ''}; }
  catch { return {tasks: [], error: 'Не удалось прочитать сохранённые задачи. Данные не перезаписаны. Проверьте доступ к хранилищу или начните новый список.'}; }
}
const DEFAULT_FILTERS = {query: '', subject: '', status: '', sort: 'asc'};
const formatDate = value => new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'}).format(new Date(`${value}T12:00:00`));

export default function App() {
  const [boot] = useState(initialState);
  const [tasks, setTasks] = useState(boot.tasks);
  const [loadError, setLoadError] = useState(boot.error);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({...DEFAULT_FILTERS});
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [today, setToday] = useState(localDate());
  useEffect(() => {
    const refresh = () => setToday(localDate());
    const timer = setInterval(refresh, 60000); window.addEventListener('focus', refresh);
    return () => {clearInterval(timer); window.removeEventListener('focus', refresh);};
  }, []);
  function commit(next, success) {
    if (loadError) return false;
    try { writeTasks(window.localStorage, next); setTasks(next); setError(''); setMessage(success); return true; }
    catch { setError('Не удалось сохранить изменения. Проверьте свободное место и доступ к хранилищу браузера. Ввод сохранён в форме; попробуйте ещё раз.'); setMessage(''); return false; }
  }
  function save(data, id) {
    const next = id ? tasks.map(t => t.id === id ? {...data, id} : t) : [...tasks, {...data, id: crypto.randomUUID()}];
    if (!commit(next, id ? 'Изменения сохранены.' : 'Задача добавлена.')) return false;
    setEditing(null); return true;
  }
  function recover(reset = false) {
    if (reset && !window.confirm('Начать новый список? Сохранённые данные этого планировщика в браузере будут заменены пустым списком.')) return;
    try {
      if (reset) writeTasks(window.localStorage, []);
      setTasks(readTasks(window.localStorage)); setLoadError(''); setError(''); setMessage(reset ? 'Создан новый список.' : 'Данные прочитаны.');
    } catch { setLoadError('Хранилище по-прежнему недоступно или содержит повреждённые данные. Исходные данные не изменены, если запись не удалась.'); }
  }
  const subjects = [...new Set(tasks.map(t => t.subject))].sort((a, b) => a.localeCompare(b, 'ru'));
  const visible = selectTasks(tasks, filters);
  const changeFilter = e => setFilters(f => ({...f, [e.target.name]: e.target.value}));
  return <>
    <a className="skip-link" href="#main">Перейти к задачам</a>
    <header className="site-header"><p className="brand"><strong>Планировщик учебных задач</strong></p>
      <nav className="site-nav" aria-label="Основная навигация"><ul className="nav-list"><li><a href="#tasks" aria-current="page">Мои задачи</a></li><li><a href="#new-task" onClick={() => setEditing(null)}>Новая задача</a></li></ul></nav>
      <p className="account">Личный список · хранится в этом браузере</p></header>
    <main id="main" className="workspace">
      <h1 className="page-title">Мои задачи</h1><p className="page-intro">Планируйте учёбу и отмечайте выполненное.</p>
      <p className="demo-notice">Задачи сохраняются на этом устройстве. Очистка данных браузера удалит список.</p>
      {loadError && <section className="storage-error panel" aria-labelledby="storage-title"><h2 id="storage-title">Проблема с сохранёнными данными</h2><p role="alert">{loadError}</p><p className="form-actions"><button className="button button--secondary" onClick={() => recover()}>Повторить чтение</button><button className="button button--danger" onClick={() => recover(true)}>Начать новый список</button></p></section>}
      <p className="feedback feedback--success" role="status" aria-live="polite">{message}</p>
      {error && <p className="feedback feedback--error" role="alert">{error}</p>}
      <section className="panel filters-panel" aria-labelledby="filter-title"><h2 className="section-title" id="filter-title">Поиск и фильтры</h2>
        <form role="search" onSubmit={e => e.preventDefault()}><fieldset className="form-fields filter-grid"><legend className="form-legend">Условия применяются одновременно</legend>
          <p className="form-field"><label htmlFor="query">Название задачи</label><input id="query" name="query" type="search" value={filters.query} onChange={changeFilter} placeholder="Например, лабораторная" /></p>
          <p className="form-field"><label htmlFor="subject-filter">Дисциплина</label><select id="subject-filter" name="subject" value={filters.subject} onChange={changeFilter}><option value="">Все дисциплины</option>{[...new Set([...subjects, ...(filters.subject ? [filters.subject] : [])])].map(s => <option key={s}>{s}</option>)}</select></p>
          <p className="form-field"><label htmlFor="status-filter">Статус</label><select id="status-filter" name="status" value={filters.status} onChange={changeFilter}><option value="">Все статусы</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></p>
          <p className="form-field"><label htmlFor="sort">Порядок по сроку</label><select id="sort" name="sort" value={filters.sort} onChange={changeFilter}><option value="asc">Сначала ближайшие</option><option value="desc">Сначала дальние</option></select></p>
          <p className="form-actions"><button type="button" className="button button--secondary" onClick={() => setFilters({...DEFAULT_FILTERS})}>Сбросить фильтры</button></p>
        </fieldset></form></section>
      <section id="tasks" className="tasks-section" aria-labelledby="tasks-title"><h2 id="tasks-title" className="section-title" tabIndex="-1">Список задач</h2>
        <p className="section-description" aria-live="polite">Показано {visible.length} из {tasks.length} · выполнено {tasks.filter(t => t.status === 'completed').length}</p>
        {!visible.length ? <section className="panel empty-state" aria-labelledby="empty-title"><h3 id="empty-title">{tasks.length ? 'Ничего не найдено' : 'Задач пока нет'}</h3><p>{tasks.length ? 'Измените условия поиска или сбросьте фильтры.' : 'Добавьте первую учебную задачу в форме.'}</p><a href="#new-task">Создать задачу</a></section> : <ul className="task-list">{visible.map(task => <li key={task.id}><article className="task-card" aria-labelledby={`title-${task.id}`}>
          <h3 id={`title-${task.id}`} className="task-title">{task.title}</h3><dl className="task-meta"><div className="meta-item"><dt>Дисциплина</dt><dd>{task.subject}</dd></div><div className="meta-item"><dt>Срок</dt><dd><time dateTime={task.due_date}>{formatDate(task.due_date)}</time></dd></div><div className="meta-item"><dt>Статус</dt><dd className={`status status--${{planned: 'planned', in_progress: 'progress', completed: 'completed'}[task.status]}`}>{STATUS_LABELS[task.status]}</dd></div></dl>
          {isOverdue(task, today) && <p className="overdue-label"><strong>Просрочена</strong></p>}
          {task.description && <p className="task-description">{task.description}</p>}
          <p className="form-field"><label htmlFor={`status-${task.id}`}>Изменить статус</label><select id={`status-${task.id}`} value={task.status} disabled={!!loadError} onChange={e => commit(tasks.map(t => t.id === task.id ? {...t, status: e.target.value} : t), 'Статус сохранён.')}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></p>
          <p className="task-actions"><button type="button" className="button button--secondary" disabled={!!loadError} onClick={() => setEditing(task)}>Редактировать</button><button type="button" className="button button--danger" disabled={!!loadError} onClick={() => {setDeleting(task); setDeleteError('');}}>Удалить</button></p>
        </article></li>)}</ul>}
      </section>
      <TaskForm task={editing} disabled={!!loadError} onSave={save} onCancel={() => setEditing(null)} />
    </main>
    <footer className="site-footer"><p>Планировщик учебных задач · MVP</p><a href="#main">К началу страницы</a></footer>
    {deleting && <DeleteDialog task={deleting} error={deleteError} onCancel={() => setDeleting(null)} onConfirm={() => {
      if (commit(tasks.filter(t => t.id !== deleting.id), 'Задача удалена.')) {if (editing?.id === deleting.id) setEditing(null); setDeleting(null);}
      else setDeleteError('Удаление не сохранено. Задача остаётся в списке. Проверьте доступ к хранилищу и повторите попытку.');
    }} />}
  </>;
}
