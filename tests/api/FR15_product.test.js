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
    console.log("--- Bắt đầu kiểm thử FR-15 (Quản lý Sản phẩm) qua API ---");
    
    // 1. Lấy token Admin
    const adminRes = await request('POST', '/api/login', { email: 'admin@eshop.com', password: 'Admin123!' });
    const adminToken = adminRes.body?.token;
    
    // 2. Lấy token User thường
    const userRes = await request('POST', '/api/login', { email: 'test@eshop.com', password: 'Test1234!' });
    const userToken = userRes.body?.token;

    if (!adminToken || !userToken) {
        console.error("Lỗi đăng nhập! Không thể lấy token.", adminRes, userRes);
        return;
    }
    
    console.log(`Đăng nhập thành công, đã lấy token Admin & User.`);
    console.log("---------------------------------------");

    const longName255 = "A".repeat(255);
    const longName256 = "X".repeat(256);

    const testCases = [
        { id: "TC_FR15_D1", desc: "Domain - Valid All", tokenType: 'admin', payload: { name: "Sản phẩm A", price: 100000, category_id: 1 }, expectedStatus: [200, 201] },
        { id: "TC_FR15_D2", desc: "Domain - Tên rỗng", tokenType: 'admin', payload: { name: "", price: 100000, category_id: 1 }, expectedStatus: [400] },
        { id: "TC_FR15_D3", desc: "Domain - Tên quá dài (256)", tokenType: 'admin', payload: { name: longName256, price: 100000, category_id: 1 }, expectedStatus: [400] },
        { id: "TC_FR15_D4", desc: "Domain - Giá = 0", tokenType: 'admin', payload: { name: "Sản phẩm A", price: 0, category_id: 1 }, expectedStatus: [400] },
        { id: "TC_FR15_D5", desc: "Domain - Giá âm", tokenType: 'admin', payload: { name: "Sản phẩm A", price: -50000, category_id: 1 }, expectedStatus: [400] },
        { id: "TC_FR15_D6", desc: "Domain - Category Fake", tokenType: 'admin', payload: { name: "Sản phẩm A", price: 100000, category_id: 9999 }, expectedStatus: [400] },
        { id: "TC_FR15_D7", desc: "Domain - User token (403)", tokenType: 'user', payload: { name: "Sản phẩm A", price: 100000, category_id: 1 }, expectedStatus: [403] },
        { id: "TC_FR15_D8", desc: "Domain - No token (401)", tokenType: 'none', payload: { name: "Sản phẩm A", price: 100000, category_id: 1 }, expectedStatus: [401] },
        
        { id: "TC_FR15_B1", desc: "BVA - Tên rỗng (0)", tokenType: 'admin', payload: { name: "", price: 100000, category_id: 1 }, expectedStatus: [400] },
        { id: "TC_FR15_B2", desc: "BVA - Tên ngắn nhất (1)", tokenType: 'admin', payload: { name: "A", price: 100000, category_id: 1 }, expectedStatus: [200, 201] },
        { id: "TC_FR15_B3", desc: "BVA - Tên dài nhất (255)", tokenType: 'admin', payload: { name: longName255, price: 100000, category_id: 1 }, expectedStatus: [200, 201] },
        { id: "TC_FR15_B4", desc: "BVA - Vượt giới hạn (256)", tokenType: 'admin', payload: { name: longName256, price: 100000, category_id: 1 }, expectedStatus: [400] },
        
        { id: "TC_FR15_B5", desc: "BVA - Giá âm (-1)", tokenType: 'admin', payload: { name: "SP BVA", price: -1, category_id: 1 }, expectedStatus: [400] },
        { id: "TC_FR15_B6", desc: "BVA - Giá tại điểm OFF (0)", tokenType: 'admin', payload: { name: "SP BVA", price: 0, category_id: 1 }, expectedStatus: [400] },
        { id: "TC_FR15_B7", desc: "BVA - Giá dương nhỏ nhất (1)", tokenType: 'admin', payload: { name: "SP BVA", price: 1, category_id: 1 }, expectedStatus: [200, 201] },
    ];

    let mdOutput = "# Kết quả kiểm thử FR-15 (Quản lý Sản phẩm) qua API\n\n";
    mdOutput += "| TC_ID | Loại Test | Payload test | HTTP Status | Response Message | Pass/Fail |\n";
    mdOutput += "|---|---|---|---|---|---|\n";

    for (const tc of testCases) {
        console.log(`Đang chạy: ${tc.id} - ${tc.desc}`);
        let currentToken = null;
        if (tc.tokenType === 'admin') currentToken = adminToken;
        else if (tc.tokenType === 'user') currentToken = userToken;
        
        const payloadText = JSON.stringify(tc.payload).substring(0, 100) + (tc.payload.name.length > 50 ? '...' : '');

        const res = await request('POST', '/api/products', tc.payload, currentToken);
        const status = res.status;
        
        const isPass = tc.expectedStatus.includes(status);
        const passFailText = isPass ? "✅ PASS" : "❌ FAIL (BUG)";
        
        let responseText = typeof res.body === 'object' ? JSON.stringify(res.body) : res.body;
        if (responseText && responseText.length > 100) {
            responseText = responseText.substring(0, 100) + "...";
        }

        mdOutput += `| ${tc.id} | ${tc.desc} | \`${payloadText}\` | ${status} | \`${responseText}\` | **${passFailText}** |\n`;
        console.log(`-> Status: ${status} | Data: ${responseText} -> ${passFailText}\n`);
    }

    const fs = require('fs');
    fs.writeFileSync('docs/test-results/FR15_TestResults.md', mdOutput);
    console.log("\nĐã xuất kết quả ra file docs/test-results/FR15_TestResults.md");
}

runTests();
