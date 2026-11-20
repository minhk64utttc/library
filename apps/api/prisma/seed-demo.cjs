// Additive local demonstration data. Never resets an existing dataset or account.
const { PrismaClient } = require('@prisma/client');
const { hash } = require('@node-rs/argon2');
const { createHash, randomBytes } = require('node:crypto');
const { writeFile, mkdir, unlink } = require('node:fs/promises');
const { join, dirname, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { seedDigital } = require('./demo-digital.cjs');
const prisma = new PrismaClient();
const namespace = 'thu-vien-rich-demo-v1';
const id = label => {
  const value = createHash('sha256').update(`${namespace}:${label}`).digest('hex');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-a${value.slice(17, 20)}-${value.slice(20, 32)}`;
};
const day = 86400000;
const now = new Date();
const ago = days => new Date(now.getTime() - days * day);
const future = days => ago(-days);
const markerId = id('complete');
let createdCredentialsFile = null;
let committed = false;
const staffDefinitions = [
  ['admin', 'Quản trị dữ liệu mẫu', ['admin']],
  ['manager', 'Nguyễn Hoài An', ['manager']],
  ['catalog', 'Trần Minh Châu', ['cataloging']],
  ['inventory', 'Phạm Quốc Bảo', ['inventory']],
  ['circulation', 'Lê Ngọc Hà', ['circulation']],
  ['digital', 'Đỗ Thanh Bình', ['digital']],
  ['dual', 'Vũ Khánh Linh', ['cataloging', 'reader']],
  ['staff', 'Hoàng Đức Minh', ['inventory', 'reader']],
  ['multirole', 'Nguyễn Phương Anh', ['manager', 'reader', 'digital']],
];
const families = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Đỗ', 'Bùi', 'Phan'];
const givenNames = ['Minh Anh', 'Quốc Huy', 'Ngọc Linh', 'Thanh Hà', 'Đức Bảo', 'Khánh Chi', 'Tuấn Kiệt', 'Phương Thảo'];
const subjects = ['Công nghệ thông tin', 'Toán học', 'Kinh tế', 'Kỹ thuật xây dựng', 'Giao thông vận tải', 'Ngoại ngữ', 'Văn học', 'Khoa học xã hội'];
const titles = [
  'Lập trình Python căn bản', 'Toán rời rạc', 'Kinh tế vi mô', 'Sức bền vật liệu', 'Quy hoạch giao thông đô thị', 'Tiếng Anh giao tiếp', 'Những câu chuyện tuổi trẻ', 'Kỹ năng nghiên cứu khoa học',
  'Cấu trúc dữ liệu và giải thuật', 'Đại số tuyến tính', 'Quản trị doanh nghiệp', 'Kết cấu bê tông cốt thép', 'Vận tải và logistics', 'Tiếng Anh học thuật', 'Văn học Việt Nam hiện đại', 'Tư duy phản biện',
  'Cơ sở dữ liệu quan hệ', 'Giải tích ứng dụng', 'Nguyên lý kế toán', 'Cơ học kết cấu', 'Kỹ thuật đường bộ', 'Ngữ pháp tiếng Anh', 'Tuyển tập truyện ngắn', 'Xã hội học đại cương',
  'Mạng máy tính', 'Xác suất và thống kê', 'Marketing căn bản', 'Vật liệu xây dựng', 'An toàn giao thông', 'Tiếng Pháp nhập môn', 'Thơ và cuộc sống', 'Tâm lý học ứng dụng',
  'Công nghệ phần mềm', 'Phương pháp tính', 'Tài chính doanh nghiệp', 'Nền và móng công trình', 'Cầu và công trình ngầm', 'Tiếng Trung căn bản', 'Đọc và cảm nhận văn học', 'Lịch sử văn minh thế giới',
  'Trí tuệ nhân tạo', 'Tối ưu hóa', 'Thương mại điện tử', 'Thiết kế kiến trúc', 'Quản lý chuỗi cung ứng', 'Tiếng Nhật sơ cấp', 'Tiểu luận văn hóa đọc', 'Phương pháp học đại học',
  'An toàn thông tin', 'Toán cao cấp', 'Kinh tế quốc tế', 'Dự toán công trình', 'Khai thác vận tải đường sắt', 'Kỹ năng viết tiếng Anh', 'Văn hóa và con người', 'Triết học và đời sống',
  'Thiết kế giao diện người dùng', 'Mô hình toán học', 'Khởi nghiệp đổi mới sáng tạo', 'Quản lý dự án xây dựng', 'Giao thông thông minh', 'Tiếng Anh chuyên ngành', 'Tản văn về thành phố', 'Kỹ năng làm việc nhóm',
];
const publisherNames = ['Giáo dục Việt Nam', 'Đại học Quốc gia Hà Nội', 'Khoa học và Kỹ thuật', 'Giao thông Vận tải', 'Xây dựng', 'Kinh tế Quốc dân', 'Lao động', 'Trẻ', 'Kim Đồng', 'Thông tin và Truyền thông', 'Tổng hợp Thành phố Hồ Chí Minh', 'Văn học'];
function demoIsbn(index, editionNumber) {
  const digits = `978099${String(index).padStart(4, '0')}${String(editionNumber).padStart(2, '0')}`;
  const sum = [...digits].reduce((total, digit, position) => total + Number(digit) * (position % 2 ? 3 : 1), 0);
  return `${digits}${(10 - sum % 10) % 10}`;
}

async function counts() {
  const names = ['account', 'work', 'edition', 'copy', 'location', 'loan', 'reservation', 'fine', 'digitalSubmission', 'incident', 'inventoryRun'];
  return Object.fromEntries(await Promise.all(names.map(async name => [name, await prisma[name].count()])));
}

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1', 'postgres'].includes(target.hostname) || target.pathname !== '/thu_vien') throw new Error('Chỉ dùng bộ mẫu này với PostgreSQL thu_vien ở môi trường local.');
  console.log(JSON.stringify({ database: target.pathname.slice(1), schema: target.searchParams.get('schema') || 'public', before: await counts() }));
  if (!process.argv.includes('--apply')) { console.log('Chế độ xem trước. Thêm --apply để bổ sung bộ mẫu; dữ liệu hiện có được giữ nguyên.'); return; }
  const password = process.env.DEMO_DATA_PASSWORD || `TvDemo-${randomBytes(12).toString('base64url')}!`;
  const passwordHash = await hash(password);
  const loginNames = [...staffDefinitions.map(([key]) => `demo.${key}@thu-vien.local`), ...Array.from({ length: 80 }, (_, index) => `demo.reader${String(index + 1).padStart(3, '0')}@thu-vien.local`)];
  const credentialsFile = process.env.DEMO_CREDENTIALS_FILE || join(tmpdir(), `thu-vien-demo-login-${Date.now()}.txt`);
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(773311)`;
    if (await tx.auditEvent.findUnique({ where: { id: markerId } })) return { skipped: true };
    if (await tx.account.findUnique({ where: { id: id('staff-admin') } })) throw new Error('Bộ mẫu đã tồn tại một phần; dừng để không ghi đè.');
    await mkdir(dirname(credentialsFile), { recursive: true });
    await writeFile(credentialsFile, `TÀI KHOẢN MẪU THƯ VIỆN (CHỈ LOCAL)\nURL: http://localhost:8080\nMật khẩu chung cho các tài khoản MỚI bên dưới: ${password}\n\n${loginNames.join('\n')}\n\nTài khoản reader078–080 bị khóa để thử bộ lọc. Các tài khoản hiện có không bị đổi mật khẩu.\n`, { flag: 'wx', mode: 0o600 });
    createdCredentialsFile = credentialsFile;
    console.log(JSON.stringify({ credentialsPrepared: credentialsFile }));
    const staff = {};
    const readers = [];
    for (const [key, fullName, roles] of staffDefinitions) {
      const email = `demo.${key}@thu-vien.local`;
      const row = await tx.account.create({ data: { id: id(`staff-${key}`), email, passwordHash, roles: { create: roles.map(role => ({ role })) }, profile: { create: { fullName, readerGroup: roles.includes('reader') ? 'staff' : 'other', reminderEmailEnabled: false } }, createdAt: ago(365) } });
      staff[key] = { id: row.id, fullName };
    }
    for (let index = 0; index < 80; index++) {
      const number = String(index + 1).padStart(3, '0');
      const fullName = `${families[Math.floor(index / 8)]} ${givenNames[index % 8]}`;
      const email = `demo.reader${number}@thu-vien.local`;
      const disabled = index >= 77;
      const row = await tx.account.create({ data: { id: id(`reader-${number}`), email, passwordHash, status: disabled ? 'disabled' : 'active', roles: { create: { role: 'reader' } }, profile: { create: { fullName, readerGroup: index < 56 ? 'student' : index < 68 ? 'lecturer' : 'other', contactEmail: email, reminderEmailEnabled: false } }, createdAt: ago(200 - index) } });
      readers.push({ id: row.id, fullName });
    }
    for (const [index, reader] of [...readers, staff.dual, staff.staff, staff.multirole].entries()) {
      const card = await tx.libraryCard.create({ data: { id: id(`card-${index}`), accountId: reader.id, cardNumber: `DEMO-THE-${String(index + 1).padStart(4, '0')}`, status: index >= 74 && index < 77 ? 'locked' : 'active', expiresAt: index >= 70 && index < 74 ? ago(10 + index - 70) : future(120 + index), createdAt: ago(110), ...(index >= 74 && index < 77 ? { lockedAt: ago(2), lockReason: 'Dữ liệu mẫu: tạm khóa để thử bộ lọc thẻ.' } : {}) } });
      await tx.libraryCardEvent.create({ data: { id: id(`card-event-${index}`), cardId: card.id, actorId: staff.circulation.id, action: 'issued', reason: 'Cấp thẻ dữ liệu mẫu để kiểm tra giao diện.', newExpiresAt: card.expiresAt, createdAt: ago(110) } });
      if (card.status === 'locked') await tx.libraryCardEvent.create({ data: { id: id(`card-lock-${index}`), cardId: card.id, actorId: staff.circulation.id, action: 'locked', reason: card.lockReason, createdAt: ago(2) } });
    }
    const publishers = [];
    for (const [index, name] of publisherNames.entries()) publishers.push(await tx.publisher.create({ data: { id: id(`publisher-${index}`), code: `DEMO-NXB-${String(index + 1).padStart(2, '0')}`, name: `NXB ${name}`, address: 'Địa chỉ liên hệ minh họa · Việt Nam', createdAt: ago(365) } }));
    const locations = [];
    for (let index = 0; index < 18; index++) locations.push(await tx.location.create({ data: { id: id(`location-${index}`), code: `DEMO-${String.fromCharCode(65 + Math.floor(index / 6))}${index % 6 + 1}`, name: `Tầng ${Math.floor(index / 6) + 1} · Kệ ${String.fromCharCode(65 + Math.floor(index / 6))}${index % 6 + 1} · ${subjects[index % subjects.length]}` } }));
    const works = [];
    const editions = [];
    const copies = [];
    for (let index = 0; index < 120; index++) {
      const status = index < 100 ? 'published' : index < 108 ? 'draft' : index < 114 ? 'pending' : index < 118 ? 'approved' : 'withdrawn';
      const work = await tx.work.create({ data: { id: id(`work-${index}`), title: `${titles[index % titles.length]}${index >= titles.length ? ' – Chuyên đề thực hành' : ''}`, author: `${families[index % 10]} ${givenNames[(index + 3) % 8]}`, subject: subjects[index % 8], classification: ['005', '510', '330', '690', '388', '420', '895', '300'][index % 8], status, ...(index >= 104 && index < 108 ? { rejectReason: 'Bản ghi mẫu cần bổ sung thông tin tác giả và kiểm tra năm xuất bản.' } : {}), ...(status === 'pending' ? { submittedAt: ago(2) } : {}), ...(['approved', 'published'].includes(status) ? { submittedAt: ago(248 - index), decidedAt: ago(247 - index), decidedById: staff.manager.id } : {}), createdAt: ago(250 - index), updatedAt: ago(index % 30) } });
      works.push(work);
      for (let editionNumber = 0; editionNumber < (index % 4 === 0 ? 2 : 1); editionNumber++) {
        const edition = await tx.edition.create({ data: { id: id(`edition-${index}-${editionNumber}`), workId: work.id, publisherId: publishers[index % publishers.length].id, isbn: demoIsbn(index, editionNumber), language: ['vi', 'vi', 'en', 'vi', 'fr', 'vi', 'ja', 'vi'][index % 8], publishYear: 2012 + (index % 15), editionNo: editionNumber + 1, callNumber: `DEMO-${String(index + 1).padStart(3, '0')}-${editionNumber + 1}`, createdAt: new Date(work.createdAt.getTime() + day) } });
        editions.push({ ...edition, index });
        for (let number = 0; number < (status === 'published' ? 6 : 0); number++) {
          let copyStatus = status === 'published' ? 'available' : 'processing';
          if (editionNumber === 0) {
            if (index < 24 && number === 0) copyStatus = 'on_loan';
            if (index >= 24 && index < 36) copyStatus = number === 0 ? 'reserved' : 'on_loan';
            if (index >= 36 && index < 48) copyStatus = 'on_loan';
            if (number === 0 && index >= 70 && index < 78) copyStatus = index < 72 ? 'pending_search' : index < 74 ? 'processing' : index < 76 ? 'damaged' : 'lost';
          } else if (index >= 24 && index < 48) copyStatus = 'processing';
          if (number === 5) copyStatus = 'processing';
          const copy = await tx.copy.create({ data: { id: id(`copy-${index}-${editionNumber}-${number}`), code: `DEMO-S${String(index + 1).padStart(3, '0')}-E${editionNumber + 1}-${String(number + 1).padStart(3, '0')}`, editionId: edition.id, locationId: locations[index % locations.length].id, status: copyStatus, createdAt: ago(140 - index), updatedAt: ago(index >= 74 && index < 78 && editionNumber === 0 && number === 0 ? 2 : 5) } });
          copies.push({ ...copy, index, editionNumber, number });
        }
      }
    }
    const snapshot = { loanDays: 30, renewLimit: 1, renewDays: 7, overdueFinePerDay: 5000 };
    const activeLoans = [];
    for (const copy of copies.filter(row => row.status === 'on_loan')) {
      const number = activeLoans.length;
      const borrower = readers[number % 64];
      const dueAt = number % 3 === 0 ? ago(2 + number % 12) : future(1 + number % 22);
      const renewed = number < 24 && number % 3 === 1;
      const originalDueAt = new Date(dueAt.getTime() - (renewed ? 7 : 0) * day);
      const loan = await tx.loan.create({ data: { id: id(`active-loan-${number}`), copyId: copy.id, borrowerId: borrower.id, ...snapshot, borrowedAt: new Date(originalDueAt.getTime() - 30 * day), dueAt, renewCount: renewed ? 1 : 0, createdAt: new Date(originalDueAt.getTime() - 30 * day) } });
      activeLoans.push(loan);
      if (renewed) await tx.loanRenewal.create({ data: { id: id(`renewal-${number}`), loanId: loan.id, previousDueAt: originalDueAt, dueAt, renewedById: borrower.id, channel: 'reader', createdAt: ago(6) } });
    }
    const historyLoans = [];
    for (let number = 0; number < 64; number++) {
      const copy = copies.find(row => row.index === 48 + Math.floor(number / 4) && row.editionNumber === 0 && row.number === number % 4);
      const lateDays = number % 2 === 0 ? 2 + number % 8 : 0;
      const returnedAt = ago(5 + number % 40);
      const dueAt = new Date(returnedAt.getTime() - lateDays * day);
      const loan = await tx.loan.create({ data: { id: id(`history-loan-${number}`), copyId: copy.id, borrowerId: readers[(number + 12) % 64].id, status: 'returned', borrowedAt: new Date(dueAt.getTime() - 30 * day), dueAt, returnedAt, ...snapshot, createdAt: new Date(dueAt.getTime() - 30 * day) } });
      historyLoans.push({ loan, copy });
      if (!lateDays) continue;
      const fineNumber = number / 2;
      const scenario = fineNumber % 4;
      const amount = lateDays * snapshot.overdueFinePerDay;
      const fine = await tx.fine.create({ data: { id: id(`fine-${fineNumber}`), loanId: loan.id, amount, status: scenario === 2 ? 'paid' : scenario === 3 ? 'waived' : 'unpaid', createdAt: returnedAt } });
      if ([1, 2].includes(scenario)) {
        const received = scenario === 2 ? amount : amount / 2;
        await tx.finePayment.create({ data: { id: id(`payment-${fineNumber}`), fineId: fine.id, amount: received, remainingAfter: amount - received, idempotencyKey: `${namespace}-payment-${fineNumber}`, receiptNumber: `DEMO-BN-${String(fineNumber + 1).padStart(5, '0')}`, receivedById: staff.circulation.id, receivedAt: new Date(returnedAt.getTime() + day) } });
      }
      if ([0, 3].includes(scenario)) await tx.fineWaiverRequest.create({ data: { id: id(`waiver-${fineNumber}`), fineId: fine.id, requestedById: staff.circulation.id, requestedAmount: amount, reason: 'Đề nghị miễn giảm minh họa để kiểm tra quy trình và giao diện.', status: scenario === 3 ? 'approved' : 'pending', ...(scenario === 3 ? { approvedAmount: amount, decidedById: staff.manager.id, decisionReason: 'Chấp thuận theo tình huống dữ liệu mẫu.', decidedAt: new Date(returnedAt.getTime() + day) } : {}), createdAt: returnedAt } });
    }
    const reservationBorrowers = new Map();
    for (let number = 0; number < 36; number++) {
      const index = number < 12 ? 24 + number : 36 + number % 12;
      const edition = editions.find(row => row.index === index && row.editionNo === 1);
      const borrowers = new Set(activeLoans.filter(loan => copies.find(copy => copy.id === loan.copyId)?.editionId === edition.id).map(loan => loan.borrowerId));
      const used = reservationBorrowers.get(edition.id) || new Set();
      const borrower = Array.from({ length: 64 }, (_, offset) => readers[(number + 45 + offset) % 64]).find(reader => !borrowers.has(reader.id) && !used.has(reader.id));
      if (!borrower) throw new Error('Không chọn được người đặt trước cho bộ mẫu.');
      used.add(borrower.id); reservationBorrowers.set(edition.id, used);
      await tx.reservation.create({ data: { id: id(`reservation-${number}`), editionId: edition.id, borrowerId: borrower.id, status: number < 12 ? 'ready_for_pickup' : 'waiting', ...(number < 12 ? { readyAt: ago(1), expiresAt: future(4) } : {}), createdAt: ago(4 + number % 8) } });
    }
    for (let number = 0; number < 12; number++) {
      const fulfilled = number % 3 === 0;
      const history = historyLoans[number + 1];
      const borrowedAt = history.loan.borrowedAt.getTime();
      await tx.reservation.create({ data: {
        id: id(`reservation-history-${number}`),
        editionId: fulfilled ? history.copy.editionId : editions.find(row => row.index === 50 + number && row.editionNo === 1).id,
        borrowerId: fulfilled ? history.loan.borrowerId : readers[40 + number].id,
        status: ['fulfilled', 'cancelled', 'expired'][number % 3],
        ...(fulfilled ? { readyAt: new Date(borrowedAt - 2 * day), expiresAt: new Date(borrowedAt + 2 * day) } : number % 3 === 2 ? { readyAt: ago(12), expiresAt: ago(8) } : {}),
        createdAt: fulfilled ? new Date(borrowedAt - 5 * day) : ago(16), updatedAt: fulfilled ? history.loan.borrowedAt : ago(8),
      } });
    }
    for (const [number, loan] of activeLoans.slice(0, 32).entries()) await tx.notification.create({ data: { id: id(`notification-${number}`), accountId: loan.borrowerId, loanId: loan.id, dedupeKey: `${namespace}-notice-${number}`, subject: loan.dueAt < now ? 'Nhắc trả tài liệu quá hạn · Mẫu' : 'Sắp đến hạn trả tài liệu · Mẫu', body: 'Đây là thông báo minh họa. Vui lòng xem hạn trả trong Khoản mượn của tôi; dữ liệu này được tạo để thử giao diện.', status: 'skipped', ...(number % 3 === 0 ? { readAt: ago(1) } : {}), createdAt: ago(2 + number % 5) } });
    for (let number = 0; number < 8; number++) {
      const copy = copies.find(row => row.index === 70 + number && row.editionNumber === 0 && row.number === 0);
      const resolved = number >= 4;
      const incident = await tx.incident.create({ data: { id: id(`incident-${number}`), copyId: copy.id, reportedById: staff.inventory.id, kind: number < 2 || number >= 6 ? 'reported_lost' : 'damaged', copyStatusAtReport: 'available', status: resolved ? 'resolved' : number < 2 ? 'new' : 'under_review', description: `Hồ sơ mẫu ${number + 1}: ${number < 2 || number >= 6 ? 'chưa tìm thấy tài liệu tại kệ, cần tra soát' : 'bìa hoặc trang sách có dấu hiệu hư hỏng'}.`, ...(resolved ? { decidedById: staff.manager.id, decision: number >= 6 ? 'confirmed_lost' : 'confirmed_damaged', decisionReason: 'Đã kiểm tra và xác nhận theo tình huống minh họa.', decidedAt: ago(2) } : {}), createdAt: ago(8) } });
      await tx.incidentEvent.create({ data: { id: id(`incident-event-${number}`), incidentId: incident.id, actorId: staff.inventory.id, action: 'reported', note: 'Ghi nhận sự cố trong bộ dữ liệu mẫu.', createdAt: ago(8) } });
      if (number >= 2) await tx.incidentEvent.create({ data: { id: id(`incident-submit-${number}`), incidentId: incident.id, actorId: staff.inventory.id, action: 'submitted', note: 'Đã tra soát, chuyển quản lý xét duyệt.', createdAt: ago(6) } });
      if (resolved) await tx.incidentEvent.create({ data: { id: id(`incident-decide-${number}`), incidentId: incident.id, actorId: staff.manager.id, action: 'decided', note: incident.decisionReason, createdAt: ago(2) } });
    }
    for (let number = 0; number < 3; number++) {
      const closed = number > 0;
      const location = locations[15 + number];
      const run = await tx.inventoryRun.create({ data: { id: id(`inventory-${number}`), name: `${closed ? 'Đợt kiểm kê đã hoàn tất' : 'Đợt kiểm kê đang thực hiện'} · Kệ ${location.code} · Mẫu`, locationId: location.id, createdById: staff.inventory.id, createdAt: ago(closed ? 1.5 : 1), ...(closed ? { closedAt: ago(0.25) } : {}) } });
      for (const copy of copies.filter(row => row.locationId === location.id)) {
        const hasOpenIncident = copy.index >= 70 && copy.index < 74 && copy.editionNumber === 0 && copy.number === 0;
        const eligible = ['available', 'processing', 'damaged'].includes(copy.status) && !hasOpenIncident;
        const result = !closed ? 'unchecked' : copy.status === 'on_loan' ? 'on_loan' : eligible ? 'matched' : 'excluded';
        await tx.inventoryItem.create({ data: { id: id(`inventory-item-${number}-${copy.id}`), runId: run.id, copyId: copy.id, expectedLocationId: location.id, snapshotStatus: copy.status, snapshotUpdatedAt: copy.updatedAt, result, ...(result === 'matched' ? { scannedLocationId: location.id, scannedAt: ago(1) } : {}) } });
      }
      await tx.inventoryEvent.create({ data: { id: id(`inventory-event-${number}`), runId: run.id, actorId: staff.inventory.id, action: closed ? 'closed' : 'created', note: 'Đợt kiểm kê minh họa phục vụ kiểm tra giao diện.', createdAt: closed ? ago(0.25) : run.createdAt } });
    }
    const digitalCount = await seedDigital(tx, { id, now, day, readers, staff, storageRoot: resolve(process.env.DOCUMENT_STORAGE_PATH || join(process.cwd(), '.private', 'digital')) });
    for (let number = 0; number < 80; number++) await tx.auditEvent.create({ data: { id: id(`audit-${number}`), actorId: number % 2 ? staff.catalog.id : staff.circulation.id, action: number % 2 ? 'catalog.record.published' : 'circulation.loan.borrowed', targetType: number % 2 ? 'Work' : 'Loan', targetId: number % 2 ? works[number].id : activeLoans[number].id, outcome: 'success', createdAt: ago(number % 30) } });
    await tx.auditEvent.create({ data: { id: markerId, actorId: staff.admin.id, action: 'demo.dataset.created', targetType: 'DemoDataset', targetId: namespace, outcome: 'success' } });
    return { skipped: false, accounts: 89, works: works.length, editions: editions.length, copies: copies.length, activeLoans: activeLoans.length, historyLoans: 64, reservations: 48, fines: 32, digitalSubmissions: digitalCount };
  }, { timeout: 120000, maxWait: 10000 });
  committed = true;
  if (!result.skipped) {
    console.log(JSON.stringify({ created: result, credentialsFile, after: await counts() }));
  } else console.log('Bộ mẫu v1 đã được tạo. Không thêm trùng và không thay đổi dữ liệu bạn đã thao tác.');
}
main().catch(async error => { if (createdCredentialsFile && !committed) await unlink(createdCredentialsFile).catch(() => undefined); console.error(error instanceof Error ? error.message : 'Không tạo được dữ liệu mẫu.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
