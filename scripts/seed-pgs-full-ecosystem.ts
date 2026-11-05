import "../prisma/load-env";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=================================================================");
  console.log("NÂNG CẤP DỮ LIỆU PGS CHUẨN THỰC CHIẾN (ZCU CAMERA & CRUD REPOSITORIES)");
  console.log("=================================================================");

  const users = await prisma.user.findMany();
  const admin = users.find((u) => u.role === "ADMIN") || users[0];
  const devBinh = users.find((u) => u.email.includes("binh")) || users[0];
  const devChi = users.find((u) => u.email.includes("chi")) || users[0];
  const pmAlice = users.find((u) => u.email.includes("alice")) || admin;

  const projectKeys = ["PGS", "PGS-LTT", "PGS-KNG", "PGS-VCM"];
  for (const key of projectKeys) {
    const existing = await prisma.project.findUnique({ where: { key } });
    if (existing) {
      console.log(`ℹ️ Dọn dẹp dự án cũ: [${key}]...`);
      await prisma.project.delete({ where: { key } });
    }
  }

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  // ===========================================================================
  // DỰ ÁN 1: [PGS] - HỆ THỐNG GỐC R&D (CORE PRODUCT)
  // ===========================================================================
  console.log("\n📦 Đang tạo Dự án 1: [PGS] Hệ thống Hướng dẫn Báo chỗ đỗ xe - iPGS Core...");
  const pgsCore = await prisma.project.create({
    data: {
      name: "Hệ thống Hướng dẫn Báo chỗ đỗ xe - iPGS Core",
      key: "PGS",
      description: `Sản phẩm lõi chuẩn hóa (R&D Core) của hệ sinh thái báo chỗ đỗ xe thông minh KZTEK (v8).
Bao gồm:
- ZCU (IPGSUseCam): Xử lý camera nhận diện slot đỗ xe (Hikvision, Dahua, Milesight), ROI polygon, LPR, crop ảnh xe và bộ đếm ISlotCounter.
- CCU (IPGSv4): Điều phối trung tâm, kiểm tra heartbeat camera (CameraPingService), ImageIntegrationController, MapIntegrationController.
- DATA (IPGS.Data): Lớp Repository CRUD dùng chung (PgsContext, PgsAreaRepository, PgsDeviceSlotRepository, PgsDeviceRepository).
- KIOSK (IPGS.Kiosk): Ứng dụng tra cứu vị trí xe Avalonia responsive đa nền tảng (Linux/Windows).
- API (IPGS.API): REST API, Swagger OpenAPI, RabbitMQ messaging và cổng thanh toán VietQR.`,
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

  const coreLabels = [
    { name: "comp:zcu", color: "#0284C7" },      // ZCU (Camera, LPR, Sensor)
    { name: "comp:ccu", color: "#F05922" },      // CCU (Central Controller)
    { name: "comp:data-crud", color: "#059669" },// CRUD Data & Repositories
    { name: "comp:kiosk", color: "#10B981" },    // Kiosk App
    { name: "comp:api", color: "#8B5CF6" },      // Web API Gateway
    { name: "comp:shared", color: "#64748B" },   // Core / Utils
    { name: "tech:winforms", color: "#F59E0B" }, // WinForms Legacy
    { name: "tech:avalonia", color: "#EC4899" }, // Avalonia UI
    { name: "tech:dotnet-api", color: "#6366F1"},// .NET 8 / EF / Dapper
    { name: "kind:hardware", color: "#EF4444" }, // Phần cứng / Camera SDK
    { name: "kind:feature", color: "#22C55E" },  // Tính năng
    { name: "kind:refactor", color: "#EAB308" }, // Tối ưu cấu trúc
    { name: "kind:testing", color: "#14B8A6" },  // Kiểm thử tự động
  ];

  const pgsLabelMap = new Map<string, string>();
  for (const lb of coreLabels) {
    const l = await prisma.label.create({
      data: { projectId: pgsCore.id, name: lb.name, color: lb.color },
    });
    pgsLabelMap.set(lb.name, l.id);
  }

  // Helper tạo Task
  async function createTask(params: {
    projectId: string;
    sprintId?: string;
    number: number;
    title: string;
    description: string;
    type: "EPIC" | "STORY" | "TASK" | "BUG";
    status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    storyPoints: number;
    assigneeId?: string;
    labelMap: Map<string, string>;
    labels: string[];
    subtasks?: { title: string; done: boolean }[];
    daysAgoCompleted?: number;
    daysDue?: number;
  }) {
    const t = await prisma.task.create({
      data: {
        projectId: params.projectId,
        sprintId: params.sprintId,
        number: params.number,
        title: params.title,
        description: params.description,
        type: params.type,
        status: params.status,
        priority: params.priority,
        storyPoints: params.storyPoints,
        assigneeId: params.assigneeId,
        creatorId: admin.id,
        completedAt: params.status === "DONE" ? daysAgo(params.daysAgoCompleted ?? 10) : null,
        dueDate: params.status === "DONE" ? daysAgo(params.daysAgoCompleted ?? 10) : daysFromNow(params.daysDue ?? 14),
      },
    });

    for (const name of params.labels) {
      const lid = params.labelMap.get(name);
      if (lid) {
        await prisma.taskLabel.create({ data: { taskId: t.id, labelId: lid } });
      }
    }

    if (params.subtasks) {
      for (const st of params.subtasks) {
        await prisma.subtask.create({
          data: { taskId: t.id, title: st.title, done: st.done },
        });
      }
    }
  }

  // --- SPRINTS ---
  const pgsSprint1 = await prisma.sprint.create({
    data: {
      projectId: pgsCore.id,
      name: "Sprint 1: Nền tảng WinForms CCU & ZCU Hardware",
      goal: "Xây dựng driver truyền thông nối tiếp RS485, bộ điều khiển trung tâm CCU và hiển thị LED Zone.",
      status: "COMPLETED",
      startDate: daysAgo(75),
      endDate: daysAgo(61),
    },
  });

  const pgsSprint2 = await prisma.sprint.create({
    data: {
      projectId: pgsCore.id,
      name: "Sprint 2: Kiosk WinForms Ngang & Dọc",
      goal: "Xây dựng 2 phiên bản Kiosk tìm xe WinForms độc lập cho màn hình ngang 1920x1080 và dọc 1080x1920.",
      status: "COMPLETED",
      startDate: daysAgo(60),
      endDate: daysAgo(46),
    },
  });

  const pgsSprint3 = await prisma.sprint.create({
    data: {
      projectId: pgsCore.id,
      name: "Sprint 3: Xử lý ZCU Camera & Hợp nhất Kiosk Avalonia",
      goal: "Phát triển module ZCU nhận diện slot đỗ xe qua Camera AI (Hik/Dahua/Milesight), cấu hình ROI polygon, bộ đếm ISlotCounter và hoàn thiện Kiosk Avalonia responsive.",
      status: "ACTIVE",
      startDate: daysAgo(7),
      endDate: daysFromNow(7),
    },
  });

  const pgsSprint4 = await prisma.sprint.create({
    data: {
      projectId: pgsCore.id,
      name: "Sprint 4: Tầng CRUD Repositories & Centralized API",
      goal: "Triển khai lớp dữ liệu CRUD PgsContext, PgsAreaRepository, PgsDeviceSlotRepository, PgsDeviceRepository, Excel import/export và hệ thống RESTful API kết nối thanh toán.",
      status: "PLANNING",
      startDate: daysFromNow(8),
      endDate: daysFromNow(22),
    },
  });

  // Task list for PGS Core
  let taskNum = 1;

  // --- SPRINT 1 TASKS (WinForms Legacy) ---
  const sprint1Tasks = [
    {
      title: "Thiết kế giao thức truyền thông nhị phân Byte Protocol giữa ZCU và Cảm biến",
      desc: "Xây dựng định dạng gói tin nhị phân: Header 2-byte (0xAA, 0x55), Length, Function Code, Data Payload, CRC16 Checksum.",
      type: "TASK" as const, status: "DONE" as const, prio: "HIGH" as const, sp: 3, assignee: devBinh.id,
      labels: ["comp:zcu", "tech:winforms", "kind:hardware"],
      subtasks: [
        { title: "Định nghĩa bảng mã Function Code cho đọc trạng thái, set độ nhạy", done: true },
        { title: "Viết hàm tính CRC16-CCITT tối ưu tốc độ", done: true },
      ],
    },
    {
      title: "Viết SerialPort Driver với cơ chế tự động kết nối lại khi đứt cáp RS485",
      desc: "Quản lý luồng BackgroundWorker đọc cổng COM liên tục, xử lý bộ đệm trượt tránh tràn ram và tự dò cổng khi cắm lại USB-to-RS485.",
      type: "TASK" as const, status: "DONE" as const, prio: "URGENT" as const, sp: 5, assignee: devBinh.id,
      labels: ["comp:zcu", "tech:winforms", "kind:hardware"],
    },
    {
      title: "Thuật toán lọc nhiễu tín hiệu siêu âm tránh nhảy trạng thái ảo (Anti-flicker)",
      desc: "Chỉ xác nhận trạng thái ô đỗ có xe sau khi cảm biến duy trì tín hiệu phát hiện liên tục trong 3 chu kỳ poll (khoảng 1.5 giây).",
      type: "TASK" as const, status: "DONE" as const, prio: "MEDIUM" as const, sp: 3, assignee: devChi.id,
      labels: ["comp:zcu", "tech:winforms"],
    },
    {
      title: "Xây dựng Driver điều khiển Bảng LED hiển thị số chỗ trống theo Zone",
      desc: "Giao thức điều khiển bảng LED 7 đoạn và bảng LED ma trận điểm P10 hiển thị số lượng chỗ trống còn lại theo từng khu vực.",
      type: "TASK" as const, status: "DONE" as const, prio: "MEDIUM" as const, sp: 3, assignee: devChi.id,
      labels: ["comp:zcu", "tech:winforms", "kind:hardware"],
    },
    {
      title: "Bộ xử lý trung tâm CCU: Đồng bộ dữ liệu đa luồng (Thread-safe Concurrent State)",
      desc: "Tổng hợp trạng thái từ tối đa 16 ZCU cùng gửi về qua mạng LAN socket TCP, áp dụng ReaderWriterLockSlim để đảm bảo dữ liệu toàn vẹn.",
      type: "TASK" as const, status: "DONE" as const, prio: "HIGH" as const, sp: 5, assignee: devBinh.id,
      labels: ["comp:ccu", "tech:winforms"],
    },
    {
      title: "Ghi nhật ký Log nhị phân và Log Text chẩn đoán lỗi phần cứng",
      desc: "Cơ chế xoay vòng log (Log rotation) 30 ngày tự dọn dẹp, lưu trữ lịch sử thay đổi trạng thái của từng slot xe.",
      type: "TASK" as const, status: "DONE" as const, prio: "LOW" as const, sp: 2, assignee: devChi.id,
      labels: ["comp:shared", "tech:winforms"],
    },
  ];

  for (const t of sprint1Tasks) {
    await createTask({
      projectId: pgsCore.id, sprintId: pgsSprint1.id, number: taskNum++,
      title: t.title, description: t.desc, type: t.type, status: t.status, priority: t.prio, storyPoints: t.sp,
      assigneeId: t.assignee, labelMap: pgsLabelMap, labels: t.labels, subtasks: t.subtasks, daysAgoCompleted: 62,
    });
  }

  // --- SPRINT 2 TASKS (Kiosk WinForms) ---
  const sprint2Tasks = [
    {
      title: "Thiết kế giao diện WinForms Kiosk Ngang cố định (1920x1080) bằng kéo thả",
      desc: "Tạo form WinForms kích thước tĩnh 1920x1080 cho màn hình đặt ngang, hiển thị thanh tìm kiếm biển số và bản đồ 2D sơ đồ bãi.",
      type: "TASK" as const, status: "DONE" as const, prio: "MEDIUM" as const, sp: 5, assignee: devChi.id,
      labels: ["comp:kiosk", "tech:winforms", "kind:feature"],
    },
    {
      title: "Nhân bản source code sang project riêng cho Kiosk Dọc (1080x1920)",
      desc: "Do WinForms khó làm responsive, nhân bản code và bố trí lại vị trí bản đồ lên trên, bàn phím số xuống dưới (Dẫn đến việc phải bảo trì 2 codebases độc lập).",
      type: "TASK" as const, status: "DONE" as const, prio: "MEDIUM" as const, sp: 5, assignee: devChi.id,
      labels: ["comp:kiosk", "tech:winforms"],
    },
    {
      title: "Tích hợp thư viện đồ họa GDI+ vẽ sơ đồ đường đi chỉ dẫn từ Kiosk tới vị trí đỗ",
      desc: "Vẽ đường nét đứt và mũi tên chuyển động trên PictureBox để hướng dẫn khách đi bộ tới xe theo các ngã rẽ.",
      type: "TASK" as const, status: "DONE" as const, prio: "HIGH" as const, sp: 5, assignee: devBinh.id,
      labels: ["comp:kiosk", "tech:winforms"],
    },
    {
      title: "Tích hợp Driver máy in nhiệt Kiosk ESC/POS in phiếu chỉ dẫn vị trí xe",
      desc: "In phiếu hướng dẫn có chứa tên tầng hầm, mã cột đỗ xe (Ví dụ: Cột C15 - B2) và mã QR bản đồ mini.",
      type: "TASK" as const, status: "DONE" as const, prio: "LOW" as const, sp: 3, assignee: devChi.id,
      labels: ["comp:kiosk", "tech:winforms", "kind:hardware"],
    },
  ];

  for (const t of sprint2Tasks) {
    await createTask({
      projectId: pgsCore.id, sprintId: pgsSprint2.id, number: taskNum++,
      title: t.title, description: t.desc, type: t.type, status: t.status, priority: t.prio, storyPoints: t.sp,
      assigneeId: t.assignee, labelMap: pgsLabelMap, labels: t.labels, daysAgoCompleted: 48,
    });
  }

  // --- SPRINT 3 TASKS (ZCU CAMERA AI & AVALONIA KIOSK - ACTIVE / ĐANG DIỄN RA) ---
  const sprint3Tasks = [
    // Phần ZCU Camera & LPR cốt lõi
    {
      title: "Thiết kế Interface ICameraController và lớp cơ sở xử lý Camera SDK đa hãng",
      desc: "Định nghĩa hợp đồng chuẩn tại IPGS.Object/Devices/ICameraController.cs: ConnectAsync, DisconnectAsync, CaptureSnapshotAsync, SubscribeAlarmEvent, GetStreamUrl.",
      type: "TASK" as const, status: "DONE" as const, prio: "HIGH" as const, sp: 5, assignee: devBinh.id,
      labels: ["comp:zcu", "kind:hardware"],
      subtasks: [
        { title: "Định nghĩa ICameraController và ConnectionState enum", done: true },
        { title: "Viết BaseCameraController quản lý heartbeat và luồng đọc stream", done: true },
      ],
    },
    {
      title: "Hiện thực HIKCameraController: Tích hợp SDK Hikvision (CHCNetSDK) chụp ảnh slot",
      desc: "Cài đặt HIKCameraController.cs trong ZCU: Gọi NET_DVR_Init, NET_DVR_Login_V40, bắt sự kiện báo động đỗ xe COMM_ALARM_V40 và nhận diện biển số tại chỗ.",
      type: "TASK" as const, status: "DONE" as const, prio: "HIGH" as const, sp: 5, assignee: devBinh.id,
      labels: ["comp:zcu", "kind:hardware"],
    },
    {
      title: "Hiện thực DahuaCameraController và MilesightCameraController kết nối RTSP/ONVIF",
      desc: "Viết DahuaCameraController.cs và MilesightCameraController.cs: Sử dụng giao thức HTTP CGI và Onvif DeviceIO để chụp ảnh snapshot phân giải cao và lấy tọa độ xe.",
      type: "TASK" as const, status: "IN_PROGRESS" as const, prio: "HIGH" as const, sp: 5, assignee: devBinh.id,
      labels: ["comp:zcu", "kind:hardware"],
    },
    {
      title: "Xây dựng ConfigRegion & CameraConfig: Vẽ vùng nhận diện đa giác (ROI Polygon Mapping)",
      desc: "Cho phép kỹ thuật viên vẽ các đa giác 4 điểm (Polygon) trên khung hình camera tại ZCU để gán từng ô đỗ với mã Slot tương ứng (SlotId, RegionName, Coordinates).",
      type: "TASK" as const, status: "IN_PROGRESS" as const, prio: "URGENT" as const, sp: 5, assignee: devBinh.id,
      labels: ["comp:zcu", "kind:feature"],
      subtasks: [
        { title: "Xây dựng cấu trúc ConfigRegion.cs lưu tọa độ đỉnh đa giác", done: true },
        { title: "Thuật toán Point-in-Polygon kiểm tra tâm xe nằm trong ô đỗ", done: true },
        { title: "Giao diện kéo thả đỉnh đa giác trực quan trên ảnh snapshot", done: false },
      ],
    },
    {
      title: "Cắt ảnh chi tiết xe (Crop Image) & Lưu trữ ảnh toàn cảnh Overview ô đỗ",
      desc: "Khi xe vào đỗ, ZCU tự động cắt 2 ảnh: Ảnh Overview toàn bộ luồng xe và Ảnh Crop cận cảnh đầu xe / biển số (crop1.jpg, crop2.jpg, overview.jpg) lưu vào thư mục đệm.",
      type: "TASK" as const, status: "IN_REVIEW" as const, prio: "MEDIUM" as const, sp: 3, assignee: devChi.id,
      labels: ["comp:zcu"],
    },
    {
      title: "Hiện thực bộ đếm thời gian thực ISlotCounter và State Machine trạng thái ô đỗ",
      desc: "Cài đặt ISlotCounter.cs và ParkingRuleDetail.cs: Quản lý vòng đời trạng thái slot (Empty -> Detected -> Occupied -> Reserved -> Error), tính tổng số slot trống từng Zone.",
      type: "TASK" as const, status: "IN_REVIEW" as const, prio: "HIGH" as const, sp: 3, assignee: devBinh.id,
      labels: ["comp:zcu"],
    },
    {
      title: "Xây dựng CameraPingService giám sát kết nối Camera và tự động khởi động lại luồng RTSP",
      desc: "Định kỳ 10 giây ping kiểm tra trạng thái mạng của từng IP Camera. Nếu mất tín hiệu quá 3 lần, tự động hủy phiên RTSP cũ và khởi tạo kết nối lại trong nền.",
      type: "TASK" as const, status: "TODO" as const, prio: "HIGH" as const, sp: 3, assignee: devChi.id,
      labels: ["comp:zcu", "comp:ccu"],
    },
    {
      title: "Xử lý Event Bus phát sự kiện thay đổi slot từ ZCU qua APIController về CCU",
      desc: "Hiện thực Events.cs và APIController.cs tại ZCU (IPGSUseCam): Khi trạng thái slot đổi, lập tức bắn event qua HTTP POST /api/slots/status hoặc Socket TCP về CCU.",
      type: "TASK" as const, status: "TODO" as const, prio: "MEDIUM" as const, sp: 3, assignee: devBinh.id,
      labels: ["comp:zcu"],
    },

    // Phần Kiosk Avalonia UI
    {
      title: "Dựng Responsive Shell View với Grid tự động thay đổi Layout theo Aspect Ratio",
      desc: "Sử dụng OrientationBehavior: Nếu Width > Height đổi sang Landscape Grid (Map bên phải, Search bên trái); ngược lại đổi sang Portrait Grid (Map bên trên, Search bên dưới).",
      type: "TASK" as const, status: "DONE" as const, prio: "HIGH" as const, sp: 3, assignee: devBinh.id,
      labels: ["comp:kiosk", "tech:avalonia"],
    },
    {
      title: "Thiết lập Design Tokens IPGS.Theme trên hệ thiết kế KztekComponentAvalonia",
      desc: "Định nghĩa bảng màu PgsPrimary (#F05922), DarkNavy, bo góc 12px, font chữ kích thước cảm ứng lớn trong thư mục THEME/.",
      type: "TASK" as const, status: "DONE" as const, prio: "MEDIUM" as const, sp: 2, assignee: devChi.id,
      labels: ["comp:kiosk", "tech:avalonia"],
    },
    {
      title: "Xây dựng UserControl Bàn phím ảo cảm ứng KzVirtualKeyboard hỗ trợ song ngữ",
      desc: "Phục vụ khách nhập biển số xe trực tiếp trên màn hình Touch: Phím số to, tự động viết hoa ký tự, phím xóa nhanh và phím tìm kiếm.",
      type: "TASK" as const, status: "IN_PROGRESS" as const, prio: "HIGH" as const, sp: 3, assignee: devChi.id,
      labels: ["comp:kiosk", "tech:avalonia", "kind:feature"],
    },
    {
      title: "Xây dựng UserControl Bản đồ Floor Map Canvas hỗ trợ Zoom và Pan đa điểm",
      desc: "Hiển thị vector sơ đồ mặt bằng hầm, các vị trí ô đỗ có chấm màu (Xanh: Trống, Đỏ: Đã đỗ, Vàng: Kiosk). Hỗ trợ dùng 2 ngón tay phóng to thu nhỏ trên màn hình cảm ứng.",
      type: "TASK" as const, status: "IN_PROGRESS" as const, prio: "HIGH" as const, sp: 5, assignee: devBinh.id,
      labels: ["comp:kiosk", "tech:avalonia"],
    },
    {
      title: "Thuật toán tìm đường ngắn nhất (A* Pathfinding) từ trạm Kiosk tới vị trí ô xe",
      desc: "Dựa trên đồ thị đường đi trong hầm, thuật toán A* tính toán đường đi tối ưu tránh các góc cua hẹp hoặc lối đi cấm người đi bộ.",
      type: "TASK" as const, status: "IN_REVIEW" as const, prio: "MEDIUM" as const, sp: 3, assignee: devBinh.id,
      labels: ["comp:kiosk", "tech:avalonia"],
    },
    {
      title: "Xây dựng UserControl hiển thị kết quả tìm kiếm kèm ảnh chụp từ ZCU Camera",
      desc: "Hiển thị danh sách xe khớp với chuỗi tìm kiếm, hiển thị ảnh chụp đầu xe, thời gian vào đỗ và vị trí (Zone / Cột / Tầng).",
      type: "TASK" as const, status: "IN_REVIEW" as const, prio: "MEDIUM" as const, sp: 2, assignee: devChi.id,
      labels: ["comp:kiosk", "tech:avalonia", "kind:feature"],
    },
    {
      title: "Bộ 39 Unit Tests tự động kiểm thử toàn bộ Module Kiosk (IPGS.Kiosk.Tests)",
      desc: "Chạy lệnh `dotnet test KIOSK/tests/IPGS.Kiosk.Tests`, đảm bảo 39 unit test pass 100% bao gồm cả test tìm kiếm biển số đặc biệt và timeout.",
      type: "TASK" as const, status: "TODO" as const, prio: "HIGH" as const, sp: 3, assignee: devChi.id,
      labels: ["comp:kiosk", "tech:avalonia", "kind:testing"],
    },
    {
      title: "Cấu hình đóng gói Kiosk chạy chế độ toàn màn hình (Kiosk Mode) trên Ubuntu 22.04",
      desc: "Thiết lập systemd service tự khởi động ứng dụng sau khi bật nguồn IPC Linux, khóa phím tắt thoát ứng dụng (Alt+F4, Alt+Tab).",
      type: "TASK" as const, status: "TODO" as const, prio: "HIGH" as const, sp: 3, assignee: devBinh.id,
      labels: ["comp:kiosk", "tech:avalonia"],
    },
  ];

  for (const t of sprint3Tasks) {
    await createTask({
      projectId: pgsCore.id, sprintId: pgsSprint3.id, number: taskNum++,
      title: t.title, description: t.desc, type: t.type, status: t.status, priority: t.prio, storyPoints: t.sp,
      assigneeId: t.assignee, labelMap: pgsLabelMap, labels: t.labels, subtasks: t.subtasks, daysAgoCompleted: 2, daysDue: 6,
    });
  }

  // --- SPRINT 4 TASKS (CRUD DATA REPOSITORIES & API SERVICES - PLANNING / SẮP TỚI) ---
  const sprint4Tasks = [
    // Phần CRUD Data & Repositories chuyên sâu
    {
      title: "Hiện thực PgsContext: Ngữ cảnh kết nối máy chủ API dùng chung CCU / ZCU",
      desc: "Xây dựng IPGS.Data/PgsContext.cs: Quản lý IPgsApiClient, cấu hình ConfigProvider động, xử lý đăng nhập phiên (grant password/client_credentials), Unwrap async-to-sync an toàn.",
      type: "TASK" as const, status: "TODO" as const, prio: "URGENT" as const, sp: 5, assignee: devBinh.id,
      labels: ["comp:data-crud", "comp:shared", "tech:dotnet-api"],
      subtasks: [
        { title: "Xây dựng cơ chế ConfigProvider nạp lại cấu hình không mất token", done: false },
        { title: "Viết hàm tiện ích PgsContext.Run và Unwrap bắt lỗi ngoại lệ PgsApiException", done: false },
      ],
    },
    {
      title: "Hiện thực PgsAreaRepository: CRUD Nhóm Zone / Khu vực theo Tầng và Cổng (Gate)",
      desc: "Xây dựng IPGS.Data/PgsAreaRepository.cs: GetAll(), Insert(ZoneGroup), Update(ZoneGroup), Delete(id), GetGates(). Quản lý cấu trúc Tầng -> Khu vực (ZoneGroup) -> Slot và liên kết cổng GATE.",
      type: "TASK" as const, status: "TODO" as const, prio: "HIGH" as const, sp: 5, assignee: devBinh.id,
      labels: ["comp:data-crud", "tech:dotnet-api"],
      subtasks: [
        { title: "CRUD khu vực gọi AreaService API và đồng bộ ZoneGroupExtras", done: false },
        { title: "Lọc danh sách thiết bị cổng kiểm soát DeviceTypes.Gate", done: false },
      ],
    },
    {
      title: "Hiện thực PgsDeviceSlotRepository: CRUD Gán danh sách Slot cho ZCU, LED và Camera",
      desc: "Xây dựng IPGS.Data/PgsDeviceSlotRepository.cs: GET/PUT /devices/{id}/slots. Quản lý bộ đệm Memory Cache 2 phút (TTL), Prefetch nạp trước hàng loạt thiết bị và Invalidate khi cập nhật.",
      type: "TASK" as const, status: "TODO" as const, prio: "HIGH" as const, sp: 5, assignee: devBinh.id,
      labels: ["comp:data-crud", "tech:dotnet-api"],
      subtasks: [
        { title: "Viết hàm Fetch và Get với cơ chế cache stale-while-revalidate", done: false },
        { title: "Hiện thực Prefetch song song danh sách slot cho nhiều thiết bị", done: false },
      ],
    },
    {
      title: "Hiện thực PgsDeviceRepository: CRUD Quản lý thiết bị phần cứng (ZCU, CCU, LED, GATE)",
      desc: "Xây dựng IPGS.Data/PgsDeviceRepository.cs: Thêm mới, sửa thông tin, xóa và tra cứu trạng thái kết nối của từng thiết bị trong toàn hệ thống bãi đỗ.",
      type: "TASK" as const, status: "TODO" as const, prio: "MEDIUM" as const, sp: 3, assignee: devChi.id,
      labels: ["comp:data-crud", "tech:dotnet-api"],
    },
    {
      title: "Xây dựng ExcelDataService & CameraImportExport: Nhập / Xuất cấu hình Slot từ Excel",
      desc: "Hiện thực ExcelDataService.cs trong CCU: Đọc file Excel sơ đồ bãi đỗ (Tầng, Zone, Tên Slot, Địa chỉ cảm biến, IP Camera) để nạp hàng loạt vào CSDL trong 3 giây.",
      type: "TASK" as const, status: "TODO" as const, prio: "HIGH" as const, sp: 5, assignee: devChi.id,
      labels: ["comp:data-crud", "comp:ccu"],
    },

    // Phần CCU Controllers & Integration
    {
      title: "Hiện thực ImageIntegrationController & MapIntegrationController tại CCU",
      desc: "Cung cấp API tại CCU phục vụ trạm Kiosk và App: /api/images/vehicle-snapshot lấy ảnh xe đỗ theo biển số, /api/maps/layout trả về sơ đồ vector và vị trí slot trống.",
      type: "TASK" as const, status: "TODO" as const, prio: "HIGH" as const, sp: 5, assignee: devBinh.id,
      labels: ["comp:ccu", "comp:api"],
    },
    {
      title: "Hiện thực ThirdPartyIntegrationController: Cổng kết nối hệ thống BMS tòa nhà",
      desc: "Cung cấp endpoint chuẩn cho hệ thống BMS (Schneider/Johnson Controls) lấy dữ liệu số lượng chỗ đỗ còn trống theo tầng qua chuẩn REST JSON.",
      type: "TASK" as const, status: "TODO" as const, prio: "MEDIUM" as const, sp: 3, assignee: devChi.id,
      labels: ["comp:ccu", "comp:api"],
    },
    {
      title: "Triển khai RabbitMQ & MQTT Client phát sóng sự kiện thay đổi slot theo thời gian thực",
      desc: "Tích hợp thư viện IPGS.API.Messaging: Phát bản tin lên RabbitMQ topic `pgs.slot.changed` khi ZCU ghi nhận xe vào/ra để các Kiosk và Web dashboard cập nhật ngay.",
      type: "TASK" as const, status: "TODO" as const, prio: "HIGH" as const, sp: 5, assignee: devBinh.id,
      labels: ["comp:api", "tech:dotnet-api"],
    },
    {
      title: "Tích hợp module thanh toán VietQR động tại Kiosk (IPGS.API.Payments)",
      desc: "Sinh mã VietQR động theo chuẩn Napas 247, webhook nhận callback ngân hàng tức thì với cơ chế Idempotency Key bảo mật chống trùng giao dịch.",
      type: "STORY" as const, status: "TODO" as const, prio: "URGENT" as const, sp: 8, assignee: devBinh.id,
      labels: ["comp:api", "tech:dotnet-api", "kind:feature"],
    },
    {
      title: "Viết bộ 47 Unit Tests kiểm thử toàn bộ API Controllers & Services",
      desc: "Chạy `dotnet test API/tests/IPGS.API.Tests` đạt 47 tests pass 100%, kiểm thử toàn bộ logic xác thực, tính slot và tra cứu xe.",
      type: "TASK" as const, status: "TODO" as const, prio: "HIGH" as const, sp: 5, assignee: devChi.id,
      labels: ["comp:api", "kind:testing"],
    },
  ];

  for (const t of sprint4Tasks) {
    await createTask({
      projectId: pgsCore.id, sprintId: pgsSprint4.id, number: taskNum++,
      title: t.title, description: t.desc, type: t.type, status: t.status, priority: t.prio, storyPoints: t.sp,
      assigneeId: t.assignee, labelMap: pgsLabelMap, labels: t.labels, subtasks: t.subtasks, daysDue: 20,
    });
  }

  // --- BACKLOG TASKS ---
  const backlogTasks = [
    {
      title: "R&D mô hình AI nhận diện loại phương tiện (Sedan, SUV, Bán tải) qua Camera ZCU",
      desc: "Cảnh báo khi xe bán tải cỡ lớn đỗ vào ô đỗ tiêu chuẩn dành cho xe nhỏ làm tràn vạch sơn.",
      type: "TASK" as const, status: "BACKLOG" as const, prio: "LOW" as const, sp: 13, labels: ["comp:zcu", "kind:feature"],
    },
    {
      title: "Mobile App cho lực lượng bảo vệ giám sát xe đỗ sai vị trí hoặc đỗ quá hạn",
      desc: "Bảo vệ đi tuần quét mã QR ô đỗ để kiểm tra thời gian gửi và cảnh báo xe gửi qua đêm không đăng ký.",
      type: "STORY" as const, status: "BACKLOG" as const, prio: "LOW" as const, sp: 8, labels: ["comp:api", "kind:feature"],
    },
    {
      title: "Biểu đồ nhiệt (Heatmap) trực quan hóa tần suất đỗ xe theo giờ trong ngày",
      desc: "Giúp ban quản lý tòa nhà biết được khu vực nào trong hầm thường xuyên bị quá tải để điều phối phân luồng.",
      type: "TASK" as const, status: "BACKLOG" as const, prio: "MEDIUM" as const, sp: 5, labels: ["comp:api"],
    },
  ];

  for (const t of backlogTasks) {
    await createTask({
      projectId: pgsCore.id, number: taskNum++,
      title: t.title, description: t.desc, type: t.type, status: t.status, priority: t.prio, storyPoints: t.sp,
      labelMap: pgsLabelMap, labels: t.labels,
    });
  }

  console.log(`✅ Hoàn tất tạo Dự án PGS Core với ${taskNum - 1} tasks chi tiết.`);

  // ===========================================================================
  // DỰ ÁN 2 (TÌNH HUỐNG A): [PGS-LTT] - DỰ ÁN LOTTE MALL TÂY HỒ (CUSTOMIZATION)
  // ===========================================================================
  console.log("\n🏢 Đang tạo Dự án 2 (Tình huống A): [PGS-LTT] Triển khai PGS - Lotte Mall Tây Hồ...");
  const pgsLotte = await prisma.project.create({
    data: {
      name: "Triển khai PGS - Lotte Mall Tây Hồ",
      key: "PGS-LTT",
      description: `Dự án thi công triển khai hệ thống báo chỗ đỗ xe tại TTTM Lotte Mall Tây Hồ:
- Quy mô: 3 tầng hầm (B1, B2, B3), tổng cộng 1,200 ô đỗ xe, 24 bảng LED hướng dẫn.
- Trang bị: 6 trạm Kiosk tìm xe cảm ứng Avalonia đặt tại các sảnh thang máy.
- Yêu cầu đặc thù của Chủ đầu tư: Kiosk hiển thị song ngữ Việt - Hàn, xuất báo cáo tài chính bãi đỗ theo mẫu Excel riêng của tập đoàn Lotte.`,
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

  const lotteLabels = [
    { name: "phase:survey", color: "#F59E0B" },
    { name: "phase:hardware", color: "#EF4444" },
    { name: "phase:custom", color: "#8B5CF6" },
    { name: "phase:acceptance", color: "#10B981" },
  ];
  const lotteLabelMap = new Map<string, string>();
  for (const lb of lotteLabels) {
    const l = await prisma.label.create({
      data: { projectId: pgsLotte.id, name: lb.name, color: lb.color },
    });
    lotteLabelMap.set(lb.name, l.id);
  }

  const lotteSprint1 = await prisma.sprint.create({
    data: {
      projectId: pgsLotte.id,
      name: "Đợt 1: Khảo sát mặt bằng hầm B1-B3 & Nhập bản vẽ CAD",
      goal: "Chuyển đổi sơ đồ kiến trúc AutoCAD thành tọa độ các ô đỗ và cấu hình địa chỉ IP các tủ ZCU.",
      status: "COMPLETED",
      startDate: daysAgo(30),
      endDate: daysAgo(16),
    },
  });

  const lotteSprint2 = await prisma.sprint.create({
    data: {
      projectId: pgsLotte.id,
      name: "Đợt 2: Lắp đặt thiết bị, Kiosk & Tùy biến Song ngữ Việt - Hàn",
      goal: "Lắp đặt 6 trạm Kiosk tại sảnh thang máy, hiệu chỉnh giao diện tiếng Hàn và mẫu báo cáo Excel riêng của Lotte.",
      status: "ACTIVE",
      startDate: daysAgo(7),
      endDate: daysFromNow(7),
    },
  });

  const lotteTasks = [
    {
      num: 1, title: "Khảo sát thực địa và chuẩn hóa bản vẽ tọa độ 1200 ô đỗ xe hầm B1, B2, B3",
      sprint: lotteSprint1.id, status: "DONE" as const, prio: "HIGH" as const, sp: 5, assignee: devBinh.id, labels: ["phase:survey"],
      desc: "Trích xuất tọa độ X, Y của từng vị trí đỗ từ bản vẽ CAD để nạp vào cơ sở dữ liệu sơ đồ Kiosk.", completedDays: 18,
    },
    {
      num: 2, title: "Gán dải địa chỉ IP tĩnh và cấu hình 12 tủ điều khiển ZCU hiện trường",
      sprint: lotteSprint1.id, status: "DONE" as const, prio: "MEDIUM" as const, sp: 3, assignee: devChi.id, labels: ["phase:hardware"],
      desc: "Cấu hình dải mạng VLAN riêng của bãi xe: 192.168.10.100 - 192.168.10.112.", completedDays: 17,
    },
    {
      num: 3, title: "Tùy biến gói tài nguyên đa ngôn ngữ: Thêm tiếng Hàn (Korean) cho màn hình Kiosk",
      sprint: lotteSprint2.id, status: "IN_PROGRESS" as const, prio: "URGENT" as const, sp: 3, assignee: devChi.id, labels: ["phase:custom"],
      desc: "Tạo file resource Strings.ko-KR.axaml, dịch thuật toàn bộ các câu hướng dẫn tìm xe, thông báo vị trí và lỗi sang tiếng Hàn chuẩn.",
    },
    {
      num: 4, title: "Viết module xuất báo cáo thống kê doanh thu và tỷ lệ lấp đầy theo mẫu Excel của Lotte",
      sprint: lotteSprint2.id, status: "IN_PROGRESS" as const, prio: "HIGH" as const, sp: 5, assignee: devBinh.id, labels: ["phase:custom"],
      desc: "Sử dụng ClosedXML xuất bảng tính theo đúng form chuẩn của tập đoàn Lotte Hàn Quốc (gồm logo Lotte, font Malgun Gothic, công thức thuế VAT riêng).",
    },
    {
      num: 5, title: "Lắp đặt và căn chỉnh 6 màn hình Kiosk cảm ứng tại sảnh thang máy trung tâm",
      sprint: lotteSprint2.id, status: "IN_REVIEW" as const, prio: "MEDIUM" as const, sp: 3, assignee: devChi.id, labels: ["phase:hardware"],
      desc: "Cố định chân đế Kiosk, cắm nguồn UPS dự phòng, đấu nối cáp mạng LAN và chạy thử nghiệm tìm xe tại chỗ.",
    },
    {
      num: 6, title: "Nghiệm thu tổng thể 48h liên tục cùng Ban Quản lý Tòa nhà Lotte Mall",
      sprint: lotteSprint2.id, status: "TODO" as const, prio: "HIGH" as const, sp: 3, assignee: pmAlice.id, labels: ["phase:acceptance"],
      desc: "Kiểm tra độ chính xác báo chỗ trống, thời gian tìm xe dưới 2 giây và ký biên bản bàn giao giai đoạn 1.",
    },
  ];

  for (const t of lotteTasks) {
    await createTask({
      projectId: pgsLotte.id, sprintId: t.sprint, number: t.num,
      title: t.title, description: t.desc, type: "TASK", status: t.status, priority: t.prio, storyPoints: t.sp,
      assigneeId: t.assignee, labelMap: lotteLabelMap, labels: t.labels, daysAgoCompleted: t.completedDays,
    });
  }

  // ===========================================================================
  // DỰ ÁN 3 (TÌNH HUỐNG B): [PGS-KNG] - BẢO TRÌ BÃI XE KEANGNAM (LEGACY WINFORMS)
  // ===========================================================================
  console.log("\n🔧 Đang tạo Dự án 3 (Tình huống B): [PGS-KNG] Bảo trì & Hỗ trợ kỹ thuật - Keangnam Landmark 72...");
  const pgsKeangnam = await prisma.project.create({
    data: {
      name: "Bảo trì & Hỗ trợ kỹ thuật - Keangnam Landmark 72",
      key: "PGS-KNG",
      description: `Hợp đồng bảo trì hệ thống hướng dẫn đỗ xe chạy trên nền tảng Windows Forms cũ (triển khai từ 2021):
- Quy mô: 2 tầng hầm (B1, B2), 800 vị trí đỗ.
- Hiện trạng: Cần xử lý sự cố đơ cổng COM ZCU khi tải cao, thay thế cảm biến hỏng định kỳ và bảo đảm hệ thống vận hành liên tục 24/7.`,
      status: "IN_PROGRESS",
      ownerId: admin.id,
      members: {
        create: [
          { userId: admin.id, role: "OWNER" },
          { userId: devBinh.id, role: "MEMBER" },
          { userId: devChi.id, role: "MEMBER" },
        ],
      },
    },
  });

  const kngLabels = [
    { name: "type:hotfix", color: "#EF4444" },
    { name: "type:maintenance", color: "#F59E0B" },
    { name: "type:hardware", color: "#0284C7" },
  ];
  const kngLabelMap = new Map<string, string>();
  for (const lb of kngLabels) {
    const l = await prisma.label.create({
      data: { projectId: pgsKeangnam.id, name: lb.name, color: lb.color },
    });
    kngLabelMap.set(lb.name, l.id);
  }

  const kngSprint = await prisma.sprint.create({
    data: {
      projectId: pgsKeangnam.id,
      name: "Đợt Bảo trì Q4/2026: Sửa lỗi cổng COM & Thay thế thiết bị hỏng",
      goal: "Khắc phục triệt để lỗi tràn buffer SerialPort trên bản WinForms và thay thế 8 cảm biến siêu âm hỏng tại hầm B2.",
      status: "ACTIVE",
      startDate: daysAgo(5),
      endDate: daysFromNow(9),
    },
  });

  const kngTasks = [
    {
      num: 1, title: "HOTFIX: Sửa lỗi tràn bộ đệm SerialPort gây đơ ZCU trên bản WinForms cũ",
      status: "IN_PROGRESS" as const, prio: "URGENT" as const, sp: 5, assignee: devBinh.id, labels: ["type:hotfix"],
      desc: "Checkout nhánh code WinForms cũ tại windows/ZCU, bổ sung lệnh DiscardInBuffer() trước mỗi vòng đọc chu kỳ poll để không bị treo ứng dụng khi có hơn 50 bản tin dồn về cùng lúc.",
    },
    {
      num: 2, title: "Thay thế 8 cảm biến siêu âm bị ẩm mốc chập chờn tại khu vực rửa xe hầm B2",
      status: "DONE" as const, prio: "HIGH" as const, sp: 3, assignee: devChi.id, labels: ["type:hardware", "type:maintenance"],
      desc: "Thay thế cảm biến kháng nước thế hệ mới của KZTEK, gán lại ID dip-switch từ địa chỉ 0x11 đến 0x18.", completedDays: 3,
    },
    {
      num: 3, title: "Hiệu chuẩn và căn chỉnh góc chiếu bảng LED báo chỗ trống ngoài cổng đường Phạm Hùng",
      status: "DONE" as const, prio: "MEDIUM" as const, sp: 2, assignee: devChi.id, labels: ["type:hardware"],
      desc: "Vệ sinh mặt mica bảng LED ngoài trời, kiểm tra nguồn tổ ong 5V và siết lại ốc gá chống rung lắc.", completedDays: 2,
    },
    {
      num: 4, title: "Tối ưu hóa và nén cơ sở dữ liệu SQL Server Express 2014 của Keangnam",
      status: "TODO" as const, prio: "MEDIUM" as const, sp: 3, assignee: devBinh.id, labels: ["type:maintenance"],
      desc: "Chạy script thu nhỏ (Shrink Database) và xóa log giao dịch cũ hơn 1 năm để giải phóng dung lượng ổ C máy chủ.",
    },
    {
      num: 5, title: "Đề xuất nâng cấp lên bản Avalonia & API (Chuẩn bị gửi Ban Quản trị Keangnam)",
      status: "TODO" as const, prio: "LOW" as const, sp: 2, assignee: pmAlice.id, labels: ["type:maintenance"],
      desc: "Soạn tài liệu so sánh ưu điểm khi nâng cấp lên phiên bản Avalonia mới: không lo đơ cổng COM, tra cứu xe nhanh gấp 3 lần và hỗ trợ thanh toán QR.",
    },
  ];

  for (const t of kngTasks) {
    await createTask({
      projectId: pgsKeangnam.id, sprintId: kngSprint.id, number: t.num,
      title: t.title, description: t.desc, type: "TASK", status: t.status, priority: t.prio, storyPoints: t.sp,
      assigneeId: t.assignee, labelMap: kngLabelMap, labels: t.labels, daysAgoCompleted: t.completedDays,
    });
  }

  // ===========================================================================
  // DỰ ÁN 4 (TÌNH HUỐNG C): [PGS-VCM] - NÂNG CẤP VINCOM SMART CITY (AVALONIA + API)
  // ===========================================================================
  console.log("\n🚀 Đang tạo Dự án 4 (Tình huống C): [PGS-VCM] Nâng cấp & Triển khai - Vincom Mega Mall Smart City...");
  const pgsVincom = await prisma.project.create({
    data: {
      name: "Nâng cấp & Triển khai - Vincom Mega Mall Smart City",
      key: "PGS-VCM",
      description: `Dự án nâng cấp toàn diện hệ thống báo chỗ đỗ xe tại Vincom Mega Mall Smart City:
- Chuyển đổi toàn bộ trạm Kiosk tìm xe WinForms cũ sang Kiosk Avalonia Multiplatform v8.
- Kết nối tập trung với IPGS.API của hệ thống quản lý bãi đỗ xe trung tâm iParking của tập đoàn Vingroup.
- Kích hoạt cổng thanh toán VietQR động không tiền mặt tại tất cả các trạm Kiosk.`,
      status: "PLANNING",
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

  const vcmLabels = [
    { name: "step:upgrade", color: "#EC4899" },
    { name: "step:api-sync", color: "#6366F1" },
    { name: "step:payment", color: "#10B981" },
  ];
  const vcmLabelMap = new Map<string, string>();
  for (const lb of vcmLabels) {
    const l = await prisma.label.create({
      data: { projectId: pgsVincom.id, name: lb.name, color: lb.color },
    });
    vcmLabelMap.set(lb.name, l.id);
  }

  const vcmSprint1 = await prisma.sprint.create({
    data: {
      projectId: pgsVincom.id,
      name: "Sprint 1: Cài đặt Kiosk Avalonia v8 & Tích hợp iParking Gateway",
      goal: "Cài đặt bản Kiosk Avalonia trên 8 máy trạm tại Vincom và kết nối dữ liệu xe vào/ra từ iParking.",
      status: "PLANNING",
      startDate: daysFromNow(5),
      endDate: daysFromNow(19),
    },
  });

  const vcmTasks = [
    {
      num: 1, title: "Khảo sát cấu hình phần cứng 8 máy trạm Kiosk hiện hữu tại Vincom Smart City",
      status: "TODO" as const, prio: "HIGH" as const, sp: 3, assignee: devChi.id, labels: ["step:upgrade"],
      desc: "Kiểm tra RAM, CPU, driver màn hình cảm ứng để bảo đảm đủ điều kiện chạy Avalonia .NET 8 mượt mà.",
    },
    {
      num: 2, title: "Triển khai cài đặt bản Kiosk Avalonia mới nhất đóng gói từ dự án PGS Core",
      status: "TODO" as const, prio: "URGENT" as const, sp: 5, assignee: devBinh.id, labels: ["step:upgrade"],
      desc: "Cài đặt gói release PGS-Kiosk-v8-Release lên các máy trạm, cấu hình file appsettings.json trỏ về server IPGS.API.",
    },
    {
      num: 3, title: "Tích hợp API đồng bộ biển số xe và thời gian vào bãi với hệ thống iParking",
      status: "TODO" as const, prio: "HIGH" as const, sp: 5, assignee: devBinh.id, labels: ["step:api-sync"],
      desc: "Gọi endpoint của iParking để tra cứu mã vé thẻ từ khớp với biển số xe nhận diện tại ô đỗ.",
    },
    {
      num: 4, title: "Cấu hình tài khoản ngân hàng và kích hoạt thanh toán VietQR động tại Kiosk Vincom",
      status: "TODO" as const, prio: "HIGH" as const, sp: 5, assignee: devBinh.id, labels: ["step:payment"],
      desc: "Liên kết module IPGS.API.Payments với tài khoản Vietcombank của BQL Vincom Smart City, test quét mã thanh toán 50 giao dịch thử nghiệm.",
    },
    {
      num: 5, title: "Tập huấn và chuyển giao sử dụng phần mềm Kiosk mới cho đội ngũ vận hành Vincom",
      status: "TODO" as const, prio: "LOW" as const, sp: 2, assignee: pmAlice.id, labels: ["step:upgrade"],
      desc: "Hướng dẫn đội trưởng an ninh cách xem lịch sử tìm xe, tra cứu xe đỗ sai vị trí và hướng dẫn khách quét mã QR.",
    },
  ];

  for (const t of vcmTasks) {
    await createTask({
      projectId: pgsVincom.id, sprintId: vcmSprint1.id, number: t.num,
      title: t.title, description: t.desc, type: "TASK", status: t.status, priority: t.prio, storyPoints: t.sp,
      assigneeId: t.assignee, labelMap: vcmLabelMap, labels: t.labels, daysDue: 18,
    });
  }

  console.log("\n=================================================================");
  console.log("🎉 TẠO DỮ LIỆU THÀNH CÔNG CHO TOÀN BỘ 4 DỰ ÁN VỚI ĐỘ SÂU CHUYÊN NGHIỆP!");
  console.log(`  1. [PGS]     : Core R&D Project (${taskNum - 1} tasks chi tiết ZCU Camera & CRUD Data)`);
  console.log("  2. [PGS-LTT] : Lotte Mall Tây Hồ - Customization (6 tasks, 2 sprints)");
  console.log("  3. [PGS-KNG] : Keangnam Landmark 72 - Legacy Maintenance (5 tasks, 1 sprint)");
  console.log("  4. [PGS-VCM] : Vincom Smart City - Upgrade Migration (5 tasks, 1 sprint)");
  console.log(`  Tổng cộng: ${taskNum - 1 + 16} tasks chi tiết chuẩn thực chiến.`);
  console.log("=================================================================");
}

main()
  .catch((e) => {
    console.error("LỖI KHI TẠO DỮ LIỆU:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
