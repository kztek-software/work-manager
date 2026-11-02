const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const SCREENSHOT_DIR = path.resolve(__dirname, "..", "docs", "ux-review", "screenshots", "2026-11-02-gate1");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.whenReady().then(async () => {
  console.log("=== BẮT ĐẦU CHỤP BỘ SCREENSHOT GATE 1 THEO CHUẨN C1-C7 ===");

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      offscreen: true,
    },
  });

  win.webContents.on("console-message", (event, level, message) => {
    // console.log("[BROWSER CONSOLE]", message);
  });

  try {
    // -------------------------------------------------------------
    // BƯỚC 1: MÀN HÌNH ĐĂNG NHẬP (01-login-screen.png)
    // -------------------------------------------------------------
    console.log("[1/4] Đang chụp trang /login...");
    await win.loadURL("http://localhost:3000/login");
    await sleep(2500);

    let image = await win.webContents.capturePage();
    const loginFile = path.join(SCREENSHOT_DIR, "01-login-screen.png");
    fs.writeFileSync(loginFile, image.toPNG());
    console.log("  -> Đã lưu 01-login-screen.png:", image.getSize());

    // -------------------------------------------------------------
    // BƯỚC 2: MÀN HÌNH ĐĂNG KÝ BỊ KHÓA (02-register-screen.png)
    // -------------------------------------------------------------
    console.log("[2/4] Đang chụp trang /register...");
    await win.loadURL("http://localhost:3000/register");
    await sleep(2500);

    image = await win.webContents.capturePage();
    const registerFile = path.join(SCREENSHOT_DIR, "02-register-screen.png");
    fs.writeFileSync(registerFile, image.toPNG());
    console.log("  -> Đã lưu 02-register-screen.png:", image.getSize());

    // -------------------------------------------------------------
    // BƯỚC 3: ĐĂNG NHẬP HỆ THỐNG
    // -------------------------------------------------------------
    console.log("[*] Đang thực hiện đăng nhập tài khoản Quản trị viên...");
    await win.loadURL("http://localhost:3000/login");
    await sleep(2000);

    await win.webContents.executeJavaScript(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const adminBtn = btns.find(b => b.textContent && b.textContent.includes('Admin Mặc Định'));
        if (adminBtn) {
          adminBtn.click();
          return 'Clicked';
        }
        return 'Not found';
      })()
    `);

    // Chờ đăng nhập và điều hướng sang trang chủ / dashboard
    await sleep(4000);
    console.log("  -> Trang sau khi đăng nhập:", win.webContents.getURL());

    // -------------------------------------------------------------
    // BƯỚC 4: BOARD & TASK DIALOG VỚI WYSIWYG & RICHMARKDOWN (03)
    // -------------------------------------------------------------
    console.log("[3/4] Đang mở Board để kích hoạt TaskDialog & WysiwygEditor...");
    await win.loadURL("http://localhost:3000/board");
    await sleep(4000);

    // Click vào task card
    const clickTask = await win.webContents.executeJavaScript(`
      (() => {
        // Tìm element chứa text "Thiết kế design system"
        const all = Array.from(document.querySelectorAll('*'));
        const match = all.find(el => el.textContent && el.textContent.includes('Thiết kế design system') && el.children.length === 0);
        if (match) {
          const card = match.closest('[role="button"]') || match.closest('.cursor-pointer') || match.parentElement;
          if (card) { card.click(); return 'Clicked targeted task'; }
          match.click();
          return 'Clicked match directly';
        }
        // Fallback: click thẻ đầu tiên có cursor-pointer
        const anyCard = document.querySelector('[role="button"], [class*="cursor-pointer"]');
        if (anyCard) { anyCard.click(); return 'Clicked any card'; }
        return 'No card found';
      })()
    `);
    console.log("  -> Trạng thái mở TaskDialog:", clickTask);
    await sleep(2500);

    // Kích hoạt WysiwygEditor bằng nút Chỉnh sửa
    const clickEdit = await win.webContents.executeJavaScript(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const editBtn = btns.find(b => b.textContent && b.textContent.includes('Chỉnh sửa'));
        if (editBtn) {
          editBtn.click();
          return 'Clicked edit button';
        }
        // Click vào khối mô tả nếu có
        const descDiv = Array.from(document.querySelectorAll('div')).find(d => d.textContent && d.textContent.includes('Quy Chuẩn Giao Diện'));
        if (descDiv) {
          descDiv.click();
          return 'Clicked desc container';
        }
        return 'No edit target found';
      })()
    `);
    console.log("  -> Trạng thái mở WysiwygEditor:", clickEdit);
    await sleep(2500);

    image = await win.webContents.capturePage();
    const wysiwygFile = path.join(SCREENSHOT_DIR, "03-wysiwyg-editor-richmarkdown.png");
    fs.writeFileSync(wysiwygFile, image.toPNG());
    console.log("  -> Đã lưu 03-wysiwyg-editor-richmarkdown.png:", image.getSize());

    // -------------------------------------------------------------
    // BƯỚC 5: DESKTOP WORKSTATION (/desktop) (04)
    // -------------------------------------------------------------
    console.log("[4/4] Đang điều hướng tới /desktop Workstation Portal...");
    await win.loadURL("http://localhost:3000/desktop");
    await sleep(4000);

    // Chọn task trong danh sách bên trái để hiển thị chi tiết bên phải
    const selectTask = await win.webContents.executeJavaScript(`
      (() => {
        const items = Array.from(document.querySelectorAll('*')).filter(el => 
          el.textContent && el.textContent.includes('Thiết kế design system') && el.children.length === 0
        );
        if (items.length > 0) {
          const clickable = items[0].closest('div[class*="cursor-pointer"]') || items[0].parentElement;
          if (clickable) {
            clickable.click();
            return 'Selected task in split view';
          }
        }
        return 'Default task already selected';
      })()
    `);
    console.log("  -> Trạng thái chọn task trên /desktop:", selectTask);
    await sleep(2500);

    image = await win.webContents.capturePage();
    const desktopFile = path.join(SCREENSHOT_DIR, "04-desktop-workstation.png");
    fs.writeFileSync(desktopFile, image.toPNG());
    console.log("  -> Đã lưu 04-desktop-workstation.png:", image.getSize());

    console.log("\n🎉 ĐÃ CHỤP THÀNH CÔNG TOÀN BỘ 4 MÀN HÌNH CHUẨN GATE 1!");
  } catch (err) {
    console.error("❌ Lỗi chụp ảnh:", err);
  } finally {
    app.quit();
  }
});
