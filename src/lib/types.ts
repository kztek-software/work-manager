export type UserLite = {
  id: string;
  name: string;
  email?: string;
  avatarColor: string;
  title?: string | null;
  role?: string;
  team?: { id: string; name: string; code?: string; color: string } | null;
};

export type LabelDto = {
  id: string;
  name: string;
  color: string;
};

export type SubtaskDto = {
  id: string;
  title: string;
  done: boolean;
};

export type AttachmentDto = {
  id: string;
  projectId?: string | null;
  taskId?: string | null;
  ticketId?: string | null;
  uploaderId?: string | null;
  fileName: string;
  fileUrl: string;
  fileType: "image" | "video" | "document" | "other" | string;
  fileSize?: number | null;
  mimeType?: string | null;
  createdAt: string;
  uploader?: UserLite | null;
};

export type TaskDto = {
  id: string;
  projectId: string;
  sprintId: string | null;
  number: number;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  storyPoints: number | null;
  position: number;
  assigneeId: string | null;
  creatorId: string;
  contactName?: string | null;
  contactPhone?: string | null;
  dueDate: string | null;
  notionUrl?: string | null;
  notionPageId?: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: UserLite | null;
  labels: { label: LabelDto }[];
  subtasks: SubtaskDto[];
  attachments?: AttachmentDto[];
  customerTicket?: {
    id: string;
    trackingCode: string;
    customerName: string;
    customerEmail: string;
  } | null;
  _count: { comments: number; attachments?: number };
};

export type SprintDto = {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

export type ProjectDto = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  status?: string; // PLANNING | IN_PROGRESS | ON_HOLD | COMPLETED | CANCELLED
  ownerId?: string;
  owner?: UserLite;
  createdAt?: string;
  updatedAt?: string;
  attachments?: AttachmentDto[];
  _count?: {
    tasks?: number;
    members?: number;
    customerTickets?: number;
    attachments?: number;
  };
};

export type MemberDto = {
  id: string;
  role: string;
  user: UserLite;
};

export type ProjectDashboardData = {
  project: ProjectDto & {
    members: {
      id: string;
      role: string;
      user: UserLite & {
        team?: { id: string; name: string; code: string; color: string } | null;
      };
    }[];
  };
  currentRole: string;
  summary: {
    totalTasks: number;
    doneTasks: number;
    inProgressTasks: number;
    inReviewTasks: number;
    todoTasks: number;
    backlogTasks: number;
    overdueTasks: number;
    urgentTasks: number;
    completionRate: number;
    totalStoryPoints: number;
    doneStoryPoints: number;
    remainingStoryPoints: number;
    pointsCompletionRate: number;
  };
  activeSprint: {
    id: string;
    name: string;
    goal: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
    daysRemaining: number | null;
    totalTasks: number;
    doneTasks: number;
    totalPoints: number;
    donePoints: number;
  } | null;
  statusDistribution: { status: string; label: string; count: number; color: string }[];
  priorityDistribution: { priority: string; label: string; count: number; color: string }[];
  typeDistribution: { type: string; label: string; count: number; color: string }[];
  memberWorkloads: {
    userId: string;
    name: string;
    avatarColor: string;
    title: string | null;
    role: string;
    teamName: string | null;
    teamColor: string | null;
    totalTasks: number;
    doneTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    storyPoints: number;
    completionRate: number;
  }[];
  teamBreakdown: {
    id: string;
    name: string;
    code: string;
    color: string;
    memberCount: number;
    totalTasks: number;
    doneTasks: number;
  }[];
  urgentAndOverdueTasks: {
    id: string;
    number: number;
    title: string;
    status: string;
    priority: string;
    type: string;
    dueDate: string | null;
    isOverdue: boolean;
    assignee: UserLite | null;
    storyPoints: number | null;
  }[];
  recentActivities: {
    id: string;
    action: string;
    detail: string | null;
    createdAt: string;
    actor: UserLite;
    task: {
      id: string;
      number: number;
      title: string;
    };
  }[];
  ticketStats: {
    total: number;
    open: number;
    acknowledged: number;
    triaged: number;
    inProgress: number;
    closed: number;
    cancelled: number;
    // % Đã đóng / (Tổng - Đã hủy) — ticket Đã hủy không tính là đã giải quyết
    resolutionRate: number;
  };
};

export type CommentDto = {
  id: string;
  body: string;
  createdAt: string;
  author: UserLite;
};

export type ActivityDto = {
  id: string;
  action?: string;
  detail?: string | null;
  content?: string;
  createdAt: string;
  actor?: UserLite;
  user?: UserLite;
};

export type TicketCommentDto = {
  id: string;
  ticketId: string;
  authorName: string;
  authorEmail?: string | null;
  isStaff: boolean;
  isInternalOnly: boolean;
  message: string;
  createdAt: string;
};

// Quyền thao tác của user hiện tại trên 1 ticket (server tính, UI ẩn/hiện nút)
export type TicketCapabilitiesDto = {
  canWrite: boolean;
  canConvert: boolean;
  canAssign: boolean;
  // Hành động theo luồng trạng thái (đã xét cả trạng thái hiện tại)
  canConfirmPriority: boolean;
  canClaim: boolean;
  canStart: boolean;
  // Đóng: chỉ khi Đang xử lý. Hủy: mọi trạng thái chưa kết thúc.
  canClose: boolean;
  canCancel: boolean;
  canReopen: boolean;
  canAssignHandler: boolean;
};

export type CustomerTicketDto = {
  id: string;
  trackingCode: string;
  projectId?: string | null;
  project?: {
    id: string;
    name: string;
    key: string;
  } | null;
  title: string;
  description: string;
  type: string; // BUG | SUPPORT | INQUIRY | FEATURE_REQ
  status: string; // OPEN | ACKNOWLEDGED | TRIAGED | IN_PROGRESS | CLOSED | CANCELLED (src/lib/ticket-status.ts)
  priority: string; // LOW | MEDIUM | HIGH | URGENT
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  customerCompany?: string | null;
  environment?: string | null;
  convertedTaskId?: string | null;
  convertedTask?: {
    id: string;
    number: number;
    title: string;
    status: string;
    type: string;
  } | null;
  internalNotes?: string | null;
  // Mô tả kết quả khi Đóng / Hủy
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  closeReason?: string | null;
  closedAt?: string | null;
  closedById?: string | null;
  acknowledgedAt?: string | null;
  acknowledgedById?: string | null;
  priorityConfirmedAt?: string | null;
  priorityConfirmedById?: string | null;
  assigneeId?: string | null;
  assignee?: { id: string; name: string; avatarColor: string; title?: string | null } | null;
  startedAt?: string | null;
  // Mốc đã đi qua: Đã tiếp nhận / Đã phân loại / Đã bắt đầu xử lý (stepper, kể cả ticket Đã hủy)
  progress?: { acknowledged: boolean; triaged: boolean; started: boolean };
  createdAt: string;
  updatedAt: string;
  comments?: TicketCommentDto[];
  attachments?: AttachmentDto[];
  _count?: { comments: number };
  // Quyền thao tác của user hiện tại trên ticket (chỉ có ở API nội bộ /api/tickets)
  capabilities?: TicketCapabilitiesDto;
};

export type BoardData = {
  project: ProjectDto;
  tasks: TaskDto[];
  sprints: SprintDto[];
  labels: LabelDto[];
  members: MemberDto[];
  currentRole?: string;
};

// Board Công Việc đa dự án (GET /api/board): dữ liệu phẳng, mỗi bản ghi mang projectId
export type BoardProjectDto = ProjectDto & { currentRole: string };

export type MultiBoardData = {
  projects: BoardProjectDto[];
  tasks: TaskDto[];
  sprints: (SprintDto & { projectId: string })[];
  labels: (LabelDto & { projectId: string })[];
  members: (MemberDto & { projectId: string })[];
};

// Nhãn dự án hiển thị trên thẻ task khi Board xem nhiều dự án
export type TaskProjectTag = { key: string; name: string };
