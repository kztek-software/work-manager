/**
 * Automated E2E Verification Script for Mobile REST APIs & Bearer Token Authentication
 * KZTEK Work Management - Phase 3
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

async function runTests() {
  console.log("=================================================");
  console.log("🚀 STARTING MOBILE REST API E2E VERIFICATION TEST");
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Test Login & Get Bearer Token
    console.log("--- 1. Testing POST /api/auth/login ---");
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@kztek.net", password: "Kztek@2026" })
    });

    assert(loginRes.status === 200, `Login status code 200 (Got: ${loginRes.status})`);
    const loginData = await loginRes.json();
    assert(!!loginData.token, "Response contains JWT token string");
    assert(loginData.user && loginData.user.email === "admin@kztek.net", "User profile returned correctly");

    const token = loginData.token;
    const authHeaders = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    };

    // 2. Test GET /api/auth/me with Bearer Token
    console.log("\n--- 2. Testing GET /api/auth/me with Bearer Header ---");
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: authHeaders });
    assert(meRes.status === 200, `Auth Me status 200 (Got: ${meRes.status})`);
    const meData = await meRes.json();
    assert(meData.user && meData.user.id === loginData.user.id, "Auth Me validated Bearer token successfully");

    // 3. Test GET /api/projects
    console.log("\n--- 3. Testing GET /api/projects ---");
    const projRes = await fetch(`${BASE_URL}/api/projects`, { headers: authHeaders });
    assert(projRes.status === 200, `Projects list status 200 (Got: ${projRes.status})`);
    const projData = await projRes.json();
    const projects = projData.projects || projData;
    assert(Array.isArray(projects) && projects.length > 0, `Projects retrieved (${projects.length} projects found)`);
    const sampleProject = projects[0];
    console.log(`ℹ️ Selected Test Project: ${sampleProject.name} (ID: ${sampleProject.id})`);

    // 4. Test GET /api/projects/[id]/tasks
    console.log(`\n--- 4. Testing GET /api/projects/${sampleProject.id}/tasks ---`);
    const tasksRes = await fetch(`${BASE_URL}/api/projects/${sampleProject.id}/tasks`, { headers: authHeaders });
    assert(tasksRes.status === 200, `Tasks list status 200 (Got: ${tasksRes.status})`);
    const tasksData = await tasksRes.json();
    const tasks = tasksData.tasks || tasksData;
    assert(Array.isArray(tasks), `Tasks retrieved (${tasks.length} tasks found)`);

    // 5. Test POST /api/projects/[id]/tasks (Create Mobile Task)
    console.log(`\n--- 5. Testing POST /api/projects/${sampleProject.id}/tasks (Create Task) ---`);
    const testTaskTitle = `[Mobile Test] Kiem thu Avalonia API ${Date.now()}`;
    const createTaskRes = await fetch(`${BASE_URL}/api/projects/${sampleProject.id}/tasks`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        title: testTaskTitle,
        description: "Task tao tu kich ban automated test cua C# Avalonia Mobile Client",
        type: "TASK",
        status: "TODO",
        priority: "HIGH"
      })
    });
    assert(createTaskRes.status === 200 || createTaskRes.status === 201, `Create Task status (Got: ${createTaskRes.status})`);
    const createdTaskData = await createTaskRes.json();
    const createdTask = createdTaskData.task || createdTaskData;
    assert(createdTask && createdTask.title === testTaskTitle, "Task created successfully with correct title");

    // 6. Test PATCH /api/projects/[id]/tasks/[taskId] (Update Status)
    if (createdTask && createdTask.id) {
      console.log(`\n--- 6. Testing PATCH /api/projects/${sampleProject.id}/tasks/${createdTask.id} ---`);
      const updateRes = await fetch(`${BASE_URL}/api/projects/${sampleProject.id}/tasks/${createdTask.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ status: "IN_PROGRESS" })
      });
      assert(updateRes.status === 200, `Update Task status 200 (Got: ${updateRes.status})`);
      const updatedData = await updateRes.json();
      const updatedTask = updatedData.task || updatedData;
      assert(updatedTask && updatedTask.status === "IN_PROGRESS", "Task status transitioned to IN_PROGRESS");

      // 7. Test POST Comment
      console.log(`\n--- 7. Testing POST /api/projects/${sampleProject.id}/tasks/${createdTask.id}/comments ---`);
      const commentRes = await fetch(`${BASE_URL}/api/projects/${sampleProject.id}/tasks/${createdTask.id}/comments`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ body: "Binh luan kiem thu tu Mobile App C# Avalonia" })
      });
      assert(commentRes.status === 200 || commentRes.status === 201, `Create Comment status (Got: ${commentRes.status})`);
    }

    // 8. Test GET /api/tickets
    console.log("\n--- 8. Testing GET /api/tickets ---");
    const ticketsRes = await fetch(`${BASE_URL}/api/tickets`, { headers: authHeaders });
    assert(ticketsRes.status === 200, `Tickets status 200 (Got: ${ticketsRes.status})`);
    const ticketsData = await ticketsRes.json();
    const tickets = ticketsData.tickets || [];
    assert(Array.isArray(ticketsData.tickets), `Tickets retrieved (${tickets.length} tickets found)`);
    // Module Ticket mới: response kèm danh sách dự án lọc + cờ quyền; admin luôn có tickets.assign
    assert(Array.isArray(ticketsData.projects), "Tickets response includes project filter options");
    assert(ticketsData.canAssign === true, "Admin has tickets.assign (sees all tickets, incl. unassigned)");
    assert(tickets.every((t) => t.capabilities && typeof t.capabilities.canWrite === "boolean"), "Each ticket carries capabilities");

    // 8b. Bộ lọc ticket chưa gán (không phân biệt hoa thường)
    console.log("\n--- 8b. Testing GET /api/tickets?projectId=unassigned ---");
    const unassignedRes = await fetch(`${BASE_URL}/api/tickets?projectId=unassigned`, { headers: authHeaders });
    assert(unassignedRes.status === 200, `Unassigned tickets status 200 (Got: ${unassignedRes.status})`);
    const unassignedData = await unassignedRes.json();
    assert(
      (unassignedData.tickets || []).every((t) => !t.projectId),
      "Unassigned filter returns only tickets without project"
    );

    // 8c. Chi tiết ticket nội bộ bắt buộc đăng nhập; tra cứu công khai không lộ dữ liệu nội bộ
    if (tickets.length > 0) {
      const sampleTicket = tickets[0];
      console.log(`\n--- 8c. Testing GET /api/tickets/${sampleTicket.id} (auth + public lookup) ---`);
      const anonRes = await fetch(`${BASE_URL}/api/tickets/${sampleTicket.id}`);
      assert(anonRes.status === 401, `Internal ticket detail requires auth (Got: ${anonRes.status})`);

      const detailRes = await fetch(`${BASE_URL}/api/tickets/${sampleTicket.id}`, { headers: authHeaders });
      assert(detailRes.status === 200, `Ticket detail with Bearer token status 200 (Got: ${detailRes.status})`);

      const publicRes = await fetch(`${BASE_URL}/api/tickets/public/${encodeURIComponent(sampleTicket.trackingCode)}`);
      assert(publicRes.status === 200, `Public tracking lookup status 200 (Got: ${publicRes.status})`);
      const publicData = await publicRes.json();
      const pub = publicData.ticket || {};
      assert(
        pub.project === undefined && pub.projectId === undefined && pub.internalNotes === undefined,
        "Public lookup hides internal project & notes"
      );
      assert(
        (pub.comments || []).every((c) => !c.isInternalOnly && !c.authorEmail),
        "Public lookup hides internal comments & author emails"
      );
    }

    // 9. Test GET /api/notifications
    console.log("\n--- 9. Testing GET /api/notifications ---");
    const notiRes = await fetch(`${BASE_URL}/api/notifications`, { headers: authHeaders });
    assert(notiRes.status === 200, `Notifications status 200 (Got: ${notiRes.status})`);
    const notiData = await notiRes.json();
    assert(Array.isArray(notiData.notifications || notiData), "Notifications retrieved successfully");

  } catch (err) {
    console.error("💥 Fatal error during API execution:", err);
    failed++;
  }

  console.log("\n=================================================");
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
