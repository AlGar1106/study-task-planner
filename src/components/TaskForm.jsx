import { useEffect, useRef, useState } from "react";
import {
  EMPTY_TASK,
  STATUS_LABELS,
  validateTask,
} from "../features/tasks/tasks.js";

export default function TaskForm({ task, disabled, onSave, onCancel }) {
  const [draft, setDraft] = useState({ ...EMPTY_TASK });
  const [errors, setErrors] = useState({});
  const titleRef = useRef(null);
  useEffect(() => {
    setDraft(task ? { ...task } : { ...EMPTY_TASK });
    setErrors({});
    if (task) {
      titleRef.current?.focus();
      titleRef.current?.scrollIntoView({ block: "center" });
    }
  }, [task]);
  function update(event) {
    setDraft((d) => ({ ...d, [event.target.name]: event.target.value }));
  }
  function submit(event) {
    event.preventDefault();
    const { data, errors: found } = validateTask(draft);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      event.currentTarget.elements.namedItem(first)?.focus();
      return;
    }
    if (onSave(data, task?.id)) {
      setDraft({ ...EMPTY_TASK });
      setErrors({});
    }
  }
  function field(name, label, type = "text") {
    const id = `task-${name}`;
    const props = {
      id,
      name,
      value: draft[name],
      onChange: update,
      "aria-invalid": !!errors[name],
      "aria-describedby": errors[name] ? `${id}-error` : undefined,
    };
    return (
      <p className="form-field">
        <label htmlFor={id}>{label}</label>
        {name === "description" ? (
          <textarea {...props} rows="4" maxLength="2000" />
        ) : (
          <input
            {...props}
            type={type}
            required
            ref={name === "title" ? titleRef : undefined}
            maxLength={
              name === "title" ? 120 : name === "subject" ? 80 : undefined
            }
          />
        )}
        {errors[name] && (
          <span id={`${id}-error`} className="field-error">
            {errors[name]}
          </span>
        )}
      </p>
    );
  }
  return (
    <section
      id="new-task"
      className="panel create-panel"
      aria-labelledby="form-title"
    >
      <h2 id="form-title" className="section-title">
        {task ? "Редактирование задачи" : "Новая задача"}
      </h2>
      <p className="section-description">
        Название, дисциплина и срок обязательны.
      </p>
      <form onSubmit={submit} noValidate>
        <fieldset className="form-fields" disabled={disabled}>
          <legend className="form-legend">Данные задачи</legend>
          {field("title", "Название задачи")}
          {field("subject", "Дисциплина")}
          {field("due_date", "Срок выполнения", "date")}
          {field("description", "Описание (необязательно)")}
          {task ? (
            <p className="form-field">
              <label htmlFor="task-status">Статус</label>
              <select
                id="task-status"
                name="status"
                value={draft.status}
                onChange={update}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </p>
          ) : (
            <p className="form-hint">Начальный статус: Запланирована.</p>
          )}
          <p className="form-actions">
            <button className="button button--primary" type="submit">
              {task ? "Сохранить изменения" : "Добавить задачу"}
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => {
                setDraft({ ...EMPTY_TASK });
                setErrors({});
                onCancel();
              }}
            >
              {task ? "Отмена" : "Очистить поля"}
            </button>
          </p>
        </fieldset>
      </form>
    </section>
  );
}
