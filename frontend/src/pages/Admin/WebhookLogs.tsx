import React, { useEffect, useState } from "react";
import { api } from "../../api";

export default function WebhookLogs() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    api.webhookLogs().then((res) => setLogs(res.logs));
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Webhook Logs</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Event</th>
            <th>URL</th>
            <th>Дата</th>
            <th>Статус</th>
            <th>Попытки</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b">
              <td className="py-2">{log.event}</td>
              <td className="text-slate-500">{log.webhook?.url}</td>
              <td className="text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
              <td>
                <span className={`px-2 py-1 rounded text-xs ${log.success ? "bg-green-100" : "bg-red-100"}`}>
                  {log.responseStatus ?? "—"}
                </span>
              </td>
              <td>{log.attempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && <p className="text-slate-400 mt-4">Логов пока нет.</p>}
    </div>
  );
}
