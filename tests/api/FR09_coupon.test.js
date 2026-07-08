const http = require('http');
const fs = require('fs');
const path = require('path');
const { reseed } = require("../helpers/reseed");
const sqlite3 = require(path.resolve(__dirname, "../../backend/node_modules/sqlite3")).verbose();

const DB_PATH = path.resolve(__dirname, "../../backend/database.sqlite");

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

function addCouponUsage(couponId, userId) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) return reject(err);
        });
        db.run(
            "INSERT INTO coupon_usage (coupon_id, user_id) VALUES (?, ?)",
            [couponId, userId],
            function (err) {
                db.close();
                if (err) return reject(err);
                resolve();
            }
        );
    });
}

function updateCouponExpiry(couponCode, expiredAtIso) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) return reject(err);
        });
        db.run(
            "UPDATE coupons SET expired_at = ? WHERE code = ?",
            [expiredAtIso, couponCode],
            function (err) {
                db.close();
                if (err) return reject(err);
                resolve();
            }
        );
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

    let mdOutput = "# Kết quả kiểm thử FR-09 (Apply Coupon) qua API\n\n";
    mdOutput += "| TC_ID | Loại Test | Payload / Hành động | HTTP Status | Response Data | Pass/Fail |\n";
    mdOutput += "|---|---|---|---|---|---|\n";

    let pass = 0, fail = 0;
    const addResult = (id, desc, payloadStr, status, resData, isPass) => {
        const passFailText = isPass ? "✅ PASS" : "❌ FAIL (BUG)";
        mdOutput += "| " + [id, desc, payloadStr, status, resData, "**" + passFailText + "**"].join(" | ") + " |\n";
        if (isPass) pass++; else fail++;
        console.log(`-> ${id}: ${passFailText}`);
    };

    // Reseed DB to start clean
    await reseed();

    // D1
    let r = await request('POST', '/api/apply-coupon', { code: "SAVE10", total_amount: 400000, user_id: userId }, token);
    // SAVE10 is 10%, should return 40000 discount. But backend SUT has a bug (BUG-06) that multiplies by total * (1 - discount_value)
    // SUT bug makes it fail.
    let d1Pass = (r.status === 200 && r.body && r.body.discount_amount === 40000);
    let d1Msg = typeof r.body === 'object' ? JSON.stringify(r.body) : r.body;
    if (r.status === 200 && r.body && r.body.discount_amount !== 40000) {
        d1Msg += ` (Sai số tiền. Mong đợi: 40000, Thực tế: ${r.body.discount_amount})`;
    }
    addResult("TC_FR09_D1", "Domain - SAVE10 Hợp lệ (percent)", `SAVE10, total=400k`, r.status, d1Msg, d1Pass);

    // D2
    r = await request('POST', '/api/apply-coupon', { code: "BIGBUY", total_amount: 600000, user_id: userId }, token);
    let d2Pass = (r.status === 200 && r.body && r.body.discount_amount === 50000);
    addResult("TC_FR09_D2", "Domain - BIGBUY Hợp lệ (fixed)", `BIGBUY, total=600k`, r.status, JSON.stringify(r.body), d2Pass);

    // D3
    r = await request('POST', '/api/apply-coupon', { code: "KHONGCO", total_amount: 400000, user_id: userId }, token);
    addResult("TC_FR09_D3", "Domain - Mã không tồn tại", `KHONGCO, total=400k`, r.status, JSON.stringify(r.body), r.status === 404);

    // D4
    r = await request('POST', '/api/apply-coupon', { code: "LOCKEDCODE", total_amount: 400000, user_id: userId }, token);
    addResult("TC_FR09_D4", "Domain - Mã bị khóa (LOCKEDCODE)", `LOCKEDCODE, total=400k`, r.status, JSON.stringify(r.body), r.status === 404);

    // D5
    r = await request('POST', '/api/apply-coupon', { code: "EXPIRED", total_amount: 400000, user_id: userId }, token);
    addResult("TC_FR09_D5", "Domain - Mã hết hạn (EXPIRED)", `EXPIRED, total=400k`, r.status, JSON.stringify(r.body), r.status === 400);

    // D6
    r = await request('POST', '/api/apply-coupon', { code: "SAVE10", total_amount: 200000, user_id: userId }, token);
    addResult("TC_FR09_D6", "Domain - Không đủ tiền", `SAVE10, total=200k`, r.status, JSON.stringify(r.body), r.status === 400);

    // D7
    r = await request('POST', '/api/apply-coupon', { code: "SAVE10", total_amount: 400000, user_id: userId }, null);
    // Expect 401. But backend SUT has a bug (BUG-07) where `/api/apply-coupon` lacks auth middleware.
    addResult("TC_FR09_D7", "Domain - Không có token", `SAVE10, total=400k, Guest`, r.status, JSON.stringify(r.body), r.status === 401);

    // D8 (uses_count >= max)
    // We insert 1 usage row into the DB for SAVE10 (ID=1). Max uses is 1, so applying it should fail.
    await reseed();
    await addCouponUsage(1, userId);
    r = await request('POST', '/api/apply-coupon', { code: "SAVE10", total_amount: 400000, user_id: userId }, token);
    addResult("TC_FR09_D8", "Domain - Đã dùng hết lượt (uses >= max)", `SAVE10, total=400k, seeded usage=1`, r.status, JSON.stringify(r.body), r.status === 400);

    // B1 (BVA total_amount Lower OFF)
    await reseed();
    r = await request('POST', '/api/apply-coupon', { code: "SAVE10", total_amount: 299999, user_id: userId }, token);
    addResult("TC_FR09_B1", "BVA - Thiếu 1 đồng", `SAVE10, total=299999`, r.status, JSON.stringify(r.body), r.status === 400);

    // B2 (BVA total_amount Lower ON)
    r = await request('POST', '/api/apply-coupon', { code: "SAVE10", total_amount: 300000, user_id: userId }, token);
    // SUT has BUG-08: checks total > min instead of total >= min, so it will fail.
    let b2Pass = (r.status === 200 && r.body && r.body.discount_amount === 30000);
    let b2Msg = typeof r.body === 'object' ? JSON.stringify(r.body) : r.body;
    addResult("TC_FR09_B2", "BVA - Vừa đủ tiền (Lower ON)", `SAVE10, total=300000`, r.status, b2Msg, b2Pass);

    // B3 (BVA uses_count Upper ON, uses = 0)
    // Reseed makes usage 0.
    await reseed();
    r = await request('POST', '/api/apply-coupon', { code: "SAVE10", total_amount: 400000, user_id: userId }, token);
    // Expect 200 (if BUG-06 was fixed, but it fails due to BUG-06). So we check status === 200.
    addResult("TC_FR09_B3", "BVA - Số lượt dùng = 0 (Upper ON)", `SAVE10, total=400k, usage=0`, r.status, JSON.stringify(r.body), r.status === 200);

    // B4 (BVA uses_count Upper OFF, uses = 1)
    await addCouponUsage(1, userId);
    r = await request('POST', '/api/apply-coupon', { code: "SAVE10", total_amount: 400000, user_id: userId }, token);
    addResult("TC_FR09_B4", "BVA - Số lượt dùng = 1 (Upper OFF)", `SAVE10, total=400k, usage=1`, r.status, JSON.stringify(r.body), r.status === 400);

    // B5 (BVA date Upper OFF, current_date = expired_at)
    // We update coupon expiry to exactly now
    await reseed();
    const nowIso = new Date().toISOString();
    await updateCouponExpiry("SAVE10", nowIso);
    r = await request('POST', '/api/apply-coupon', { code: "SAVE10", total_amount: 400000, user_id: userId }, token);
    addResult("TC_FR09_B5", "BVA - Ngày hiện tại = Hạn dùng (Upper OFF)", `SAVE10, expired_at=now`, r.status, JSON.stringify(r.body), r.status === 400);

    mdOutput += `\n## Tổng kết\n\n`;
    mdOutput += `| Thiết kế | Thực thi | PASS | FAIL (BUG) |\n|---|---|---|---|\n| 13 | 13 | ${pass} | ${fail} |\n`;

    fs.writeFileSync('docs/test-results/FR09_TestResults.md', mdOutput);
    console.log(`\nFR-09 xong: ${pass} PASS / ${fail} FAIL. Ghi docs/test-results/FR09_TestResults.md`);
}

runTests();
