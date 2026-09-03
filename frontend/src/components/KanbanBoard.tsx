import React from "react";
import { Task } from "../api";

const COLUMNS: { key: Task["status"]; label: string }[] = [
  { key: "pending", label: "Ожидание" },
  { key: "in_progress", label: "В работе" },
  { key: "completed", label: "Готово" },
];

const PRIORITY_STYLE: Record<Task["priority"], string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

interface Props {
  tasks: Task[];
  onOpenTask: (id: string) => void;
  onCreateInColumn?: (status: Task["status"]) => void;
  onStatusChange: (id: string, status: Task["status"]) => void;
  groupByOwner?: boolean; // for the team/funnel view — show whose task it is
}

export default function KanbanBoard({ tasks, onOpenTask, onCreateInColumn, onStatusChange, groupByOwner }: Props) {
  const grouped = COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.key),
  }));

  const handleDrop = (e: React.DragEvent, status: Task["status"]) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/task-id");
    if (id) onStatusChange(id, status);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {grouped.map((col) => (
        <div
          key={col.key}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, col.key)}
          className="bg-slate-50 rounded-lg p-3 flex flex-col"
          style={{ minHeight: 240 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-slate-700 flex items-center gap-2">
              {col.label}
              <span className="text-xs text-slate-400 bg-white border rounded-full px-2">{col.tasks.length}</span>
            </h3>
            {onCreateInColumn && col.key === "pending" && (
              <button
                onClick={() => onCreateInColumn(col.key)}
                className="text-xs bg-slate-900 text-white w-6 h-6 rounded hover:bg-slate-800"
                title="Новая задача"
              >
                +
              </button>
            )}
          </div>

          <div className="space-y-2 flex-1">
            {col.tasks.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/task-id", t.id)}
                onClick={() => onOpenTask(t.id)}
                className="bg-white border rounded-md p-3 cursor-pointer hover:shadow-sm transition"
              >
                <div className="text-sm font-medium mb-1">{t.title}</div>
                {t.description && <div className="text-xs text-slate-500 line-clamp-2 mb-2">{t.description}</div>}
                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                  <span className={`px-2 py-0.5 rounded ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
                  {!!t.comments?.length && <span>💬 {t.comments.length}</span>}
                  {!!t.links?.length && <span>🔗 {t.links.length}</span>}
                  {groupByOwner && t.user && (
                    <span className="ml-auto">
                      {t.user.firstName} {t.user.lastName}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {col.tasks.length === 0 && (
              <div className="text-xs text-slate-400 text-center py-6 border border-dashed rounded">Пусто</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
