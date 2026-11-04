using System.Collections.Generic;
using System.Threading.Tasks;
using KztekWorkManagement.Mobile.Models;

namespace KztekWorkManagement.Mobile.Services
{
    public interface IProjectService
    {
        Task<List<Project>> GetProjectsAsync();
        Task<Project?> CreateProjectAsync(string name, string key, string? description);
    }

    public class ProjectService : IProjectService
    {
        private readonly IApiService _apiService;

        public ProjectService(IApiService apiService)
        {
            _apiService = apiService;
        }

        public async Task<List<Project>> GetProjectsAsync()
        {
            var res = await _apiService.GetAsync<ProjectsResponse>("api/projects");
            return res?.Projects ?? new List<Project>();
        }

        public async Task<Project?> CreateProjectAsync(string name, string key, string? description)
        {
            var payload = new { name, key, description, status = "PLANNING" };
            var res = await _apiService.PostAsync<Dictionary<string, Project>>("api/projects", payload);
            if (res != null && res.TryGetValue("project", out var proj))
            {
                return proj;
            }
            return null;
        }
    }

    public interface ITaskService
    {
        Task<List<TaskItem>> GetTasksAsync(string projectId, string? status = null, string? priority = null);
        Task<TaskItem?> GetTaskDetailAsync(string projectId, string taskId);
        Task<TaskItem?> CreateTaskAsync(string projectId, string title, string? description, string type, string status, string priority, string? sprintId = null);
        Task<TaskItem?> UpdateTaskStatusAsync(string projectId, string taskId, string newStatus);
        Task<bool> AddCommentAsync(string projectId, string taskId, string commentBody);
    }

    public class TaskService : ITaskService
    {
        private readonly IApiService _apiService;

        public TaskService(IApiService apiService)
        {
            _apiService = apiService;
        }

        public async Task<List<TaskItem>> GetTasksAsync(string projectId, string? status = null, string? priority = null)
        {
            var query = $"api/projects/{projectId}/tasks";
            var paramsList = new List<string>();
            if (!string.IsNullOrEmpty(status)) paramsList.Add($"status={status}");
            if (!string.IsNullOrEmpty(priority)) paramsList.Add($"priority={priority}");

            if (paramsList.Count > 0)
            {
                query += "?" + string.Join("&", paramsList);
            }

            var res = await _apiService.GetAsync<TasksResponse>(query);
            return res?.Tasks ?? new List<TaskItem>();
        }

        public async Task<TaskItem?> GetTaskDetailAsync(string projectId, string taskId)
        {
            var res = await _apiService.GetAsync<Dictionary<string, TaskItem>>($"api/projects/{projectId}/tasks/{taskId}");
            if (res != null && res.TryGetValue("task", out var task))
            {
                return task;
            }
            return null;
        }

        public async Task<TaskItem?> CreateTaskAsync(string projectId, string title, string? description, string type, string status, string priority, string? sprintId = null)
        {
            var payload = new
            {
                title,
                description,
                type = string.IsNullOrEmpty(type) ? "TASK" : type,
                status = string.IsNullOrEmpty(status) ? "TODO" : status,
                priority = string.IsNullOrEmpty(priority) ? "MEDIUM" : priority,
                sprintId
            };

            var res = await _apiService.PostAsync<Dictionary<string, TaskItem>>($"api/projects/{projectId}/tasks", payload);
            if (res != null && res.TryGetValue("task", out var task))
            {
                return task;
            }
            return null;
        }

        public async Task<TaskItem?> UpdateTaskStatusAsync(string projectId, string taskId, string newStatus)
        {
            var payload = new { status = newStatus };
            var res = await _apiService.PatchAsync<Dictionary<string, TaskItem>>($"api/projects/{projectId}/tasks/{taskId}", payload);
            if (res != null && res.TryGetValue("task", out var task))
            {
                return task;
            }
            return null;
        }

        public async Task<bool> AddCommentAsync(string projectId, string taskId, string commentBody)
        {
            var payload = new { body = commentBody };
            var res = await _apiService.PostAsync<object>($"api/projects/{projectId}/tasks/{taskId}/comments", payload);
            return res != null;
        }
    }

    public interface ITicketService
    {
        Task<List<CustomerTicket>> GetTicketsAsync(string? status = null, string? priority = null, string? search = null);
        Task<CustomerTicket?> GetTicketAsync(string ticketIdOrCode);
        // Luồng trạng thái mới: không đổi status tự do. Đóng / Hủy bắt buộc lý do + mô tả (POST api/tickets/{id}/actions).
        // action: "close" | "cancel". Trả về null nếu thành công, ngược lại là thông báo lỗi từ server.
        Task<string?> FinishTicketAsync(string ticketId, string action, string reason, string descriptionHtml);
    }

    public class TicketService : ITicketService
    {
        private readonly IApiService _apiService;

        public TicketService(IApiService apiService)
        {
            _apiService = apiService;
        }

        public async Task<List<CustomerTicket>> GetTicketsAsync(string? status = null, string? priority = null, string? search = null)
        {
            var query = "api/tickets";
            var pList = new List<string>();
            if (!string.IsNullOrEmpty(status) && status != "ALL") pList.Add($"status={status}");
            if (!string.IsNullOrEmpty(priority) && priority != "ALL") pList.Add($"priority={priority}");
            if (!string.IsNullOrEmpty(search)) pList.Add($"search={Uri.EscapeDataString(search)}");

            if (pList.Count > 0) query += "?" + string.Join("&", pList);

            var res = await _apiService.GetAsync<TicketsResponse>(query);
            return res?.Tickets ?? new List<CustomerTicket>();
        }

        public async Task<CustomerTicket?> GetTicketAsync(string ticketIdOrCode)
        {
            var res = await _apiService.GetAsync<Dictionary<string, CustomerTicket>>($"api/tickets/{ticketIdOrCode}");
            if (res != null && res.TryGetValue("ticket", out var ticket)) return ticket;
            return null;
        }

        public async Task<string?> FinishTicketAsync(string ticketId, string action, string reason, string descriptionHtml)
        {
            var payload = new { action, reason, description = descriptionHtml };
            try
            {
                await _apiService.PostAsync<object>($"api/tickets/{ticketId}/actions", payload);
                return null;
            }
            catch (System.Net.Http.HttpRequestException ex)
            {
                // ApiService ném "API Error (...): {json}" -> lấy trường "error" nếu có
                var msg = ex.Message;
                var idx = msg.IndexOf('{');
                if (idx >= 0)
                {
                    try
                    {
                        using var doc = System.Text.Json.JsonDocument.Parse(msg.Substring(idx));
                        if (doc.RootElement.TryGetProperty("error", out var err)) return err.GetString() ?? msg;
                    }
                    catch (System.Text.Json.JsonException) { }
                }
                return msg;
            }
        }
    }

    public interface INotificationService
    {
        Task<List<NotificationItem>> GetNotificationsAsync();
        Task<bool> MarkAsReadAsync(string notificationId);
    }

    public class NotificationService : INotificationService
    {
        private readonly IApiService _apiService;

        public NotificationService(IApiService apiService)
        {
            _apiService = apiService;
        }

        public async Task<List<NotificationItem>> GetNotificationsAsync()
        {
            var res = await _apiService.GetAsync<NotificationsResponse>("api/notifications");
            return res?.Notifications ?? new List<NotificationItem>();
        }

        public async Task<bool> MarkAsReadAsync(string notificationId)
        {
            var res = await _apiService.PatchAsync<object>($"api/notifications/{notificationId}", new { read = true });
            return res != null;
        }
    }
}
