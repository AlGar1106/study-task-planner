import { useEffect, useRef } from "react";
export default function DeleteDialog({ task, error, onCancel, onConfirm }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => {
      ref.current?.close();
      if (previous?.isConnected) previous.focus();
      else document.getElementById("tasks-title")?.focus();
    };
  }, []);
  return (
    <dialog
      className="delete-dialog"
      ref={ref}
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id="delete-title">Удалить задачу?</h2>
      <p id="delete-description">
        «{task.title}» будет удалена из этого браузера.
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <p className="form-actions">
        <button
          autoFocus
          type="button"
          className="button button--secondary"
          onClick={onCancel}
        >
          Отмена
        </button>
        <button
          type="button"
          className="button button--danger"
          onClick={onConfirm}
        >
          Удалить задачу
        </button>
      </p>
    </dialog>
  );
}
