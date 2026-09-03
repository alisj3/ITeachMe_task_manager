import React, { useEffect, useState } from "react";
import { api, Task } from "../api";
import KanbanBoard from "../components/KanbanBoard";
import TaskModal from "../components/TaskModal";

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [date, setDate] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const load = async () => {
    const res = await api.tasks();
    setTasks(res.tasks);
    setDate(res.date);
  };

  useEffect(() => {
    load();
  }, []);

  const openTask = (id: string) => {
    setActiveTaskId(id);
    setModalOpen(true);
  };

  const createTask = () => {
    setActiveTaskId(null);
    setModalOpen(true);
  };

  const changeStatus = async (id: string, status: Task["status"]) => {
    await api.updateTask(id, { status });
    load();
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">Сегодня</h1>
        <button onClick={createTask} className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800">
          + Новая задача
        </button>
      </div>
      <p className="text-slate-500 mb-6">{date}</p>

      <KanbanBoard tasks={tasks} onOpenTask={openTask} onStatusChange={changeStatus} />

      <TaskModal open={modalOpen} taskId={activeTaskId} onClose={() => setModalOpen(false)} onChanged={load} />
    </div>
  );
}
