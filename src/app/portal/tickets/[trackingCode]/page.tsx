"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Send,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Building,
  Mail,
  Phone,
  Laptop,
  Flame,
  ShieldCheck,
  User,
  Sparkles,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Bug,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { MediaGallery } from "@/components/ui/media-gallery";
import { RichMarkdown } from "@/components/ui/rich-markdown";
import { RichTextToolbar, handleRichTextKeyDown } from "@/components/ui/rich-text-toolbar";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";
import type { CustomerTicketDto, TicketCommentDto } from "@/lib/types";
import { isTicketFinal, TICKET_FINISHED_CUSTOMER_MESSAGE } from "@/lib/ticket-status";
import { TicketStatusBadge, TicketStatusStepper } from "@/components/tickets/ticket-status-ui";

export default function TicketTrackingPage({
  params,
}: {
  params: Promise<{ trackingCode: string }>;
}) {
  const resolvedParams = use(params);
  const trackingCode = decodeURIComponent(resolvedParams.trackingCode).toUpperCase();

  // API tra cứu công khai không trả thông tin dự án nội bộ
  const [ticket, setTicket] = useState<CustomerTicketDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Comment state
  const [replyName, setReplyName] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [commentError, setCommentError] = useState("");
  const replyMessageRef = useRef<HTMLTextAreaElement | null>(null);

  async function loadTicket() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tickets/public/${encodeURIComponent(trackingCode)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không tìm thấy thông tin ticket với mã này");
        setTicket(null);
      } else {
        setTicket(data.ticket);
        if (data.ticket.customerName && !replyName) {
          setReplyName(data.ticket.customerName);
        }
        if (data.ticket.customerEmail && !replyEmail) {
          setReplyEmail(data.ticket.customerEmail);
        }
      }
    } catch (err) {
      console.error("Lỗi khi tải ticket:", err);
      setError("Lỗi kết nối mạng khi tra cứu ticket");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: setState chỉ chạy sau await, rule không phân tích được biên async
    loadTicket();
  }, [trackingCode]);

  async function handleSendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!replyMessage.trim()) return;

    setSendingComment(true);
    setCommentError("");

    try {
      const res = await fetch(`/api/tickets/public/${encodeURIComponent(trackingCode)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: replyName.trim() || ticket?.customerName || "Khách hàng",
          authorEmail: replyEmail.trim() || ticket?.customerEmail || null,
          message: replyMessage.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCommentError(data.error || "Không thể gửi tin nhắn lúc này");
      } else {
        setReplyMessage("");
        await loadTicket();
      }
    } catch (err) {
      console.error("Lỗi gửi phản hồi:", err);
      setCommentError("Lỗi kết nối khi gửi phản hồi");
    } finally {
      setSendingComment(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(trackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Luồng trạng thái dùng chung với nội bộ (src/lib/ticket-status.ts); khách KHÔNG thấy người xử lý / dự án
  const isCancelled = ticket?.status === "CANCELLED";
  const isFinal = isTicketFinal(ticket?.status);

  const priorityMeta: Record<string, { label: string; color: string }> = {
    LOW: { label: "Thấp", color: "bg-slate-500/15 text-slate-600 border-slate-500/30" },
    MEDIUM: { label: "Trung bình", color: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
    HIGH: { label: "Cao", color: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
    URGENT: { label: "Khẩn cấp", color: "bg-accent-subtle text-accent border-[#F05922]/30" },
  };

  const typeMeta: Record<string, { label: string; icon: any }> = {
    BUG: { label: "Lỗi phần mềm", icon: Bug },
    SUPPORT: { label: "Hỗ trợ kỹ thuật", icon: Wrench },
    FEATURE_REQ: { label: "Đề xuất tính năng", icon: Sparkles },
    INQUIRY: { label: "Hỏi đáp & Tư vấn", icon: HelpCircle },
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-[#F05922]/30">
      {/* Header */}
      <header className="border-b border-line bg-surface/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/portal"
              className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-surface-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Gửi yêu cầu mới</span>
            </Link>
            <div className="h-4 w-px bg-line" />
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-accent tracking-wide">{trackingCode}</span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={loadTicket}
            className="text-xs text-muted hover:text-foreground flex items-center gap-1.5 cursor-pointer"
            title="Làm mới trạng thái"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Cập nhật</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-accent animate-spin mx-auto" />
            <p className="text-sm text-muted">Đang tải thông tin tiến độ xử lý...</p>
          </div>
        ) : error || !ticket ? (
          <div className="max-w-md mx-auto py-12 p-6 rounded-2xl border border-[#F05922]/30 bg-surface/90 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-accent-subtle text-accent flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Không tìm thấy mã tra cứu</h2>
            <p className="text-xs text-muted leading-relaxed">
              Mã <span className="font-mono font-bold text-accent">{trackingCode}</span> không tồn tại trong hệ thống hoặc đã bị xóa. Vui lòng kiểm tra lại.
            </p>
            <Link
              href="/portal"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md shadow-[#F05922]/20"
            >
              Quay lại trang gửi báo lỗi
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Title Card */}
            <div className="p-6 rounded-2xl border border-line bg-surface/90 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs font-black text-accent bg-[#F05922]/15 px-2 py-0.5 rounded border border-[#F05922]/30">
                      {ticket.trackingCode}
                    </span>
                    <TicketStatusBadge status={ticket.status} customer className="text-[11px]" />
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${priorityMeta[ticket.priority]?.color}`}>
                      Ưu tiên: {priorityMeta[ticket.priority]?.label || ticket.priority}
                    </span>
                    <span className="text-[11px] font-semibold text-muted bg-surface-2 px-2 py-0.5 rounded border border-line">
                      Loại: {typeMeta[ticket.type]?.label || ticket.type}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{ticket.title}</h1>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyCode}
                    className="h-8 text-xs border-line hover:border-accent text-muted hover:text-foreground cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    <span>{copied ? "Đã chép" : "Sao chép mã"}</span>
                  </Button>
                </div>
              </div>

              {/* Progress Stepper: Mới/Tiếp nhận → Đã tiếp nhận → Đã phân loại → Đang xử lý → Đã đóng (hoặc Đã hủy) */}
              <div className="pt-2">
                <TicketStatusStepper status={ticket.status} progress={ticket.progress} customer />
              </div>
            </div>

            {/* Kết quả Đóng / Hủy: lý do + mô tả từ đội ngũ kỹ thuật */}
            {isFinal && (
              <div
                className={`p-5 rounded-2xl border shadow-sm space-y-2.5 animate-fade-in-up ${
                  isCancelled ? "border-slate-500/40 bg-slate-500/10" : "border-emerald-500/40 bg-emerald-500/10"
                }`}
              >
                <div
                  className={`flex items-center gap-2 ${
                    isCancelled
                      ? "text-slate-300 [[data-theme=light]_&]:text-slate-700"
                      : "text-emerald-400 [[data-theme=light]_&]:text-emerald-700"
                  }`}
                >
                  {isCancelled ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {isCancelled ? "Yêu cầu đã được hủy" : "Kết quả xử lý từ Đội ngũ Kỹ thuật KZTEK"}
                  </span>
                </div>
                {ticket.closeReason && (
                  <div className="text-xs text-foreground">
                    <span className="text-muted">{isCancelled ? "Lý do hủy: " : "Lý do đóng: "}</span>
                    <strong>{ticket.closeReason}</strong>
                  </div>
                )}
                {ticket.resolutionNotes && (
                  <div
                    className={`p-3.5 rounded-xl bg-surface border text-xs sm:text-sm text-foreground leading-relaxed ${
                      isCancelled ? "border-slate-500/25" : "border-emerald-500/25"
                    }`}
                  >
                    <RichMarkdown content={ticket.resolutionNotes} />
                  </div>
                )}
                {(ticket.closedAt || ticket.resolvedAt) && (
                  <p className="text-[10px] text-muted text-right">
                    {isCancelled ? "Thời gian hủy" : "Thời gian đóng"}:{" "}
                    {format(new Date((ticket.closedAt || ticket.resolvedAt) as string), "HH:mm dd/MM/yyyy")}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Issue Detail & Customer Info */}
              <div className="lg:col-span-2 space-y-6">
                {/* Description Box */}
                <div className="p-6 rounded-2xl border border-line bg-surface/90 shadow-xl space-y-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span>Mô tả chi tiết sự cố</span>
                  </h3>
                  <div className="p-4 rounded-xl bg-surface-2 border border-line text-xs sm:text-sm leading-relaxed text-foreground">
                    <RichMarkdown content={ticket.description} />
                  </div>

                  {ticket.environment && (
                    <div className="flex items-center gap-2 text-xs text-muted pt-2">
                      <Laptop className="w-4 h-4 text-muted shrink-0" />
                      <span>Môi trường: <strong className="text-foreground">{ticket.environment}</strong></span>
                    </div>
                  )}

                  {/* Attachments & Media Gallery */}
                  {ticket.attachments && ticket.attachments.length > 0 && (
                    <div className="pt-3 border-t border-line/60">
                      <MediaGallery attachments={ticket.attachments} />
                    </div>
                  )}
                </div>

                {/* Conversation Thread / Comments */}
                <div className="p-6 rounded-2xl border border-line bg-surface/90 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-line/60 pb-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-accent" />
                      <h3 className="text-sm font-bold text-foreground">
                        Trao đổi & Phản hồi ({ticket.comments?.length || 0})
                      </h3>
                    </div>
                    <span className="text-[11px] text-muted">Trực tiếp với Kỹ sư KZTEK</span>
                  </div>

                  {/* Comment Messages List */}
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {!ticket.comments || ticket.comments.length === 0 ? (
                      <p className="text-xs text-muted text-center py-6">
                        Chưa có tin nhắn trao đổi nào. Bạn có thể gửi phản hồi bổ sung bên dưới.
                      </p>
                    ) : (
                      ticket.comments.map((c) => (
                        <div
                          key={c.id}
                          className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-1.5 ${
                            c.isStaff
                              ? "bg-[#F05922]/10 border-[#F05922]/30 ml-4"
                              : "bg-surface-2 border-line mr-4"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground">{c.authorName}</span>
                              {c.isStaff && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-accent text-white">
                                  KZTEK Staff
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted font-mono">
                              {format(new Date(c.createdAt), "HH:mm dd/MM/yyyy")}
                            </span>
                          </div>
                          <div className="text-foreground">
                            <RichMarkdown content={c.message} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Ticket đã Đóng / Hủy: không phản hồi tiếp, mời gửi yêu cầu mới */}
                  {isFinal ? (
                    <div className="pt-3 border-t border-line/60">
                      <div className="p-3 rounded-xl bg-surface-2 border border-line text-xs text-foreground space-y-2">
                        <p className="font-semibold">{TICKET_FINISHED_CUSTOMER_MESSAGE}.</p>
                        <Link
                          href="/portal"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-bold"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Gửi yêu cầu mới</span>
                        </Link>
                      </div>
                    </div>
                  ) : (
                  /* Reply Form */
                  <form onSubmit={handleSendComment} className="pt-3 border-t border-line/60 space-y-3">
                    {commentError && (
                      <p className="text-xs text-accent">{commentError}</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        value={replyName}
                        onChange={(e) => setReplyName(e.target.value)}
                        placeholder="Tên của bạn..."
                        className="h-8 bg-surface-2 border-line text-xs"
                        required
                      />
                      <Input
                        type="email"
                        value={replyEmail}
                        onChange={(e) => setReplyEmail(e.target.value)}
                        placeholder="Email liên hệ..."
                        className="h-8 bg-surface-2 border-line text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <WysiwygEditor
                        uploadUrl="/api/tickets/public/upload"
                        value={replyMessage}
                        onChange={setReplyMessage}
                        placeholder="Nhập nội dung bổ sung thông tin hoặc câu hỏi... (1. 2. 3., in đậm, màu sắc...)"
                        minHeight="90px"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={sendingComment || !replyMessage.trim()}
                        className="h-9 px-4 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md shadow-[#F05922]/20"
                      >
                        {sendingComment ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        <span>Gửi phản hồi</span>
                      </Button>
                    </div>
                  </form>
                  )}
                </div>
              </div>

              {/* Right Column: Ticket Meta & Support Card */}
              <div className="space-y-6">
                {/* Meta Information Card */}
                <div className="p-5 rounded-2xl border border-line bg-surface/90 shadow-xl space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Thông tin liên hệ</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <User className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                      <div>
                        <div className="text-muted text-[10px]">Người gửi</div>
                        <div className="font-bold text-foreground">{ticket.customerName}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Mail className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                      <div>
                        <div className="text-muted text-[10px]">Email</div>
                        <div className="font-mono text-foreground">{ticket.customerEmail}</div>
                      </div>
                    </div>

                    {ticket.customerPhone && (
                      <div className="flex items-start gap-2.5">
                        <Phone className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                        <div>
                          <div className="text-muted text-[10px]">Điện thoại</div>
                          <div className="font-mono text-foreground">{ticket.customerPhone}</div>
                        </div>
                      </div>
                    )}

                    {ticket.customerCompany && (
                      <div className="flex items-start gap-2.5">
                        <Building className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                        <div>
                          <div className="text-muted text-[10px]">Đơn vị / Công ty</div>
                          <div className="font-medium text-foreground">{ticket.customerCompany}</div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2.5 pt-2 border-t border-line/60">
                      <Clock className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                      <div>
                        <div className="text-muted text-[10px]">Thời gian gửi</div>
                        <div className="text-foreground">
                          {format(new Date(ticket.createdAt), "HH:mm dd/MM/yyyy")}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Support Hotline Box */}
                <div className="p-5 rounded-2xl border border-line bg-surface-2/60 space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 text-accent font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Cam kết chất lượng dịch vụ</span>
                  </div>
                  <p className="text-muted leading-relaxed text-[11px]">
                    Đội ngũ kỹ thuật KZTEK cam kết phản hồi các sự cố nghiêm trọng trong vòng 1-2 giờ làm việc.
                  </p>
                  <div className="pt-2 text-[11px] text-muted">
                    Hotline kỹ thuật: <strong className="text-foreground">024 3782 2288</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 KZTEK Enterprise Work Management</span>
          <Link href="/portal" className="text-accent hover:underline">
            Gửi báo lỗi mới
          </Link>
        </div>
      </footer>
    </div>
  );
}
