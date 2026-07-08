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
                let parsed = data;
                try { parsed = JSON.parse(data); } catch(e) {}
                resolve({
                    status: res.statusCode,
                    body: parsed
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
    console.log("--- Bắt đầu kiểm thử FR-09 (Mã giảm giá) qua API ---");
    
    // 1. Đăng nhập để lấy token
    const loginRes = await request('POST', '/api/login', {
        email: 'test@eshop.com',
        password: 'Test1234!'
    });
    
    if (!loginRes.body || !loginRes.body.token) {
        console.error("Lỗi đăng nhập! Không thể lấy token.");
        return;
    }
    const token = loginRes.body.token;
    const userId = loginRes.body.user ? loginRes.body.user.id : 1;
    console.log(`Đăng nhập thành công, Token OK. User ID: ${userId}`);
    console.log("---------------------------------------");

    const testCases = [
        { id: "TC_FR09_D1", desc: "Domain - SAVE10 Hợp lệ (percent)", payload: { code: "SAVE10", total_amount: 400000, user_id: userId }, useToken: true, expectedStatus: 200, checkDiscount: 40000 },
        { id: "TC_FR09_D2", desc: "Domain - BIGBUY Hợp lệ (fixed)", payload: { code: "BIGBUY", total_amount: 600000, user_id: userId }, useToken: true, expectedStatus: 200, checkDiscount: 50000 },
        { id: "TC_FR09_D3", desc: "Domain - Mã không tồn tại", payload: { code: "KHONGCO", total_amount: 400000, user_id: userId }, useToken: true, expectedStatus: 400 },
        { id: "TC_FR09_D4", desc: "Domain - Mã bị khóa (LOCKEDCODE)", payload: { code: "LOCKEDCODE", total_amount: 400000, user_id: userId }, useToken: true, expectedStatus: 400 },
        { id: "TC_FR09_D5", desc: "Domain - Mã hết hạn (EXPIRED)", payload: { code: "EXPIRED", total_amount: 400000, user_id: userId }, useToken: true, expectedStatus: 400 },
        { id: "TC_FR09_D6", desc: "Domain - Không đủ tiền", payload: { code: "SAVE10", total_amount: 200000, user_id: userId }, useToken: true, expectedStatus: 400 },
        { id: "TC_FR09_D7", desc: "Domain - Không có token", payload: { code: "SAVE10", total_amount: 400000, user_id: userId }, useToken: false, expectedStatus: 401 },
        { id: "TC_FR09_B1", desc: "BVA - Thiếu 1 đồng", payload: { code: "SAVE10", total_amount: 299999, user_id: userId }, useToken: true, expectedStatus: 400 },
        { id: "TC_FR09_B2", desc: "BVA - Vừa đủ tiền", payload: { code: "SAVE10", total_amount: 300000, user_id: userId }, useToken: true, expectedStatus: 200, checkDiscount: 30000 },
    ];

    let mdOutput = "# Kết quả kiểm thử FR-09 (Apply Coupon) qua API\n\n";
    mdOutput += "| TC_ID | Loại Test | Payload test | HTTP Status | Response Data | Pass/Fail |\n";
    mdOutput += "|---|---|---|---|---|---|\n";

    for (const tc of testCases) {
        console.log(`Đang chạy: ${tc.id} - ${tc.desc}`);
        const currentToken = tc.useToken ? token : null;
        const res = await request('POST', '/api/apply-coupon', tc.payload, currentToken);
        
        let isPass = false;
        let responseText = typeof res.body === 'object' ? JSON.stringify(res.body) : res.body;

        if (tc.expectedStatus === 200) {
            if (res.status === 200) {
                if (tc.checkDiscount && res.body && res.body.discount_amount === tc.checkDiscount) {
                    isPass = true;
                } else if (!tc.checkDiscount) {
                    isPass = true;
                } else {
                    responseText += ` (Sai số tiền. Mong đợi: ${tc.checkDiscount})`;
                }
            }
        } else {
            if (res.status !== 200) {
                isPass = true;
            }
        }

        const passFailText = isPass ? "✅ PASS" : "❌ FAIL (BUG)";
        mdOutput += `| ${tc.id} | ${tc.desc} | \`${JSON.stringify(tc.payload)}\` | ${res.status} | \`${responseText}\` | **${passFailText}** |\n`;
        
        console.log(`-> Status: ${res.status} | Data: ${responseText} -> ${passFailText}\n`);
    }

    // Đặc biệt kiểm tra TC_FR09_D8 (Đã dùng hết lượt)
    console.log("Đang chạy: TC_FR09_D8 - Thử áp dụng mã VIP100 liên tục 3 lần (limit là 2).");
    for (let i = 1; i <= 3; i++) {
        const res = await request('POST', '/api/apply-coupon', { code: "VIP100", total_amount: 500000, user_id: userId }, token);
        let isPass = (i <= 2) ? (res.status === 200) : (res.status !== 200); // Lần 3 mong đợi lỗi
        const passFailText = isPass ? "✅ PASS" : "❌ FAIL (BUG)";
        const responseText = typeof res.body === 'object' ? JSON.stringify(res.body) : res.body;
        
        mdOutput += `| TC_FR09_D8.${i} | Thử apply lần ${i} (Limit 2) | \`{"code":"VIP100"}\` | ${res.status} | \`${responseText}\` | **${passFailText}** |\n`;
        console.log(`-> Lần ${i}: Status: ${res.status} | Data: ${responseText} -> ${passFailText}`);
    }

    const fs = require('fs');
    fs.writeFileSync('docs/test-results/FR09_TestResults.md', mdOutput);
    console.log("\nĐã xuất kết quả ra file docs/test-results/FR09_TestResults.md");
}

runTests();
