const BASE = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.toString?.() || data.error?.message || "Request failed");
  }
  return data as T;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  isActive?: boolean;
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string };
}

export interface Link {
  id: string;
  url: string;
  label?: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  taskDate: string;
  createdAt: string;
  completedAt?: string | null;
  user?: { id: string; firstName: string; lastName: string };
  comments?: Comment[];
  links?: Link[];
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/auth/me"),

  tasks: (date?: string) => request<{ date: string; tasks: Task[] }>(`/tasks${date ? `?date=${date}` : ""}`),
  history: () => request<{ tasks: Task[] }>("/tasks/history"),
  team: (date?: string) => request<{ date: string; tasks: Task[] }>(`/tasks/team${date ? `?date=${date}` : ""}`),
  createTask: (data: { title: string; description?: string; priority?: string; task_date?: string }) =>
    request<{ task: Task }>("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id: string, data: Partial<{ title: string; description: string; status: string; priority: string }>) =>
    request<{ task: Task }>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTask: (id: string) => request<{ ok: boolean }>(`/tasks/${id}`, { method: "DELETE" }),
  getTask: (id: string) => request<{ task: Task }>(`/tasks/${id}`),

  addComment: (taskId: string, body: string) =>
    request<{ comment: Comment }>(`/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  deleteComment: (taskId: string, commentId: string) =>
    request<{ ok: boolean }>(`/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" }),

  addLink: (taskId: string, data: { url: string; label?: string }) =>
    request<{ link: Link }>(`/tasks/${taskId}/links`, { method: "POST", body: JSON.stringify(data) }),
  deleteLink: (taskId: string, linkId: string) =>
    request<{ ok: boolean }>(`/tasks/${taskId}/links/${linkId}`, { method: "DELETE" }),

  users: () => request<{ users: User[] }>("/users"),
  createUser: (data: { firstName: string; lastName: string; email: string; password: string; role: string }) =>
    request<{ user: User }>("/users", { method: "POST", body: JSON.stringify(data) }),

  webhooks: () => request<{ webhooks: any[] }>("/admin/webhooks"),
  createWebhook: (data: { name: string; url: string; events: string[] }) =>
    request<{ webhook: any }>("/admin/webhooks", { method: "POST", body: JSON.stringify(data) }),
  updateWebhook: (id: string, data: Partial<{ isActive: boolean; events: string[]; url: string; name: string }>) =>
    request<{ webhook: any }>(`/admin/webhooks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteWebhook: (id: string) => request<{ ok: boolean }>(`/admin/webhooks/${id}`, { method: "DELETE" }),
  testWebhook: (id: string) => request<{ log: any }>(`/admin/webhooks/${id}/test`, { method: "POST" }),
  webhookLogs: () => request<{ logs: any[] }>("/admin/webhooks/logs/all"),
};
