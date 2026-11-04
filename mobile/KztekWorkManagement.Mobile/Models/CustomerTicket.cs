using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace KztekWorkManagement.Mobile.Models
{
    public class CustomerTicket
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("trackingCode")]
        public string TrackingCode { get; set; } = string.Empty;

        [JsonPropertyName("projectId")]
        public string? ProjectId { get; set; }

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("description")]
        public string Description { get; set; } = string.Empty;

        [JsonPropertyName("type")]
        public string Type { get; set; } = "BUG";

        [JsonPropertyName("status")]
        public string Status { get; set; } = "OPEN";

        [JsonPropertyName("priority")]
        public string Priority { get; set; } = "MEDIUM";

        [JsonPropertyName("customerName")]
        public string CustomerName { get; set; } = string.Empty;

        [JsonPropertyName("customerEmail")]
        public string CustomerEmail { get; set; } = string.Empty;

        [JsonPropertyName("customerPhone")]
        public string? CustomerPhone { get; set; }

        [JsonPropertyName("customerCompany")]
        public string? CustomerCompany { get; set; }

        [JsonPropertyName("createdAt")]
        public DateTime CreatedAt { get; set; }

        // Quyền thao tác do server tính (luồng trạng thái ticket)
        [JsonPropertyName("capabilities")]
        public TicketCapabilities? Capabilities { get; set; }

        [JsonIgnore]
        public bool CanClose => Capabilities?.CanClose ?? false;

        [JsonIgnore]
        public bool CanCancel => Capabilities?.CanCancel ?? false;
    }

    public class TicketCapabilities
    {
        // Đóng: chỉ khi ticket Đang xử lý
        [JsonPropertyName("canClose")]
        public bool CanClose { get; set; }

        // Hủy: mọi trạng thái chưa kết thúc
        [JsonPropertyName("canCancel")]
        public bool CanCancel { get; set; }
    }

    public class TicketsResponse
    {
        [JsonPropertyName("tickets")]
        public List<CustomerTicket>? Tickets { get; set; }
    }

    public class NotificationItem
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;

        [JsonPropertyName("read")]
        public bool Read { get; set; }

        [JsonPropertyName("link")]
        public string? Link { get; set; }

        [JsonPropertyName("createdAt")]
        public DateTime CreatedAt { get; set; }
    }

    public class NotificationsResponse
    {
        [JsonPropertyName("notifications")]
        public List<NotificationItem>? Notifications { get; set; }

        [JsonPropertyName("unreadCount")]
        public int UnreadCount { get; set; }
    }
}
