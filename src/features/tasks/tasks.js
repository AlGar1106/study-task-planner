export const STORAGE_KEY = "study-task-planner:v1";
export const STATUS_LABELS = Object.freeze({
  planned: "Запланирована",
  in_progress: "В работе",
  completed: "Выполнена",
});
export const EMPTY_TASK = Object.freeze({
  title: "",
  subject: "",
  due_date: "",
  description: "",
  status: "planned",
});

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function validateTask(input) {
  const data = { ...EMPTY_TASK };
  for (const field of Object.keys(data))
    data[field] = typeof input?.[field] === "string" ? input[field].trim() : "";
  const errors = {};
  if (!data.title) errors.title = "Введите название задачи.";
  else if (data.title.length > 120)
    errors.title = "Название должно быть не длиннее 120 символов.";
  if (!data.subject) errors.subject = "Введите дисциплину.";
  else if (data.subject.length > 80) errors.subject = "Не больше 80 символов.";
  if (!isValidDate(data.due_date)) errors.due_date = "Укажите корректную дату.";
  if (data.description.length > 2000)
    errors.description = "Не больше 2000 символов.";
  if (!Object.hasOwn(STATUS_LABELS, data.status))
    errors.status = "Выберите статус из списка.";
  return { data, errors };
}
export function isOverdue(task, today = localDate()) {
  return task.status !== "completed" && task.due_date < today;
}
export function selectTasks(
  tasks,
  { query = "", subject = "", status = "", sort = "asc" } = {},
) {
  const needle = query.trim().toLocaleLowerCase("ru");
  return tasks
    .filter(
      (t) =>
        t.title.toLocaleLowerCase("ru").includes(needle) &&
        (!subject || t.subject === subject) &&
        (!status || t.status === status),
    )
    .sort(
      (a, b) =>
        (sort === "desc" ? -1 : 1) * a.due_date.localeCompare(b.due_date) ||
        a.id.localeCompare(b.id),
    );
}
export function readTasks(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  const parsed = JSON.parse(raw);
  if (parsed?.version !== 1 || !Array.isArray(parsed.tasks))
    throw new Error("Неверный формат данных.");
  const ids = new Set();
  for (const task of parsed.tasks) {
    if (
      !task ||
      typeof task.id !== "string" ||
      !task.id ||
      ids.has(task.id) ||
      Object.keys(validateTask(task).errors).length
    )
      throw new Error("Повреждена запись задачи.");
    ids.add(task.id);
  }
  return parsed.tasks.map((t) => ({ ...validateTask(t).data, id: t.id }));
}
export function writeTasks(storage, tasks) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks }));
}
