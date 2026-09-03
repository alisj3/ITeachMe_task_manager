import React, { useEffect, useState } from "react";
import { api } from "../../api";

const ALL_EVENTS = [
  "task.created",
  "task.updated",
  "task.completed",
  "task.deleted",
  "user.created",
  "user.updated",
  "user.deleted",
  "day.started",
  "day.ended",
];

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["task.created"]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string>("");

  const load = () => api.webhooks().then((res) => setWebhooks(res.webhooks));

  useEffect(() => {
    load();
  }, []);

  const toggleEvent = (ev: string) => {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.createWebhook({ name, url, events });
    setNewSecret(res.webhook.secret);
    setName("");
    setUrl("");
    setEvents(["task.created"]);
    load();
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await api.updateWebhook(id, { isActive: !isActive });
    load();
  };

  const remove = async (id: string) => {
    await api.deleteWebhook(id);
    load();
  };

  const test = async (id: string) => {
    setTestResult("Отправка...");
    const res = await api.testWebhook(id);
    setTestResult(`Статус: ${res.log?.responseStatus ?? "нет ответа"}, success: ${res.log?.success}`);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Webhooks</h1>

      {newSecret && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded text-sm">
          Secret (сохраните сейчас, он больше не будет показан полностью):{" "}
          <code className="break-all">{newSecret}</code>
        </div>
      )}

      <form onSubmit={submit} className="bg-white p-4 rounded border mb-8 space-y-3">
        <input
          className="w-full border rounded px-2 py-1"
          placeholder="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="w-full border rounded px-2 py-1"
          placeholder="https://example.com/webhook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-1 text-sm">
          {ALL_EVENTS.map((ev) => (
            <label key={ev} className="flex items-center gap-2">
              <input type="checkbox" checked={events.includes(ev)} onChange={() => toggleEvent(ev)} />
              {ev}
            </label>
          ))}
        </div>
        <button className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800">Добавить webhook</button>
      </form>

      {testResult && <p className="text-sm text-slate-600 mb-4">{testResult}</p>}

      <ul className="space-y-3">
        {webhooks.map((w) => (
          <li key={w.id} className="border rounded p-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">{w.name}</div>
                <div className="text-sm text-slate-500">{w.url}</div>
                <div className="text-xs text-slate-400">{w.events.join(", ")}</div>
              </div>
              <div className="flex gap-2 items-center">
                <span className={`text-xs px-2 py-1 rounded ${w.isActive ? "bg-green-100" : "bg-slate-100"}`}>
                  {w.isActive ? "Включен" : "Выключен"}
                </span>
                <button className="text-xs hover:underline" onClick={() => toggleActive(w.id, w.isActive)}>
                  {w.isActive ? "Выключить" : "Включить"}
                </button>
                <button className="text-xs hover:underline" onClick={() => test(w.id)}>
                  Test Webhook
                </button>
                <button className="text-xs text-red-500 hover:underline" onClick={() => remove(w.id)}>
                  Удалить
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
