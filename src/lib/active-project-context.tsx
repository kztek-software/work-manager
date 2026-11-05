"use client";

import { createContext, useContext } from "react";

/**
 * Dự án ngữ cảnh cho các trang cấp ngoài không có [projectId] trên URL
 * (nhóm "Hệ thống & Tích hợp": /all-projects, /users, /settings, /notion).
 * Layout src/app/(system)/layout.tsx chọn dự án theo cookie flowboard_active_project.
 */
const ActiveProjectContext = createContext<string | null>(null);

export function ActiveProjectProvider({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  return <ActiveProjectContext.Provider value={projectId}>{children}</ActiveProjectContext.Provider>;
}

export function useActiveProjectId(): string {
  const id = useContext(ActiveProjectContext);
  if (!id) throw new Error("useActiveProjectId phải dùng bên trong ActiveProjectProvider");
  return id;
}
