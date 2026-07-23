const http = require('http');
const fs = require('fs');
const { reseed } = require("../helpers/reseed");

function request(method, path, body = null, token = null) {
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

    // We will run reseed before starting tests to ensure clean state
    await reseed();

    const testCases = [
        { id: "TC_FR15_D1", desc: "Domain - Valid All", tokenType: 'admin', payload: { name: "Sản phẩm A", price: 100000, category_id: 1 }, expectedStatus: [200, 201] },
        { id: "TC_FR15_D2", desc: "Domain - Tên rỗng", tokenType: 'admin', payload: { name: "", price: 100000, category_id: 1 }, expectedStatus: [400] },
        { id: "TC_FR15_D3", desc: "Domain - Tên quá dài (256)", tokenType: 'admin', payload: { name: longName256, price: 100000, category_id: 1 }, expectedStatus: [400] },
        { id: "TC_FR15_D4", desc: "Domain - Giá = 0", tokenType: 'admin', payload: { name: "Sản phẩm A", price: 0, category_id: 1 }, expectedStatus: [400] },
        { id: "TC_FR15_D5", desc: "Domain - Giá âm", tokenType: 'admin', payload: { name: "Sản phẩm A", price: -50000, category_id: 1 }, expectedStatus: [400] },
        { id: "TC_FR15_D6", desc: "Domain - Giá trống", tokenType: 'admin', payload: { name: "Sản phẩm A", price: "", category_id: 1 }, expectedStatus: [400] },
        { id: "TC_FR15_D7", desc: "Domain - Category Fake", tokenType: 'admin', payload: { name: "Sản phẩm A", price: 100000, category_id: 9999 }, expectedStatus: [400] },
        { id: "TC_FR15_D8", desc: "Domain - Category Trống", tokenType: 'admin', payload: { name: "Sản phẩm A", price: 100000, category_id: "" }, expectedStatus: [400] },
        { id: "TC_FR15_D9", desc: "Domain - User token (403)", tokenType: 'user', payload: { name: "Sản phẩm A", price: 100000, category_id: 1 }, expectedStatus: [403] },
        { id: "TC_FR15_D10", desc: "Domain - No token (401)", tokenType: 'none', payload: { name: "Sản phẩm A", price: 100000, category_id: 1 }, expectedStatus: [401] },
        
        { id: "TC_FR15_B1", desc: "BVA - Tên rỗng (0)", tokenType: 'admin', payload: { name: "", price: 100000, category_id: 1 }, expectedStatus: [400] },
        { id: "TC_FR15_B2", desc: "BVA - Tên ngắn nhất (1)", tokenType: 'admin', payload: { name: "A", price: 100000, category_id: 1 }, expectedStatus: [200, 201] },
        { id: "TC_FR15_B3", desc: "BVA - Tên dài nhất (255)", tokenType: 'admin', payload: { name: longName255, price: 100000, category_id: 1 }, expectedStatus: [200, 201] },
        { id: "TC_FR15_B4", desc: "BVA - Vượt giới hạn (256)", tokenType: 'admin', payload: { name: longName256, price: 100000, category_id: 1 }, expectedStatus: [400] },
        
        { id: "TC_FR15_B5", desc: "BVA - Giá âm (-1)", tokenType: 'admin', payload: { name: "SP BVA", price: -1, category_id: 1 }, expectedStatus: [400] },
        { id: "TC_FR15_B6", desc: "BVA - Giá tại điểm OFF (0)", tokenType: 'admin', payload: { name: "SP BVA", price: 0, category_id: 1 }, expectedStatus: [400] },
        { id: "TC_FR15_B7", desc: "BVA - Giá dương nhỏ nhất (1)", tokenType: 'admin', payload: { name: "SP BVA", price: 1, category_id: 1 }, expectedStatus: [200, 201] },
    ];

    let mdOutput = "# Kết quả kiểm thử FR-15 (Quản lý Sản phẩm) qua API\n\n";
    mdOutput += "> Mỗi test case được `reseed()` DB trước khi chạy để cô lập; vì vậy sản phẩm tạo mới ";
    mdOutput += "luôn nhận `id` giống nhau (autoincrement reset sau reseed) — đây là hành vi mong đợi, không phải trùng lặp.\n\n";
    mdOutput += "| TC_ID | Loại Test | Payload / Hành động | HTTP Status | Response Message | Pass/Fail |\n";
    mdOutput += "|---|---|---|---|---|---|\n";

    let pass = 0, fail = 0;
    const addResult = (id, desc, payloadStr, status, respMsg, isPass) => {
        const passFailText = isPass ? "✅ PASS" : "❌ FAIL (BUG)";
        mdOutput += "| " + [id, desc, payloadStr, status, respMsg, "**" + passFailText + "**"].join(" | ") + " |\n";
        if (isPass) pass++; else fail++;
        console.log(`-> ${id}: ${passFailText}`);
    };

    // Run POST test cases
    for (const tc of testCases) {
        let currentToken = null;
        if (tc.tokenType === 'admin') currentToken = adminToken;
        else if (tc.tokenType === 'user') currentToken = userToken;
        
        const payloadText = JSON.stringify(tc.payload).substring(0, 100) + (tc.payload.name.length > 50 ? '...' : '');

        // Reseed for each test case to achieve strict test isolation
        await reseed();

        const res = await request('POST', '/api/products', tc.payload, currentToken);
        const status = res.status;
        
        let isPass = tc.expectedStatus.includes(status);
        
        let responseText = typeof res.body === 'object' ? JSON.stringify(res.body) : res.body;

        // Verify persistence if it was supposed to create a product
        if (isPass && (status === 200 || status === 201)) {
            if (res.body && res.body.id) {
                const getRes = await request('GET', `/api/products/${res.body.id}`);
                if (getRes.status === 200 && getRes.body.name === tc.payload.name) {
                    // Validated persistence
                } else {
                    isPass = false;
                    responseText += " (Lỗi: GET lại không tìm thấy hoặc sai data)";
                }
            } else {
                isPass = false;
                responseText += " (Lỗi: API trả về 200 nhưng không có ID)";
            }
        }

        if (responseText && responseText.length > 100) {
            responseText = responseText.substring(0, 100) + "...";
        }

        addResult(tc.id, tc.desc, `\`${payloadText}\``, status, `\`${responseText}\``, isPass);
    }

    // ---------- Additional PUT & DELETE tests (Update isolation, DELETE no auth) ----------
    
    // TC_FR15_PUT1: Update isolation test ("Sửa 1 sản phẩm, các sản phẩm khác giữ nguyên")
    // We update product ID = 2. Then check that ID 2 changed, but ID 1 remains unchanged.
    await reseed();
    const putPayload = { name: "Samsung S24 Ultra Gold", price: 29000000, description: "Phần cập nhật", imageUrl: "url", category_id: 1 };
    const putRes = await request('PUT', '/api/products/2', putPayload, adminToken);
    
    let putPass = false;
    let putMsg = "";
    if (putRes.status === 200) {
        // Fetch product 2
        const get2 = await request('GET', '/api/products/2');
        // Fetch product 1
        const get1 = await request('GET', '/api/products/1');
        
        if (get2.body.name === "Samsung S24 Ultra Gold" && get1.body.name === "iPhone 15 Pro Max") {
            putPass = true;
            putMsg = "Cập nhật sản phẩm 2 thành công; Sản phẩm 1 giữ nguyên (cô lập tốt)";
        } else {
            putMsg = `Lỗi cô lập! Sản phẩm 2: ${get2.body.name}, Sản phẩm 1: ${get1.body.name}`;
        }
    } else {
        putMsg = `PUT thất bại với status ${putRes.status}`;
    }
    addResult("TC_FR15_PUT1", "Update - Sửa sản phẩm 2 (kiểm tra cô lập)", `PUT /api/products/2`, putRes.status, putMsg, putPass);

    // TC_FR15_DEL1: DELETE without auth (exposes BUG-09: no auth check on delete)
    // SUT will delete and return 200. Test expects 401 or 403, so it should fail (BUG exposed).
    await reseed();
    const del1Res = await request('DELETE', '/api/products/3', null, null); // Guest
    const del1Pass = (del1Res.status === 401 || del1Res.status === 403);
    addResult("TC_FR15_DEL1", "DELETE - Xóa sản phẩm không Token (kiểm tra auth)", `DELETE /api/products/3`, del1Res.status, JSON.stringify(del1Res.body), del1Pass);

    // TC_FR15_DEL2: DELETE with auth
    await reseed();
    const del2Res = await request('DELETE', '/api/products/4', null, adminToken);
    const del2Pass = (del2Res.status === 200);
    addResult("TC_FR15_DEL2", "DELETE - Xóa sản phẩm có Admin Token", `DELETE /api/products/4`, del2Res.status, JSON.stringify(del2Res.body), del2Pass);

    const total = pass + fail;
    mdOutput += `\n## Tổng kết\n\n`;
    mdOutput += `| Thiết kế | Thực thi | PASS | FAIL (BUG) |\n|---|---|---|---|\n| ${total} | ${total} | ${pass} | ${fail} |\n`;

    const fs = require('fs');
    fs.writeFileSync('docs/test-results/FR15_TestResults.md', mdOutput);
    console.log(`\nFR-15 xong: ${pass} PASS / ${fail} FAIL. Ghi docs/test-results/FR15_TestResults.md`);
}

runTests();
