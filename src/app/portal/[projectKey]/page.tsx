import { redirect } from "next/navigation";

// Portal không còn gắn theo dự án: khách hàng không chọn dự án, ticket được điều phối nội bộ.
// Giữ route cũ /portal/[projectKey] để các link đã chia sẻ vẫn dùng được.
export default function ProjectSpecificPortalPage() {
  redirect("/portal");
}
