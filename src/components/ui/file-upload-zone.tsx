"use client";

import { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Video,
  X,
  Loader2,
  File,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { AttachmentDto } from "@/lib/types";
import { findOversizedFileError } from "@/lib/upload-limits";

export type UploadedFileItem = {
  id?: string;
  fileName: string;
  fileUrl: string;
  fileType: "image" | "video" | "document" | "other" | string;
  fileSize?: number | null;
  mimeType?: string | null;
};

interface FileUploadZoneProps {
  files: UploadedFileItem[];
  onChange: (files: UploadedFileItem[]) => void;
  maxFiles?: number;
  compact?: boolean;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  /** Endpoint upload — portal khách hàng dùng /api/tickets/public/upload */
  uploadUrl?: string;
}

export function FileUploadZone({
  files,
  onChange,
  maxFiles = 10,
  compact = false,
  label = "Đính kèm ảnh, video quay màn hình hoặc tài liệu lỗi",
  helperText = "Hỗ trợ PNG, JPG, GIF, WebP, MP4, WebM, MOV, PDF, DOCX, XLSX, LOG (Tối đa dưới 50MB/tệp)",
  disabled = false,
  uploadUrl = "/api/upload",
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilesUpload(selectedFiles: FileList | File[]) {
    if (!selectedFiles || selectedFiles.length === 0 || disabled) return;

    if (files.length + selectedFiles.length > maxFiles) {
      setUploadError(`Chỉ được đính kèm tối đa ${maxFiles} tệp tin.`);
      return;
    }

    const oversizedError = findOversizedFileError(Array.from(selectedFiles));
    if (oversizedError) {
      setUploadError(oversizedError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadError("");
    setUploading(true);

    try {
      const formData = new FormData();
      for (let i = 0; i < selectedFiles.length; i++) {
        formData.append("files", selectedFiles[i]);
      }

      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Không thể tải lên tệp tin");
      } else if (data.files) {
        onChange([...files, ...data.files]);
      }
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadError("Lỗi kết nối khi tải lên tệp tin");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  }

  function removeFile(index: number) {
    const next = [...files];
    next.splice(index, 1);
    onChange(next);
  }

  function formatBytes(bytes?: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  return (
    <div className="space-y-2.5">
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <UploadCloud className="w-3.5 h-3.5 text-accent" />
            {label}
          </span>
          <span className="text-[10px] text-muted font-mono">
            {files.length}/{maxFiles} tệp
          </span>
        </div>
      )}

      {/* Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled && !uploading) fileInputRef.current?.click();
        }}
        className={`relative flex flex-col items-center justify-center transition-all cursor-pointer text-center ${
          compact
            ? "p-2 rounded-lg border border-dashed bg-surface/50 hover:bg-surface-2"
            : "p-4 sm:p-5 rounded-xl border-2 border-dashed bg-surface-2/30"
        } ${
          isDragging
            ? "border-accent bg-accent/15 ring-2 ring-accent/30"
            : "border-line hover:border-line-strong hover:bg-surface-2/60"
        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={disabled || uploading}
          onChange={(e) => e.target.files && handleFilesUpload(e.target.files)}
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.log,.csv,.zip,.rar"
          className="hidden"
        />

        {uploading ? (
          <div className="flex items-center gap-2 py-1.5 text-xs font-semibold text-accent animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Đang xử lý tải lên tệp tin...</span>
          </div>
        ) : compact ? (
          <div className="flex items-center justify-center gap-2 py-1 text-xs">
            <div className="flex items-center gap-1.5 text-muted">
              <ImageIcon className="w-3.5 h-3.5 text-accent" />
              <Video className="w-3.5 h-3.5 text-purple-600" />
              <FileText className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="font-semibold text-foreground">
              Kéo thả tệp tin hoặc <span className="text-accent underline font-bold">chọn từ thiết bị</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-surface-3 text-accent border border-line">
                <ImageIcon className="w-3.5 h-3.5" />
              </div>
              <div className="p-1.5 rounded-lg bg-surface-3 text-purple-600 border border-line">
                <Video className="w-3.5 h-3.5" />
              </div>
              <div className="p-1.5 rounded-lg bg-surface-3 text-blue-600 border border-line">
                <FileText className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xs font-bold text-foreground">
              Kéo thả ảnh, video lỗi hoặc <span className="text-accent underline">chọn từ thiết bị</span>
            </div>
            {helperText && (
              <p className="text-[10px] text-muted max-w-md leading-relaxed">{helperText}</p>
            )}
          </div>
        )}
      </div>

      {/* Error Banner */}
      {uploadError && (
        <div className="p-2.5 rounded-lg bg-accent/10 border border-accent/30 text-accent text-xs flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Uploaded Files Preview List */}
      {files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {files.map((file, idx) => {
            const isImage = file.fileType === "image" || file.mimeType?.startsWith("image/");
            const isVideo = file.fileType === "video" || file.mimeType?.startsWith("video/");

            return (
              <div
                key={file.fileUrl || idx}
                className="group relative flex items-center gap-2.5 p-2 rounded-xl border border-line bg-surface-2/70 hover:bg-surface-2 transition-all overflow-hidden"
              >
                {/* Media Thumbnail Preview */}
                <div className="w-12 h-12 rounded-lg bg-surface-3 border border-line/80 overflow-hidden shrink-0 flex items-center justify-center relative">
                  {isImage ? (
                    <img
                      src={file.fileUrl}
                      alt={file.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : isVideo ? (
                    <div className="flex flex-col items-center justify-center text-purple-600">
                      <Video className="w-5 h-5" />
                      <span className="text-[8px] font-mono font-bold">VIDEO</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-blue-600">
                      <FileText className="w-5 h-5" />
                      <span className="text-[8px] font-mono font-bold">DOC</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-foreground group-hover:text-accent transition-colors" title={file.fileName}>
                    {file.fileName}
                  </div>
                  <div className="text-[10px] text-muted font-mono flex items-center gap-1.5 mt-0.5">
                    {formatBytes(file.fileSize)}
                    <span className="text-emerald-600 flex items-center gap-0.5 text-[9px] font-sans">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Đã tải
                    </span>
                  </div>
                </div>

                {/* Remove Button */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(idx);
                    }}
                    className="p-1 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors shrink-0 cursor-pointer"
                    title="Xóa tệp này"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
