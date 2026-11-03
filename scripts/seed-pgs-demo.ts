import "../prisma/load-env";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== BẮT ĐẦU TẠO DỮ LIỆU MẪU HỆ THỐNG PGS VÀO DATABASE ===");

  // 1. Lấy thông tin các Users có sẵn
  const users = await prisma.user.findMany();
  if (users.length === 0) {
    throw new Error("Chưa có User nào trong DB!");
  }
  const admin = users.find((u) => u.role === "ADMIN") || users[0];
  const devBinh = users.find((u) => u.email.includes("binh")) || users[0];
  const devChi = users.find((u) => u.email.includes("chi")) || users[0];
  const pmAlice = users.find((u) => u.email.includes("alice")) || admin;

  console.log(`- Chủ sở hữu dự án: ${admin.name} (${admin.email})`);
  console.log(`- PM: ${pmAlice.name}`);
  console.log(`- Dev: ${devBinh.name}, ${devChi.name}`);

  // 2. Kiểm tra xem Project PGS đã tồn tại chưa, nếu có thì dọn sạch để seed mới
  const existingProject = await prisma.project.findUnique({
    where: { key: "PGS" },
    include: { tasks: true, sprints: true, labels: true },
  });

  if (existingProject) {
    console.log("ℹ️ Đã tồn tại dự án PGS cũ. Đang dọn dẹp để khởi tạo dữ liệu mẫu chuẩn...");
    await prisma.project.delete({ where: { key: "PGS" } });
  }

  // 3. Tạo mới Project PGS
  const project = await prisma.project.create({
    data: {
      name: "Hệ thống Hướng dẫn Báo chỗ đỗ xe - iPGS",
      key: "PGS",
      description: `Hệ thống quản lý, giám sát và hướng dẫn đỗ xe thông minh (Parking Guidance System).
Bao gồm:
- CCU (Central Control Unit): Điều phối trung tâm, thuật toán vị trí đỗ.
- ZCU (Zone Control Unit): Thu thập cảm biến siêu âm / camera nhận diện, điều khiển LED chỉ dẫn.
- KIOSK: Tra cứu vị trí xe (Find My Car), bản đồ dẫn đường, tích hợp thanh toán VietQR.
- IPGS.API: Cổng dịch vụ tập trung, kết nối ứng dụng Mobile và hệ thống quản lý tòa nhà (BMS).`,
      status: "IN_PROGRESS",
      ownerId: admin.id,
      members: {
        create: [
          { userId: admin.id, role: "OWNER" },
          { userId: pmAlice.id, role: "ADMIN" },
          { userId: devBinh.id, role: "MEMBER" },
          { userId: devChi.id, role: "MEMBER" },
        ],
      },
    },
  });
  console.log(`✅ Đã tạo Dự án: [${project.key}] ${project.name}`);

  // 4. Tạo bộ Nhãn (Labels) chuẩn hóa
  const labelsData = [
    { name: "comp:ccu", color: "#F05922" },      // Cam KZTEK
    { name: "comp:zcu", color: "#0284C7" },      // Xanh dương
    { name: "comp:kiosk", color: "#10B981" },    // Xanh lá
    { name: "comp:api", color: "#8B5CF6" },      // Tím
    { name: "comp:shared", color: "#64748B" },   // Xám
    { name: "tech:winforms", color: "#F59E0B" }, // Vàng cam
    { name: "tech:avalonia", color: "#EC4899" }, // Hồng
    { name: "tech:dotnet-api", color: "#6366F1"},// Indigo
    { name: "kind:hardware", color: "#EF4444" }, // Đỏ
    { name: "kind:feature", color: "#22C55E" },  // Xanh lục
    { name: "kind:refactor", color: "#EAB308" }, // Vàng chanh
  ];

  const labelsMap = new Map<string, string>();
  for (const lb of labelsData) {
    const createdLabel = await prisma.label.create({
      data: {
        projectId: project.id,
        name: lb.name,
        color: lb.color,
      },
    });
    labelsMap.set(lb.name, createdLabel.id);
  }
  console.log(`✅ Đã tạo ${labelsMap.size} nhãn phân loại (Labels).`);

  // 5. Tạo các Sprint đại diện cho các giai đoạn
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  // Sprint 1: WinForms Foundation (Đã xong trong quá khứ)
  const sprint1 = await prisma.sprint.create({
    data: {
      projectId: project.id,
      name: "Sprint 1: Nền tảng WinForms CCU & ZCU",
      goal: "Xây dựng driver giao tiếp cảm biến siêu âm, bộ điều khiển trung tâm CCU và hiển thị LED Zone trên WinForms.",
      status: "COMPLETED",
      startDate: daysAgo(60),
      endDate: daysAgo(46),
    },
  });

  // Sprint 2: Kiosk WinForms (Đã xong trong quá khứ)
  const sprint2 = await prisma.sprint.create({
    data: {
      projectId: project.id,
      name: "Sprint 2: Kiosk WinForms Ngang & Dọc",
      goal: "Phát triển 2 ứng dụng Kiosk tìm xe WinForms riêng biệt (Màn hình ngang 1920x1080 và Màn hình dọc 1080x1920).",
      status: "COMPLETED",
      startDate: daysAgo(45),
      endDate: daysAgo(31),
    },
  });

  // Sprint 3: Avalonia Migration (ĐANG DIỄN RA - ACTIVE)
  const sprint3 = await prisma.sprint.create({
    data: {
      projectId: project.id,
      name: "Sprint 3: Hợp nhất Kiosk Avalonia Multiplatform",
      goal: "Chuyển đổi giao diện Kiosk sang Avalonia XAML, hợp nhất bản ngang và dọc thành 1 ứng dụng responsive duy nhất.",
      status: "ACTIVE",
      startDate: daysAgo(7),
      endDate: daysFromNow(7),
    },
  });

  // Sprint 4: Centralized API (SẮP TỚI - PLANNING)
  const sprint4 = await prisma.sprint.create({
    data: {
      projectId: project.id,
      name: "Sprint 4: Phát triển IPGS.API & Dữ liệu tập trung",
      goal: "Xây dựng REST API Core, kết nối cơ sở dữ liệu dùng chung IPGS.Data và tích hợp cổng thanh toán VietQR.",
      status: "PLANNING",
      startDate: daysFromNow(8),
      endDate: daysFromNow(22),
    },
  });

  console.log("✅ Đã tạo 4 Sprint (2 Completed, 1 Active, 1 Planning).");

  // 6. Danh sách các Tasks mẫu chi tiết
  interface TaskSeedItem {
    number: number;
    title: string;
    description: string;
    type: "EPIC" | "STORY" | "TASK" | "BUG";
    status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    storyPoints: number;
    sprintId?: string;
    assigneeId?: string;
    labels: string[];
    subtasks?: { title: string; done: boolean }[];
  }

  const tasksData: TaskSeedItem[] = [
    // --- Giai đoạn 1 (Sprint 1 - DONE) ---
    {
      number: 1,
      title: "Xây dựng Driver giao tiếp COM/RS485 cho cảm biến siêu âm & bảng LED ZCU",
      description: `Lập trình giao thức truyền thông nhị phân qua cổng Serial Port (RS485) kết nối từ bo mạch ZCU tới các cảm biến siêu âm gắn tại từng vị trí đỗ.
**Yêu cầu kỹ thuật:**
- Quản lý baudrate 9600 / 19200 / 38400 bps.
- Xử lý bộ đệm chống tràn khung tin khi 64 cảm biến truyền dữ liệu liên tục.
- Tự động phát hiện cảm biến mất kết nối (Timeout sau 3 chu kỳ poll).`,
      type: "TASK",
      status: "DONE",
      priority: "HIGH",
      storyPoints: 8,
      sprintId: sprint1.id,
      assigneeId: devBinh.id,
      labels: ["comp:zcu", "tech:winforms", "kind:hardware"],
      subtasks: [
        { title: "Viết Protocol Parser giải mã byte bản tin cảm biến", done: true },
        { title: "Tạo luồng Background Worker đọc cổng COM liên tục", done: true },
        { title: "Test thực tế với 16 cảm biến tại phòng Lab", done: true },
      ],
    },
    {
      number: 2,
      title: "Thuật toán tổng hợp số chỗ trống và điều phối luồng xe tại CCU",
      description: `Xây dựng bộ xử lý logic trung tâm tại CCU để nhận bản tin tổng hợp từ các ZCU theo từng tầng/khu vực.
- Tính toán tổng số slot trống theo phân loại: Xe ô tô con, Xe VIP, Xe người khuyết tật.
- Điều khiển bảng LED tổng ngoài cổng hầm hiển thị số chỗ trống còn lại.`,
      type: "TASK",
      status: "DONE",
      priority: "HIGH",
      storyPoints: 5,
      sprintId: sprint1.id,
      assigneeId: devBinh.id,
      labels: ["comp:ccu", "tech:winforms"],
      subtasks: [
        { title: "Thiết kế Data Model quản lý Zone và Slot trong Memory", done: true },
        { title: "Xử lý đồng bộ dữ liệu đa luồng (Thread-safe Lock)", done: true },
      ],
    },

    // --- Giai đoạn 1 (Sprint 2 - DONE) ---
    {
      number: 3,
      title: "Thiết kế giao diện WinForms Kiosk ngang (1920x1080) tra cứu vị trí xe",
      description: `Phát triển ứng dụng Kiosk WinForms cho màn hình ngang. Người dùng gõ biển số xe để tìm vị trí và xem sơ đồ hướng dẫn đường đi tới ô đỗ xe.`,
      type: "TASK",
      status: "DONE",
      priority: "MEDIUM",
      storyPoints: 5,
      sprintId: sprint2.id,
      assigneeId: devChi.id,
      labels: ["comp:kiosk", "tech:winforms", "kind:feature"],
      subtasks: [
        { title: "Kéo thả giao diện Windows Form kích thước cố định 1920x1080", done: true },
        { title: "Tích hợp bàn phím ảo WinForms cảm ứng cho màn hình Touch", done: true },
        { title: "Vẽ sơ đồ chỉ đường đơn giản bằng GDI+", done: true },
      ],
    },
    {
      number: 4,
      title: "Nhân bản và chỉnh sửa giao diện Kiosk dọc (1080x1920) độc lập",
      description: `Nhân bản project Kiosk ngang sang project Kiosk dọc do giới hạn của WinForms không hỗ trợ responsive bố cục đứng. Cần bảo trì song song 2 codebases.`,
      type: "TASK",
      status: "DONE",
      priority: "MEDIUM",
      storyPoints: 5,
      sprintId: sprint2.id,
      assigneeId: devChi.id,
      labels: ["comp:kiosk", "tech:winforms"],
      subtasks: [
        { title: "Thiết kế Form Kiosk dọc 1080x1920", done: true },
        { title: "Sắp xếp bản đồ lên trên, bàn phím số xuống dưới", done: true },
      ],
    },

    // --- Giai đoạn 2 (Sprint 3 - ACTIVE / ĐANG THỰC HIỆN) ---
    {
      number: 5,
      title: "EPIC: Hiện đại hóa giao diện & Đa nền tảng Kiosk (Avalonia Migration)",
      description: `Mục tiêu chuyển đổi toàn bộ giao diện Kiosk tìm xe từ WinForms sang Avalonia UI (.NET 8):
- Cho phép chạy trên Linux x64/ARM64 (Raspberry Pi/IPC nhúng) giúp giảm chi phí bản quyền Windows.
- Hợp nhất 2 bản Kiosk ngang và dọc thành 1 ứng dụng duy nhất có khả năng tự co giãn (Responsive Layout).`,
      type: "EPIC",
      status: "IN_PROGRESS",
      priority: "URGENT",
      storyPoints: 13,
      sprintId: sprint3.id,
      assigneeId: devBinh.id,
      labels: ["comp:kiosk", "tech:avalonia", "kind:refactor"],
    },
    {
      number: 6,
      title: "Thiết lập Design Tokens IPGS.Theme trên hệ thiết kế KztekComponentAvalonia",
      description: `Định nghĩa bộ Token màu sắc và giao diện chuẩn tại thư mục THEME/:
- Primary: #F05922 (Cam KZTEK)
- Dark Navy Background: #0B1120
- Bo góc các thẻ card 12px, nút bấm lớn tối ưu cho thao tác cảm ứng một chạm.`,
      type: "TASK",
      status: "DONE",
      priority: "MEDIUM",
      storyPoints: 3,
      sprintId: sprint3.id,
      assigneeId: devChi.id,
      labels: ["comp:kiosk", "tech:avalonia"],
      subtasks: [
        { title: "Tạo file Colors.axaml và Styles.axaml", done: true },
        { title: "Liên kết với thư viện KztekComponentAvalonia", done: true },
      ],
    },
    {
      number: 7,
      title: "Hợp nhất 2 bản Kiosk ngang/dọc thành 1 ứng dụng Avalonia thích ứng (Responsive)",
      description: `Sử dụng Adaptive Grid và Orientation Trigger trong XAML:
- Khi màn hình tỷ lệ Ngang (Aspect Ratio > 1): Tự bố trí Bản đồ bên phải (65%), Bảng tìm kiếm bên trái (35%).
- Khi màn hình tỷ lệ Dọc (Aspect Ratio < 1): Tự bố trí Bản đồ bên trên (55%), Bảng tìm kiếm bên dưới (45%).
- Không cần build 2 file exe riêng biệt!`,
      type: "STORY",
      status: "IN_REVIEW",
      priority: "HIGH",
      storyPoints: 8,
      sprintId: sprint3.id,
      assigneeId: devBinh.id,
      labels: ["comp:kiosk", "tech:avalonia", "kind:feature"],
      subtasks: [
        { title: "Xây dựng MainWindow.axaml với ViewBox và Grid động", done: true },
        { title: "Viết Behavior tự bắt sự kiện SizeChanged để đổi Layout", done: true },
        { title: "Kiểm thử hiển thị trên 2 độ phân giải Full HD Ngang và Dọc", done: false },
      ],
    },
    {
      number: 8,
      title: "Tích hợp bàn phím ảo cảm ứng KzVirtualKeyboard trên Avalonia",
      description: `Tạo UserControl bàn phím ảo tiếng Việt/Anh hỗ trợ nhập biển số xe nhanh chóng (các phím số to, có gợi ý ký tự thông dụng).`,
      type: "TASK",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      storyPoints: 5,
      sprintId: sprint3.id,
      assigneeId: devChi.id,
      labels: ["comp:kiosk", "tech:avalonia"],
      subtasks: [
        { title: "Thiết kế bàn phím số kết hợp chữ cái", done: true },
        { title: "Xử lý phím Backspace, Clear và Enter", done: true },
        { title: "Hiệu ứng âm thanh click nhẹ khi chạm phím", done: false },
      ],
    },
    {
      number: 9,
      title: "Viết bộ 39 Unit Tests kiểm thử Logic tìm xe Kiosk (IPGS.Kiosk.Tests)",
      description: `Đảm bảo hàm tìm kiếm biển số xe hoạt động chính xác với các trường hợp: tìm kiếm chính xác, tìm kiếm 4 số cuối, tìm kiếm không phân biệt hoa thường và xử lý khi không tìm thấy xe.`,
      type: "TASK",
      status: "TODO",
      priority: "HIGH",
      storyPoints: 3,
      sprintId: sprint3.id,
      assigneeId: devChi.id,
      labels: ["comp:kiosk", "tech:avalonia"],
      subtasks: [
        { title: "Viết Test Case tìm xe theo biển số đầy đủ", done: false },
        { title: "Viết Test Case tìm xe theo 4 số cuối", done: false },
        { title: "Viết Test Case trả về kết quả rỗng khi không có xe", done: false },
      ],
    },
    {
      number: 10,
      title: "Đóng gói ứng dụng Kiosk Avalonia chạy thử nghiệm trên Linux Ubuntu",
      description: `Cấu hình dotnet publish chế độ self-contained trên Ubuntu 22.04 LTS x64:
- Kiểm tra tính tương thích của SkiaSharp khi render đồ họa trên Linux.
- Thiết lập script tự khởi động toàn màn hình (Kiosk Mode không có thanh taskbar).`,
      type: "TASK",
      status: "TODO",
      priority: "MEDIUM",
      storyPoints: 5,
      sprintId: sprint3.id,
      assigneeId: devBinh.id,
      labels: ["comp:kiosk", "tech:avalonia"],
    },

    // --- Giai đoạn 3 (Sprint 4 - PLANNING / KẾ HOẠCH TIẾP THEO) ---
    {
      number: 11,
      title: "Thiết kế lớp dữ liệu dùng chung IPGS.Core và IPGS.Data (Entity Framework)",
      description: `Tách các Model và Repository từ CCU/ZCU cũ vào thư mục dùng chung CORE/ và DATA/:
- Entity: PgsZone, PgsSlot, PgsSensor, PgsVehicleHistory, PgsDevice.
- Cấu hình kết nối SQL Server và SQLite dự phòng khi đứt mạng trung tâm.`,
      type: "TASK",
      status: "TODO",
      priority: "HIGH",
      storyPoints: 5,
      sprintId: sprint4.id,
      assigneeId: devBinh.id,
      labels: ["comp:shared", "tech:dotnet-api"],
    },
    {
      number: 12,
      title: "Xây dựng REST API cung cấp trạng thái chỗ đỗ thời gian thực (IPGS.API)",
      description: `Cung cấp các Endpoint cho Mobile App và BMS:
- GET /api/v1/zones/occupancy: Danh sách zone và số lượng slot trống.
- GET /api/v1/vehicles/find?plateNumber=...: Tìm kiếm vị trí xe đã đỗ.
- POST /api/v1/slots/{id}/reserve: Đặt trước chỗ đỗ xe.`,
      type: "STORY",
      status: "TODO",
      priority: "HIGH",
      storyPoints: 8,
      sprintId: sprint4.id,
      assigneeId: devBinh.id,
      labels: ["comp:api", "tech:dotnet-api", "kind:feature"],
    },
    {
      number: 13,
      title: "Tích hợp RabbitMQ / MQTT Client cho IPGS.API.Messaging",
      description: `Broadcast sự kiện thay đổi trạng thái slot đỗ xe theo thời gian thực (Real-time pub/sub):
- Topic: pgs.slot.changed
- Topic: pgs.zone.updated
Xử lý cơ chế tự động kết nối lại khi đường truyền mạng chập chờn.`,
      type: "TASK",
      status: "TODO",
      priority: "MEDIUM",
      storyPoints: 5,
      sprintId: sprint4.id,
      assigneeId: devChi.id,
      labels: ["comp:api", "tech:dotnet-api"],
    },
    {
      number: 14,
      title: "Tích hợp module thanh toán VietQR động tại Kiosk (IPGS.API.Payments)",
      description: `Cho phép khách gửi xe thanh toán phí gửi xe bằng ứng dụng ngân hàng ngay tại màn hình Kiosk trước khi ra lấy xe.
- Sinh mã VietQR động theo chuẩn Napas 247.
- Webhook nhận xác nhận thanh toán tức thời từ Ngân hàng / Cổng thanh toán.`,
      type: "STORY",
      status: "TODO",
      priority: "URGENT",
      storyPoints: 8,
      sprintId: sprint4.id,
      assigneeId: devBinh.id,
      labels: ["comp:api", "tech:dotnet-api", "kind:feature"],
    },

    // --- Các Task trong Backlog (Chưa gán Sprint) ---
    {
      number: 15,
      title: "Nghiên cứu nhận diện loại xe (Sedan, SUV, Bán tải) qua AI Camera ZCU",
      description: `Tích hợp mô hình AI nhận diện kích thước và phân loại phương tiện vào ZCU camera để cảnh báo xe quá khổ đỗ vào slot xe nhỏ.`,
      type: "TASK",
      status: "BACKLOG",
      priority: "LOW",
      storyPoints: 8,
      labels: ["comp:zcu", "kind:feature"],
    },
    {
      number: 16,
      title: "Ứng dụng Mobile App cho bảo vệ quản lý trạng thái bãi đỗ xe",
      description: `Xây dựng ứng dụng Flutter / Avalonia Mobile chạy trên điện thoại bảo vệ để kiểm tra xe đỗ sai vị trí hoặc xe đỗ quá hạn.`,
      type: "TASK",
      status: "BACKLOG",
      priority: "LOW",
      storyPoints: 13,
      labels: ["comp:api", "kind:feature"],
    },
    {
      number: 17,
      title: "Báo cáo thống kê hiệu suất sử dụng bãi đỗ theo ngày/tháng/năm",
      description: `Xây dựng Dashboard trực quan hóa biểu đồ nhiệt (Heatmap) thể hiện tỷ lệ lấp đầy các vị trí đỗ theo khung giờ trong ngày.`,
      type: "TASK",
      status: "BACKLOG",
      priority: "MEDIUM",
      storyPoints: 5,
      labels: ["comp:api"],
    },
  ];

  // 7. Lưu toàn bộ Tasks và Subtasks vào DB
  let createdCount = 0;
  for (const t of tasksData) {
    const taskRecord = await prisma.task.create({
      data: {
        projectId: project.id,
        number: t.number,
        title: t.title,
        description: t.description,
        type: t.type,
        status: t.status,
        priority: t.priority,
        storyPoints: t.storyPoints,
        sprintId: t.sprintId,
        assigneeId: t.assigneeId,
        creatorId: admin.id,
        dueDate: t.status === "DONE" ? daysAgo(10) : daysFromNow(14),
        completedAt: t.status === "DONE" ? daysAgo(10) : null,
      },
    });

    // Gắn Labels cho Task
    for (const labelName of t.labels) {
      const labelId = labelsMap.get(labelName);
      if (labelId) {
        await prisma.taskLabel.create({
          data: {
            taskId: taskRecord.id,
            labelId: labelId,
          },
        });
      }
    }

    // Tạo Subtasks (nếu có)
    if (t.subtasks && t.subtasks.length > 0) {
      for (const st of t.subtasks) {
        await prisma.subtask.create({
          data: {
            taskId: taskRecord.id,
            title: st.title,
            done: st.done,
          },
        });
      }
    }

    createdCount++;
  }

  console.log(`✅ Đã tạo thành công ${createdCount} Tasks & Stories vào CSDL.`);
  console.log("=== HOÀN TẤT SEED DỮ LIỆU PGS MẪU THÀNH CÔNG ===");
}

main()
  .catch((e) => {
    console.error("LỖI KHI TẠO DỮ LIỆU:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
