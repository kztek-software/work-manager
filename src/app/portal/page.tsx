"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LifeBuoy,
  Send,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Search,
  ExternalLink,
  ShieldCheck,
  Bug,
  HelpCircle,
  Sparkles,
  MessageSquare,
  Laptop,
  RefreshCw,
  PhoneCall,
  Mail,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadZone, type UploadedFileItem } from "@/components/ui/file-upload-zone";
import { RichMarkdown } from "@/components/ui/rich-markdown";
import { RichTextToolbar, handleRichTextKeyDown } from "@/components/ui/rich-text-toolbar";
import { WysiwygEditor } from "@/components/ui/wysiwyg-editor";

const typeOptions = [
  { id: "BUG", label: "Lỗi phần mềm", icon: Bug, color: "text-accent bg-accent-subtle border-accent/30" },
  { id: "SUPPORT", label: "Hỗ trợ kỹ thuật", icon: HelpCircle, color: "text-blue-600 bg-blue-500/15 border-blue-500/30" },
  { id: "FEATURE_REQ", label: "Đề xuất tính năng", icon: Sparkles, color: "text-purple-600 bg-purple-500/15 border-purple-500/30" },
  { id: "INQUIRY", label: "Hỏi đáp & Tư vấn", icon: MessageSquare, color: "text-cyan-600 bg-cyan-500/15 border-cyan-500/30" },
] as const;

const priorityOptions = [
  { id: "LOW", label: "Thấp", desc: "Không ảnh hưởng nhiều", color: "text-muted border-line hover:border-line-strong" },
  { id: "MEDIUM", label: "Bình thường", desc: "Sự cố trong quá trình dùng", color: "text-blue-600 border-blue-500/30 hover:bg-blue-500/15" },
  { id: "HIGH", label: "Cao", desc: "Ảnh hưởng hoạt động kinh doanh", color: "text-amber-600 border-amber-500/30 hover:bg-amber-500/15" },
  { id: "URGENT", label: "Khẩn cấp", desc: "Hệ thống dừng hoàn toàn", color: "text-accent border-accent/40 hover:bg-accent-subtle font-bold" },
] as const;

export default function CustomerPortalPage() {
  const router = useRouter();

  // Search state
  const [searchCode, setSearchCode] = useState("");
  const [searchError, setSearchError] = useState("");

  // Form state
  const [type, setType] = useState<"BUG" | "SUPPORT" | "FEATURE_REQ" | "INQUIRY">("BUG");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPreviewDescription, setIsPreviewDescription] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const [environment, setEnvironment] = useState("");
  const [attachments, setAttachments] = useState<UploadedFileItem[]>([]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submittedTicket, setSubmittedTicket] = useState<{
    id: string;
    trackingCode: string;
    title: string;
    customerName: string;
    createdAt: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchCode.trim()) {
      setSearchError("Vui lòng nhập mã tra cứu (VD: TK-20260818-XXXX)");
      return;
    }
    setSearchError("");
    const formatted = searchCode.trim().toUpperCase();
    router.push(`/portal/tickets/${encodeURIComponent(formatted)}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!customerName.trim()) {
      setError("Vui lòng nhập họ và tên của bạn");
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes("@")) {
      setError("Vui lòng nhập địa chỉ email hợp lệ để nhận phản hồi");
      return;
    }
    if (!title.trim() || title.trim().length < 3) {
      setError("Tiêu đề sự cố cần ít nhất 3 ký tự");
      return;
    }
    if (!description.trim() || description.trim().length < 5) {
      setError("Vui lòng mô tả chi tiết sự cố gặp phải");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/tickets/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          priority,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim() || null,
          customerCompany: customerCompany.trim() || null,
          title: title.trim(),
          description: description.trim(),
          environment: environment.trim() || null,
          attachments: attachments.map((a) => ({
            fileName: a.fileName,
            fileUrl: a.fileUrl,
            fileType: a.fileType,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Không thể gửi yêu cầu báo lỗi");
        setSubmitting(false);
        return;
      }

      setSubmittedTicket(data.ticket);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      
      // Tự động chuyển hướng đến trang theo dõi tiến độ sau 1.5s
      setTimeout(() => {
        router.push(`/portal/tickets/${encodeURIComponent(data.ticket.trackingCode)}`);
      }, 1200);
    } catch (err) {
      console.error("Lỗi khi gửi ticket:", err);
      setError("Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền.");
      setSubmitting(false);
    }
  }

  function copyTrackingCode() {
    if (!submittedTicket) return;
    navigator.clipboard.writeText(submittedTicket.trackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-accent selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center text-white shadow-lg shadow-accent/20 group-hover:scale-105 transition-transform">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base text-foreground tracking-tight flex items-center gap-1.5">
                <span>KZTEK Service Desk</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-accent/20 text-accent border border-accent/30">
                  Khách Hàng
                </span>
              </div>
              <p className="text-[11px] text-muted hidden sm:block">Trung tâm tiếp nhận & xử lý sự cố kỹ thuật</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold text-muted hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors"
            >
              Dành cho Nhân viên
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:py-12 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2 border border-line text-xs text-muted-light">
            <FileCheck className="w-3.5 h-3.5 text-accent" />
            <span>Phản hồi & Xử lý sự cố kỹ thuật 24/7</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Cổng Báo Cáo Sự Cố & Hỗ Trợ Kỹ Thuật
          </h1>
          <p className="text-xs sm:text-sm text-muted max-w-xl mx-auto leading-relaxed">
            Gửi yêu cầu báo lỗi, sự cố hoặc thắc mắc trực tiếp tới trung tâm kỹ thuật KZTEK. Bạn sẽ nhận được mã tra cứu riêng biệt để theo dõi tiến độ xử lý trực tuyến.
          </p>

          {/* Quick Tracking Search Bar */}
          <div className="pt-4 max-w-xl mx-auto">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <Input
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  placeholder="Nhập mã tra cứu (VD: TK-20260818-XXXX)..."
                  className="pl-10 h-11 bg-surface-3/90 border-line focus:border-accent font-mono text-xs sm:text-sm uppercase"
                />
              </div>
              <Button type="submit" className="h-11 px-5 bg-accent hover:bg-accent-hover text-white font-bold text-xs shrink-0 cursor-pointer shadow-lg shadow-accent/20">
                Tra Cứu
              </Button>
            </form>
            {searchError && <p className="text-xs text-accent mt-1">{searchError}</p>}
          </div>
        </div>

        {/* Success View */}
        {submittedTicket ? (
          <div className="p-8 sm:p-10 rounded-2xl border border-emerald-500/30 bg-surface/95 shadow-2xl animate-fade-in-up text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 [[data-theme=light]_&]:text-emerald-700 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 [[data-theme=light]_&]:text-emerald-700 border border-emerald-500/30">
                Gửi báo lỗi thành công
              </span>
              <h2 className="text-2xl font-black text-foreground tracking-tight">
                Cảm ơn bạn, {submittedTicket.customerName}!
              </h2>
              <p className="text-sm text-muted max-w-md mx-auto">
                Yêu cầu của bạn đã được chuyển tới Ban Quản Trị & Đội ngũ Kỹ thuật KZTEK để tiếp nhận và điều phối xử lý ngay lập tức.
              </p>
            </div>

            {/* Tracking Code Box */}
            <div className="max-w-md mx-auto p-5 rounded-xl border border-line-strong bg-surface-2/90 space-y-2">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                Mã tra cứu tiến độ của bạn
              </span>
              <div className="flex items-center justify-center gap-3">
                <span className="font-mono text-2xl sm:text-3xl font-black text-accent tracking-wider">
                  {submittedTicket.trackingCode}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyTrackingCode}
                  className="h-9 w-9 border-line hover:border-accent text-muted hover:text-foreground cursor-pointer"
                  title="Sao chép mã"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted">
                Hãy lưu lại mã này để theo dõi tiến độ và trao đổi trực tiếp với kỹ sư hỗ trợ.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`/portal/tickets/${submittedTicket.trackingCode}`}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-accent/25 transition-transform hover:scale-105"
              >
                <span>Xem Tiến Độ Xử Lý Ngay</span>
                <ExternalLink className="w-4 h-4" />
              </Link>

              <Button
                variant="ghost"
                onClick={() => {
                  setSubmittedTicket(null);
                  setTitle("");
                  setDescription("");
                  setEnvironment("");
                  setAttachments([]);
                }}
                className="w-full sm:w-auto text-xs text-muted hover:text-foreground cursor-pointer"
              >
                Gửi thêm yêu cầu khác
              </Button>
            </div>
          </div>
        ) : (
          /* Intake Form */
          <div className="rounded-2xl border border-line bg-surface/90 shadow-2xl backdrop-blur-xl overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-line bg-surface-2/40">
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                  Biểu mẫu tiếp nhận trực tuyến
                </span>
              </div>
              <h2 className="text-xl font-bold text-foreground tracking-tight">Gửi Yêu Cầu Hỗ Trợ / Báo Cáo Sự Cố</h2>
              <p className="text-xs sm:text-sm text-muted mt-1">
                Vui lòng cung cấp chi tiết sự cố để đội ngũ kỹ thuật KZTEK kiểm tra và khắc phục nhanh nhất.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
              {error && (
                <div className="p-4 rounded-xl border border-accent/30 bg-accent-subtle text-foreground text-xs flex items-center gap-2.5 animate-fade-in-up">
                  <AlertCircle className="w-4 h-4 shrink-0 text-accent" />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. Loại sự cố (Type) */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Phân loại sự cố</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {typeOptions.map((t) => {
                    const active = type === t.id;
                    const Icon = t.icon;
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => setType(t.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          active
                            ? `${t.color} border-accent ring-1 ring-accent font-bold scale-[1.02]`
                            : "border-line bg-surface-2/60 text-muted hover:border-line-strong hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-5 h-5 mb-1.5" />
                        <span className="text-[11px] leading-tight">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Mức độ ưu tiên (Priority) */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Mức độ ảnh hưởng / Khẩn cấp</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {priorityOptions.map((p) => {
                    const active = priority === p.id;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setPriority(p.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? "border-accent bg-accent/15 text-accent font-bold shadow-md shadow-accent/10"
                            : `border-line bg-surface-2/40 text-muted ${p.color}`
                        }`}
                      >
                        <div className="text-xs font-bold">{p.label}</div>
                        <div className="text-[10px] text-muted truncate">{p.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Thông tin người gửi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-line/60">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                    <span>Họ và tên của bạn</span>
                    <span className="text-accent">*</span>
                  </Label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nguyễn Văn A..."
                    className="h-10 bg-surface-2 border-line text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                    <span>Email nhận kết quả</span>
                    <span className="text-accent">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="nguyenvana@company.com..."
                    className="h-10 bg-surface-2 border-line text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Số điện thoại liên hệ</Label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0912 345 678..."
                    className="h-10 bg-surface-2 border-line text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Đơn vị / Công ty / Chi nhánh</Label>
                  <Input
                    value={customerCompany}
                    onChange={(e) => setCustomerCompany(e.target.value)}
                    placeholder="Tòa nhà Landmark / KZTEK..."
                    className="h-10 bg-surface-2 border-line text-xs"
                  />
                </div>
              </div>

              {/* 4. Chi tiết sự cố */}
              <div className="space-y-4 pt-2 border-t border-line/60">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                    <span>Tóm tắt sự cố (Tiêu đề ngắn gọn)</span>
                    <span className="text-accent">*</span>
                  </Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Không thể xuất báo cáo ra file Excel trên giao diện..."
                    className="h-10 bg-surface-2 border-line text-xs font-semibold"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                      <span>Mô tả chi tiết & Các bước tái hiện lỗi</span>
                      <span className="text-accent">*</span>
                    </Label>
                    <span className="text-[10px] text-muted">1. 2. 3., in đậm, màu trực quan</span>
                  </div>

                  <WysiwygEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="Mô tả cụ thể: 1. Bạn đang thao tác ở màn hình nào? 2. Các bước thực hiện gây ra lỗi? 3. Kết quả mong đợi và kết quả thực tế xảy ra? (Định dạng trực quan: in đậm, màu chữ, 1. 2. 3....)"
                    minHeight="120px"
                  />
                </div>

                {/* Upload File / Ảnh / Video lỗi bên cạnh mô tả */}
                <FileUploadZone
                  files={attachments}
                  onChange={setAttachments}
                  maxFiles={8}
                  label="Đính kèm hình ảnh, video quay lỗi hoặc tài liệu (Khuyên dùng)"
                  helperText="Kéo thả hoặc tải lên ảnh chụp màn hình, video quay lỗi hoặc file log để kỹ thuật xử lý nhanh nhất"
                />

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Laptop className="w-3.5 h-3.5 text-muted" />
                    <span>Môi trường / Thiết bị sử dụng (Tùy chọn)</span>
                  </Label>
                  <Input
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    placeholder="Ví dụ: Windows 11, Google Chrome 120, Máy trạm số 02..."
                    className="h-10 bg-surface-2 border-line text-xs"
                  />
                </div>
              </div>

              {/* Error Banner at bottom near submit button */}
              {error && (
                <div className="p-4 rounded-xl border border-accent/30 bg-accent-subtle text-foreground text-xs flex items-center gap-2.5 animate-fade-in-up">
                  <AlertCircle className="w-4 h-4 shrink-0 text-accent" />
                  <span className="font-semibold">{error}</span>
                </div>
              )}

              {/* Submit Action */}
              <div className="pt-4 border-t border-line/60 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Thông tin của bạn được bảo mật tuyệt đối</span>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 px-7 bg-accent hover:bg-accent-hover text-white font-bold text-xs rounded-xl shadow-lg shadow-accent/25 cursor-pointer flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang gửi...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Gửi Báo Lỗi Ngay</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Public Footer */}
      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 KZTEK Enterprise Work Management. All rights reserved.</span>
          <span className="text-accent font-medium">Trung tâm Hỗ trợ Kỹ thuật & Bảo hành</span>
        </div>
      </footer>
    </div>
  );
}
