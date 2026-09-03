import React, { useEffect, useState } from "react";
import { api, Task } from "../api";

const STATUS_OPTIONS: { value: Task["status"]; label: string }[] = [
  { value: "pending", label: "Ожидание" },
  { value: "in_progress", label: "В работе" },
  { value: "completed", label: "Готово" },
];

const PRIORITY_OPTIONS: { value: Task["priority"]; label: string }[] = [
  { value: "low", label: "Низкий" },
  { value: "medium", label: "Средний" },
  { value: "high", label: "Высокий" },
];

interface Props {
  open: boolean;
  taskId: string | null; // null = create mode
  defaultStatus?: Task["status"];
  onClose: () => void;
  onChanged: () => void; // called after any save/delete so the board can refresh
}

export default function TaskModal({ open, taskId, defaultStatus, onClose, onChanged }: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Task["status"]>(defaultStatus || "pending");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [commentBody, setCommentBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isCreate = taskId === null;

  const load = async (id: string) => {
    const res = await api.getTask(id);
    setTask(res.task);
    setTitle(res.task.title);
    setDescription(res.task.description || "");
    setStatus(res.task.status);
    setPriority(res.task.priority);
  };

  useEffect(() => {
    if (!open) return;
    setError("");
    setCommentBody("");
    setLinkUrl("");
    setLinkLabel("");
    if (taskId) {
      load(taskId);
    } else {
      setTask(null);
      setTitle("");
      setDescription("");
      setStatus(defaultStatus || "pending");
      setPriority("medium");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId]);

  if (!open) return null;

  const save = async () => {
    if (!title.trim()) {
      setError("Название обязательно");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (isCreate) {
        await api.createTask({ title, description, priority });
      } else if (task) {
        await api.updateTask(task.id, { title, description, status, priority });
      }
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!task) return;
    if (!confirm("Удалить задачу?")) return;
    await api.deleteTask(task.id);
    onChanged();
    onClose();
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !commentBody.trim()) return;
    await api.addComment(task.id, commentBody);
    setCommentBody("");
    load(task.id);
  };

  const removeComment = async (commentId: string) => {
    if (!task) return;
    await api.deleteComment(task.id, commentId);
    load(task.id);
  };

  const submitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !linkUrl.trim()) return;
    await api.addLink(task.id, { url: linkUrl, label: linkLabel || undefined });
    setLinkUrl("");
    setLinkLabel("");
    load(task.id);
  };

  const removeLink = async (linkId: string) => {
    if (!task) return;
    await api.deleteLink(task.id, linkId);
    load(task.id);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{isCreate ? "Новая задача" : "Задача"}</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">
              ×
            </button>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div>
            <label className="text-xs text-slate-500">Название</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-slate-500">Описание</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            {!isCreate && (
              <div className="flex-1">
                <label className="text-xs text-slate-500">Статус</label>
                <select
                  className="w-full border rounded px-2 py-2"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Task["status"])}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex-1">
              <label className="text-xs text-slate-500">Приоритет</label>
              <select
                className="w-full border rounded px-2 py-2"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Task["priority"])}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 disabled:opacity-50"
            >
              {isCreate ? "Создать" : "Сохранить"}
            </button>
            {!isCreate && (
              <button onClick={remove} className="text-red-600 text-sm px-3 py-2 hover:underline">
                Удалить задачу
              </button>
            )}
          </div>

          {!isCreate && task && (
            <>
              <hr />

              <div>
                <h3 className="text-sm font-medium mb-2">Ссылки</h3>
                <ul className="space-y-1 mb-2">
                  {(task.links || []).map((l) => (
                    <li key={l.id} className="flex items-center justify-between text-sm">
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline truncate max-w-[280px]"
                      >
                        {l.label || l.url}
                      </a>
                      <button className="text-xs text-red-500 hover:underline" onClick={() => removeLink(l.id)}>
                        удалить
                      </button>
                    </li>
                  ))}
                  {(task.links || []).length === 0 && <li className="text-xs text-slate-400">Ссылок пока нет.</li>}
                </ul>
                <form onSubmit={submitLink} className="flex gap-2">
                  <input
                    className="flex-1 border rounded px-2 py-1 text-sm"
                    placeholder="https://..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                  />
                  <input
                    className="w-28 border rounded px-2 py-1 text-sm"
                    placeholder="подпись"
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                  />
                  <button className="text-sm bg-slate-100 px-3 rounded hover:bg-slate-200">+</button>
                </form>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Комментарии</h3>
                <ul className="space-y-2 mb-2">
                  {(task.comments || []).map((c) => (
                    <li key={c.id} className="text-sm bg-slate-50 rounded px-3 py-2">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>
                          {c.author.firstName} {c.author.lastName}
                        </span>
                        <div className="flex gap-2">
                          <span>{new Date(c.createdAt).toLocaleString()}</span>
                          <button className="text-red-500 hover:underline" onClick={() => removeComment(c.id)}>
                            удалить
                          </button>
                        </div>
                      </div>
                      <div>{c.body}</div>
                    </li>
                  ))}
                  {(task.comments || []).length === 0 && (
                    <li className="text-xs text-slate-400">Комментариев пока нет.</li>
                  )}
                </ul>
                <form onSubmit={submitComment} className="flex gap-2">
                  <input
                    className="flex-1 border rounded px-2 py-1 text-sm"
                    placeholder="Добавить комментарий..."
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                  />
                  <button className="text-sm bg-slate-100 px-3 rounded hover:bg-slate-200">+</button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
