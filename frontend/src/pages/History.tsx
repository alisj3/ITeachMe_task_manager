import React, { useEffect, useState } from "react";
import { api, Task } from "../api";

export default function History() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    api.history().then((res) => setTasks(res.tasks));
  }, []);

  const byDate = tasks.reduce<Record<string, Task[]>>((acc, t) => {
    const key = t.taskDate;
    acc[key] = acc[key] || [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">История</h1>
      {Object.entries(byDate).map(([date, dayTasks]) => (
        <div key={date} className="mb-6">
          <h2 className="font-medium text-slate-600 mb-2">{date}</h2>
          <ul className="space-y-1">
            {dayTasks.map((t) => (
              <li key={t.id} className="border rounded px-3 py-2 flex justify-between">
                <span className={t.status === "completed" ? "line-through text-slate-400" : ""}>{t.title}</span>
                <span className="text-xs text-slate-500">{t.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {tasks.length === 0 && <p className="text-slate-400">Пока нет истории.</p>}
    </div>
  );
}
