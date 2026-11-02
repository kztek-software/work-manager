"use client";

import { useState, useRef } from "react";
import {
  Paperclip,
  Upload,
  Image as ImageIcon,
  Video,
  FileText,
  Trash2,
  Download,
  ExternalLink,
  Loader2,
  X,
  Play,
  FileArchive,
  FileCode,
  Eye,
  Plus,
} from "lucide-react";
import type { AttachmentDto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "primereact/dialog";

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string, fileName: string) {
  if (type === "image") return <ImageIcon className="h-4 w-4 text-emerald-600" />;
  if (type === "video") return <Video className="h-4 w-4 text-purple-600" />;
  if (/\.(zip|rar|7z|tar|gz)$/i.test(fileName)) return <FileArchive className="h-4 w-4 text-amber-600" />;
  if (/\.(json|js|ts|py|c|cpp|cs|html|css|log)$/i.test(fileName)) return <FileCode className="h-4 w-4 text-blue-600" />;
  return <FileText className="h-4 w-4 text-cyan-600" />;
}

export function TaskAttachmentGallery({
  projectId,
  taskId,
  attachments = [],
  onAttachmentChanged,
}: {
  projectId: string;
  taskId: string;
  attachments: AttachmentDto[];
  onAttachmentChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<AttachmentDto | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const images = attachments.filter((a) => a.fileType === "image");
  const videos = attachments.filter((a) => a.fileType === "video");
  const docs = attachments.filter((a) => a.fileType !== "image" && a.fileType !== "video");

  async function handleFilesUpload(files: FileList | File[]) {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("file", files[i]);
      }

      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        onAttachmentChanged();
      }
    } catch (err) {
      console.error("Lỗi khi tải lên file:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function deleteAttachment(attachmentId: string) {
    if (!confirm("Bạn có chắc muốn xóa tệp này?")) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}/attachments?attachmentId=${attachmentId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        onAttachmentChanged();
      }
    } catch (err) {
      console.error("Lỗi khi xóa attachment:", err);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface-2/30 p-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5 text-accent" />
          <span className="text-[11.5px] font-bold text-foreground">
            Tệp, Ảnh & Video Quay Lỗi ({attachments.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleFilesUpload(e.target.files)}
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.log,.zip,.rar,.json"
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="h-8.5 text-xs font-semibold px-3 border-dashed border-accent/40 bg-accent/5 hover:bg-accent/15 text-accent cursor-pointer rounded-xl gap-1.5"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-0.5" />
            ) : (
              <Plus className="h-3.5 w-3.5 mr-0.5" />
            )}
            Đính kèm tệp
          </Button>
        </div>
      </div>

      {/* Drag & Drop Zone when empty or hovering */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFilesUpload(e.dataTransfer.files);
          }
        }}
        onClick={() => attachments.length === 0 && fileInputRef.current?.click()}
        className={`transition-all rounded-lg border border-dashed p-3 text-center ${
          dragOver
            ? "border-accent bg-accent/10"
            : attachments.length === 0
            ? "border-line bg-surface/50 hover:border-accent/50 cursor-pointer"
            : "border-transparent py-0 hidden"
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-1">
          <Upload className="h-5 w-5 text-muted/80" />
          <p className="text-xs font-medium text-foreground">
            Kéo thả ảnh chụp màn hình, video quay lỗi hoặc tệp logs vào đây
          </p>
          <p className="text-[10px] text-muted">
            Hỗ trợ PNG, JPG, MP4, WebM, PDF, Log, Word, Excel, Zip
          </p>
        </div>
      </div>

      {/* Media Grid: Images & Videos */}
      {(images.length > 0 || videos.length > 0) && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Ảnh & Video mô phỏng ({images.length + videos.length})
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[110px] overflow-y-auto no-scrollbar">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative rounded-lg border border-line bg-surface overflow-hidden aspect-[16/10] max-h-[80px] flex items-center justify-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.fileUrl}
                  alt={img.fileName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                  <div className="flex justify-between items-start">
                    <span className="text-[9.5px] text-white/90 font-medium truncate max-w-[80%]">
                      {img.fileName}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAttachment(img.id);
                      }}
                      className="p-0.5 rounded bg-accent/80 hover:bg-accent-hover text-white cursor-pointer"
                      title="Xóa ảnh"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <div className="flex justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewMedia(img)}
                      className="px-1.5 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white text-[9.5px] font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <Eye className="h-2.5 w-2.5" /> Xem
                    </button>
                    <a
                      href={img.fileUrl}
                      download={img.fileName}
                      className="p-1 rounded bg-white/20 hover:bg-white/30 text-white"
                      title="Tải về"
                    >
                      <Download className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}

            {videos.map((vid) => (
              <div
                key={vid.id}
                className="group relative rounded-lg border border-line bg-black/80 overflow-hidden aspect-[16/10] max-h-[80px] flex flex-col items-center justify-center"
              >
                <Video className="h-6 w-6 text-purple-400 opacity-70 group-hover:scale-110 transition-transform" />
                <span className="text-[9.5px] text-white/80 font-medium truncate max-w-[90%] px-1 mt-0.5">
                  {vid.fileName}
                </span>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                  <div className="flex justify-between items-start">
                    <span className="text-[8.5px] text-purple-300 font-mono">
                      {formatFileSize(vid.fileSize)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAttachment(vid.id);
                      }}
                      className="p-0.5 rounded bg-accent/80 hover:bg-accent-hover text-white cursor-pointer"
                      title="Xóa video"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <div className="flex justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewMedia(vid)}
                      className="px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-[9.5px] font-bold flex items-center gap-0.5 cursor-pointer shadow-lg"
                    >
                      <Play className="h-2.5 w-2.5 fill-current" /> Xem
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents & Logs List */}
      {docs.length > 0 && (
        <div className="space-y-1 pt-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Tài liệu & Tệp đính kèm ({docs.length})
          </span>
          <div className="divide-y divide-line/60 rounded-lg border border-line bg-surface max-h-[85px] overflow-y-auto no-scrollbar">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-1.5 hover:bg-surface-2/60 transition-colors text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                  {getFileIcon(doc.fileType, doc.fileName)}
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate text-[11.5px]">{doc.fileName}</div>
                    <div className="text-[9.5px] text-muted font-mono">
                      {formatFileSize(doc.fileSize)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <a
                    href={doc.fileUrl}
                    download={doc.fileName}
                    className="p-1 rounded hover:bg-line text-muted hover:text-foreground cursor-pointer transition-colors"
                    title="Tải về"
                  >
                    <Download className="h-3 w-3" />
                  </a>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 rounded hover:bg-line text-muted hover:text-accent cursor-pointer transition-colors"
                    title="Mở trong tab mới"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => deleteAttachment(doc.id)}
                    className="p-1 rounded hover:bg-accent/20 text-muted hover:text-accent cursor-pointer transition-colors"
                    title="Xóa tệp"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox / Video Modal */}
      <Dialog
        header={previewMedia?.fileName || "Xem trước tệp đính kèm"}
        visible={Boolean(previewMedia)}
        onHide={() => setPreviewMedia(null)}
        className="w-full max-w-4xl border border-line bg-surface rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-2 flex flex-col items-center justify-center max-h-[75vh] overflow-auto">
          {previewMedia?.fileType === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewMedia.fileUrl}
              alt={previewMedia.fileName}
              className="max-h-[70vh] max-w-full rounded-lg object-contain shadow-md"
            />
          )}

          {previewMedia?.fileType === "video" && (
            <video
              src={previewMedia.fileUrl}
              controls
              autoPlay
              className="max-h-[70vh] max-w-full rounded-lg shadow-md bg-black"
            >
              Trình duyệt của bạn không hỗ trợ phát video.
            </video>
          )}

          <div className="flex items-center justify-between w-full pt-3 px-2 text-xs text-muted">
            <span className="font-mono">{formatFileSize(previewMedia?.fileSize)}</span>
            <a
              href={previewMedia?.fileUrl}
              download={previewMedia?.fileName}
              className="inline-flex items-center gap-1 px-3 py-1 rounded bg-accent text-white font-bold hover:bg-accent/90 cursor-pointer"
            >
              <Download className="h-3 w-3" /> Tải tệp xuống
            </a>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
