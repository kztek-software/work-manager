"use client";

import Link from "next/link";
import { ShieldCheck, ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F05922] font-black text-white text-xl shadow-lg shadow-[#F05922]/20">
            KZ
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">KZTEK Work Management</h1>
            <p className="text-xs text-muted mt-0.5">Hệ thống điều hành & quản lý công việc nội bộ</p>
          </div>
        </div>

        {/* Security Notification Card */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Đăng ký tài khoản bị khóa</h2>
              <p className="text-xs text-muted">Chính sách bảo mật hệ thống nội bộ</p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs space-y-2 text-foreground">
            <div className="flex items-center gap-2 font-semibold text-amber-600">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Tài khoản do Quản trị viên cấp phát</span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Tính năng tự đăng ký công khai đã được khóa nhằm đảm bảo an ninh mạng nội bộ KZTEK.
              Toàn bộ tài khoản và quyền hạn truy cập được khởi tạo tập trung bởi Quản trị viên (ADMIN).
            </p>
          </div>

          <div className="text-xs text-muted space-y-1.5 bg-surface-2/50 p-3.5 rounded-xl border border-line/60">
            <div className="font-semibold text-foreground text-[11px]">Hướng dẫn cấp tài khoản:</div>
            <ul className="list-disc list-inside text-[11px] space-y-1 text-muted-foreground">
              <li>Nhân viên mới: Liên hệ người quản lý bộ phận hoặc Admin hệ thống.</li>
              <li>Khách hàng gửi yêu cầu: Sử dụng cổng gửi Ticket hỗ trợ công khai.</li>
            </ul>
          </div>

          <div className="pt-2">
            <Link href="/login" className="w-full block">
              <Button className="w-full h-9 text-xs font-bold gap-2">
                <ArrowLeft className="h-4 w-4" />
                Quay lại trang Đăng nhập
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
