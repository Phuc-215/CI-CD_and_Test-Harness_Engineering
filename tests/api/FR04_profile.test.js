const http = require('http');

async function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    body: data ? JSON.parse(data) : null
                });
            });
        });

        req.on('error', (e) => reject(e));

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    console.log("--- Bắt đầu kiểm thử FR-04 qua API (Full Cover) ---");
    
    // 1. Đăng nhập để lấy token
    console.log("Đăng nhập bằng tài khoản test...");
    const loginRes = await request('POST', '/api/login', {
        email: 'test@eshop.com',
        password: 'Test1234!'
    });
    
    if (!loginRes.body || !loginRes.body.token) {
        console.error("Lỗi đăng nhập! Không thể lấy token.", loginRes);
        return;
    }
    
    const token = loginRes.body.token;
    console.log("Đăng nhập thành công, lấy được Token.");
    console.log("---------------------------------------");

    const testCases = [
        { id: "TC_FR04_D1", desc: "Hợp lệ", payload: { name: "Nguyen Van A", shipping_address: "123 Le Loi", phone: "0912345678" }, expectedStatus: 200 },
        { id: "TC_FR04_D2", desc: "Phone sai prefix", payload: { name: "Nguyen Van A", shipping_address: "123 Le Loi", phone: "9912345678" }, expectedStatus: 400 },
        { id: "TC_FR04_D3", desc: "Phone ngắn", payload: { name: "Nguyen Van A", shipping_address: "123 Le Loi", phone: "0123456" }, expectedStatus: 400 },
        { id: "TC_FR04_D4", desc: "Phone dài", payload: { name: "Nguyen Van A", shipping_address: "123 Le Loi", phone: "0123456789012345" }, expectedStatus: 400 },
        { id: "TC_FR04_D5", desc: "Phone chứa chữ", payload: { name: "Nguyen Van A", shipping_address: "123 Le Loi", phone: "09123abc78" }, expectedStatus: 400 },
        { id: "TC_FR04_D6", desc: "Phone rỗng", payload: { name: "Nguyen Van A", shipping_address: "123 Le Loi", phone: "" }, expectedStatus: 400 },
        
        { id: "TC_FR04_D7", desc: "Tên rỗng", payload: { name: "", shipping_address: "123 Le Loi", phone: "0912345678" }, expectedStatus: 400 },
        { id: "TC_FR04_D8", desc: "Địa chỉ rỗng", payload: { name: "Nguyen Van A", shipping_address: "", phone: "0912345678" }, expectedStatus: 400 },
        
        { id: "TC_FR04_D9", desc: "Đổi email (Hacker)", payload: { name: "Nguyen Van A", shipping_address: "123 Le Loi", phone: "0912345678", email: "hacker@eshop.com" }, expectedStatus: 200, checkField: "email" },
        { id: "TC_FR04_D10", desc: "Đổi role (Hacker)", payload: { name: "Nguyen Van A", shipping_address: "123 Le Loi", phone: "0912345678", role: "admin" }, expectedStatus: 200, checkField: "role" },

        { id: "TC_FR04_B1", desc: "BVA - Phone (9)", payload: { name: "Nguyen Van A", shipping_address: "123 Le Loi", phone: "012345678" }, expectedStatus: 400 },
        { id: "TC_FR04_B2", desc: "BVA - Phone (10)", payload: { name: "Nguyen Van A", shipping_address: "123 Le Loi", phone: "0123456789" }, expectedStatus: 200 },
        { id: "TC_FR04_B3", desc: "BVA - Phone (11)", payload: { name: "Nguyen Van A", shipping_address: "123 Le Loi", phone: "01234567890" }, expectedStatus: 200 },
        { id: "TC_FR04_B4", desc: "BVA - Phone (12)", payload: { name: "Nguyen Van A", shipping_address: "123 Le Loi", phone: "012345678901" }, expectedStatus: 400 }
    ];

    let mdOutput = "# Kết quả kiểm thử FR-04 qua API\n\n";
    mdOutput += "| TC_ID | Loại Test | Payload test | API Status | Cập nhật thực tế | Pass/Fail |\n";
    mdOutput += "|---|---|---|---|---|---|\n";

    for (const tc of testCases) {
        console.log(`Đang chạy: ${tc.id} - ${tc.desc}`);
        const res = await request('PUT', '/api/users/me', tc.payload, token);
        const status = res.status;
        
        let isPass = false;
        let actualResultText = "Status: " + status;
        
        if (tc.expectedStatus === 200) {
            isPass = (status === 200);
        } else {
            isPass = (status !== 200);
        }

        // Kiểm tra bảo mật (D9, D10)
        if (tc.checkField && status === 200) {
            // Fetch lại profile để xem hacker có đổi được không
            const profileRes = await request('GET', '/api/users/me', null, token);
            if (profileRes.status === 200) {
                const user = profileRes.body;
                if (tc.checkField === "email") {
                    if (user.email === "hacker@eshop.com") {
                        isPass = false; // Bị hack
                        actualResultText = "Nguy hiểm: Email bị đổi thành hacker!";
                    } else {
                        isPass = true; // An toàn
                        actualResultText = "An toàn: Email giữ nguyên là " + user.email;
                    }
                }
                if (tc.checkField === "role") {
                    if (user.role === "admin") {
                        isPass = false; // Bị hack
                        actualResultText = "Nguy hiểm: Quyền bị nâng lên Admin!";
                    } else {
                        isPass = true; // An toàn
                        actualResultText = "An toàn: Quyền giữ nguyên là " + user.role;
                    }
                }
            }
        }

        const passFailText = isPass ? "✅ PASS" : "❌ FAIL (BUG)";
        mdOutput += `| ${tc.id} | ${tc.desc} | \`${JSON.stringify(tc.payload)}\` | ${status} | ${actualResultText} | **${passFailText}** |\n`;
        
        console.log(`-> ${actualResultText} -> ${passFailText}\n`);
        
        // Reset role / email back if hacked
        if (!isPass && tc.checkField) {
            await request('PUT', '/api/users/me', { name: "Nguyen Van A", email: "test@eshop.com", role: "user" }, token);
        }
    }

    const fs = require('fs');
    fs.writeFileSync('docs/test-results/FR04_TestResults.md', mdOutput);
    console.log("Đã xuất kết quả ra file docs/test-results/FR04_TestResults.md");
}

runTests();
