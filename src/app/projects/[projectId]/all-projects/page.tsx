import { redirect } from "next/navigation";

// Trang đã chuyển ra ngoài dự án: /all-projects (giữ để link/bookmark cũ vẫn dùng được)
export default async function LegacyRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === "string") query.set(k, v);
  }
  const qs = query.toString();
  redirect(qs ? `/all-projects?${qs}` : "/all-projects");
}
