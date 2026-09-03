import React, { useEffect, useState } from "react";
import { api, User } from "../../api";

export default function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", role: "EMPLOYEE" });
  const [error, setError] = useState("");

  const load = () => api.users().then((res) => setUsers(res.users));

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.createUser(form);
      setForm({ firstName: "", lastName: "", email: "", password: "", role: "EMPLOYEE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Пользователи</h1>

      <form onSubmit={submit} className="grid grid-cols-2 gap-2 mb-8 bg-white p-4 rounded border">
        {error && <div className="col-span-2 text-red-600 text-sm">{error}</div>}
        <input
          className="border rounded px-2 py-1"
          placeholder="Имя"
          value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          required
        />
        <input
          className="border rounded px-2 py-1"
          placeholder="Фамилия"
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          required
        />
        <input
          className="border rounded px-2 py-1 col-span-2"
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          className="border rounded px-2 py-1"
          placeholder="Пароль (мин. 8 симв.)"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <select
          className="border rounded px-2 py-1"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="EMPLOYEE">Employee</option>
          <option value="MANAGER">Manager</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button className="col-span-2 bg-slate-900 text-white py-2 rounded hover:bg-slate-800">
          Добавить пользователя
        </button>
      </form>

      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id} className="border rounded px-3 py-2 flex justify-between items-center">
            <span>
              {u.firstName} {u.lastName} — {u.email}
            </span>
            <span className="text-xs px-2 py-1 bg-slate-100 rounded">{u.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
