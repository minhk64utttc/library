const { createHash } = require('node:crypto');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { resolve, join } = require('node:path');

// These are original synthetic fixtures, not copies of published coursework.
const TITLES = [
  ['Thiết kế hệ thống quản lý thư viện đại học', 'Công nghệ thông tin'],
  ['Mô phỏng mạng cảm biến theo dõi chất lượng không khí', 'Điện tử viễn thông'],
  ['Khảo sát thói quen đọc sách của sinh viên', 'Khoa học xã hội'],
  ['Ứng dụng đại số tuyến tính trong xử lý ảnh', 'Toán ứng dụng'],
  ['Thiết kế không gian học tập xanh trong thư viện', 'Kiến trúc'],
  ['Phân tích dữ liệu mượn trả phục vụ quản lý kho', 'Khoa học dữ liệu'],
  ['Xây dựng bộ câu hỏi ôn tập cơ sở dữ liệu', 'Công nghệ thông tin'],
  ['Mô hình dự báo nhu cầu sử dụng phòng đọc', 'Toán ứng dụng'],
  ['Bài tập thực hành lập trình hướng đối tượng', 'Công nghệ thông tin'],
  ['Nghiên cứu vật liệu tái chế cho thiết bị học tập', 'Kỹ thuật vật liệu'],
  ['Khảo sát giải pháp tiết kiệm năng lượng tại giảng đường', 'Kỹ thuật điện'],
  ['Phát triển giao diện tra cứu học liệu trên thiết bị di động', 'Công nghệ thông tin'],
  ['Mô phỏng chuyển động của robot vận chuyển sách', 'Cơ khí tự động hóa'],
  ['Hướng dẫn trích dẫn tài liệu cho đồ án sinh viên', 'Thông tin thư viện'],
  ['Xây dựng từ điển thuật ngữ kỹ thuật Việt Anh', 'Ngoại ngữ'],
  ['Đánh giá khả năng tiếp cận của cổng thư viện số', 'Công nghệ thông tin'],
  ['Thiết kế mô hình trạm quan trắc nước sạch', 'Kỹ thuật môi trường'],
  ['Phương pháp tổ chức nhóm học tập hiệu quả', 'Khoa học giáo dục'],
  ['Tổng hợp bài tập xác suất và thống kê ứng dụng', 'Toán ứng dụng'],
  ['Mô phỏng hệ thống đặt chỗ phòng học trực tuyến', 'Công nghệ thông tin'],
  ['Khảo sát văn hóa đọc trong môi trường số', 'Thông tin thư viện'],
  ['Thiết kế học cụ thực hành mạch điện cơ bản', 'Kỹ thuật điện'],
  ['Phân tích trải nghiệm người dùng khi tìm kiếm tài liệu', 'Thông tin thư viện'],
  ['Xây dựng bản mẫu danh mục công trình sinh viên', 'Công nghệ thông tin'],
];

function ascii(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\x20-\x7e]/g, ' ');
}

function pdfString(value) { return ascii(value).replace(/[\\()]/g, '\\$&'); }

function wrap(value, width = 82) {
  const lines = [];
  for (const word of ascii(value).split(/\s+/)) {
    if (!lines.length || lines[lines.length - 1].length + word.length + 1 > width) lines.push(word);
    else lines[lines.length - 1] += ` ${word}`;
  }
  return lines;
}

// A complete one-page PDF with byte-correct xref offsets and a standard Type 1 font.
// Body text is transliterated so the fixture stays dependency-free and portable.
function demoPdf({ title, author, code }) {
  const lines = [
    'DEMO - SYNTHETIC LIBRARY DOCUMENT', '',
    ...wrap(title), '',
    `Author (demo): ${ascii(author)}`, `Submission: ${code}`, '',
    'This PDF is an original software demonstration fixture.',
    'It is not a real thesis, research result, textbook or published work.',
    'All people, study details and examples in this file are fictional.', '',
    'Purpose: demonstrate upload, review, publication and file download.',
    'Example outline:', '1. Define a small learning problem.',
    '2. Describe a proposed approach using synthetic examples.',
    '3. Discuss limitations and possible future improvements.', '',
    'No personal information or third-party copyrighted content is included.',
    'DEMO ONLY - DO NOT CITE AS AN ACADEMIC SOURCE.',
  ];
  const content = `BT\n/F1 12 Tf\n18 TL\n50 790 Td\n${lines.map((line, index) => `${index ? 'T*\n' : ''}(${pdfString(line)}) Tj`).join('\n')}\nET\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}endstream`,
    `<< /Title (${pdfString(`DEMO - ${title}`)}) /Author (${pdfString(`DEMO - ${author}`)}) /Subject (Synthetic demonstration fixture - not academic content) >>`,
  ];
  let document = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(document, 'ascii'));
    document += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const startXref = Buffer.byteLength(document, 'ascii');
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  document += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  return Buffer.from(document, 'ascii');
}

async function writeExclusiveOrVerify(destination, buffer) {
  try { await writeFile(destination, buffer, { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = await readFile(destination);
    if (!existing.equals(buffer)) throw new Error('Demo PDF storage collision: existing file was preserved; seed stopped.');
  }
}

async function seedDigital(tx, { id, now, day, readers, staff, storageRoot }) {
  if (!readers?.length || !staff?.digital?.id || !staff?.manager?.id || !storageRoot || !(now instanceof Date) || !Number.isFinite(now.getTime()) || !(day > 0)) {
    throw new Error('Digital demo seed requires readers, digital/manager accounts, storageRoot and a valid clock.');
  }
  const storageDirectory = resolve(storageRoot);
  const states = ['published', 'published', 'new_submission', 'under_review', 'need_more_info', 'accepted'];
  let created = 0;
  for (let index = 0; index < TITLES.length; index += 1) {
    const label = `digital-${String(index + 1).padStart(2, '0')}`;
    const submissionId = id(`${label}-submission`);
    if (await tx.digitalSubmission.findUnique({ where: { id: submissionId }, select: { id: true } })) continue;
    const storageKey = id(`${label}-storage`);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storageKey)) throw new Error('Demo storage key must be a UUID.');
    const reader = readers[index % readers.length];
    const [title, department] = TITLES[index];
    const state = states[index % states.length];
    const published = state === 'published';
    const accepted = published || state === 'accepted';
    const reviewed = accepted || state === 'under_review' || state === 'need_more_info';
    const submittedAt = new Date(now.getTime() - (36 - index) * day);
    const at = days => new Date(submittedAt.getTime() + days * day);
    const submissionCode = `DEMO-HS-${String(index + 1).padStart(3, '0')}`;
    const accessLevel = published ? index % states.length === 0 ? 'public' : 'members_only' : null;
    const buffer = demoPdf({ title, author: reader.fullName, code: submissionCode });
    await mkdir(storageDirectory, { recursive: true, mode: 0o700 });
    await writeExclusiveOrVerify(join(storageDirectory, storageKey), buffer);
    const events = [
      { suffix: 'created', actorId: reader.id, action: 'created', note: 'DEMO: Tạo hồ sơ học liệu giả lập để trình diễn.', createdAt: submittedAt },
      { suffix: 'uploaded', actorId: reader.id, action: 'file_uploaded', note: 'DEMO: Tải tệp minh họa PDF phiên bản 1; không phải công trình thật.', createdAt: at(0.01) },
    ];
    if (reviewed) events.push({ suffix: 'review', actorId: staff.digital.id, action: 'review_started', note: 'DEMO: Bắt đầu thẩm định hồ sơ minh họa.', createdAt: at(1) });
    if (state === 'need_more_info') events.push({ suffix: 'info', actorId: staff.digital.id, action: 'more_info_requested', note: 'DEMO: Vui lòng bổ sung phần mô tả phương pháp và mục tiêu học tập.', createdAt: at(2) });
    if (accepted) events.push({ suffix: 'accepted', actorId: staff.digital.id, action: 'accepted', note: 'DEMO: Đã tiếp nhận tệp minh họa, chưa phải xác nhận học thuật.', createdAt: at(2) });
    if (published) events.push({ suffix: 'published', actorId: staff.manager.id, action: 'published', accessLevel, note: 'DEMO: Công bố tài liệu giả lập để kiểm tra giao diện và quyền truy cập.', createdAt: at(3) });
    await tx.digitalSubmission.create({ data: {
      id: submissionId, submissionCode, submitterId: reader.id, title: `[DEMO] ${title}`, author: reader.fullName,
      abstract: `Dữ liệu DEMO hoàn toàn giả lập cho chủ đề “${title}”. Hồ sơ và tệp chỉ dùng thử quy trình nộp, thẩm định và công bố học liệu; không chứa kết quả nghiên cứu hoặc nội dung xuất bản thật.`,
      department, publishedYear: now.getUTCFullYear() - index % 3,
      license: 'DEMO: Nội dung giả lập do dự án tạo để thử nghiệm; không dùng làm nguồn học thuật.',
      rightsConfirmed: true, status: state, accessLevel,
      reviewNote: state === 'need_more_info' ? 'DEMO: Cần bổ sung phương pháp và mục tiêu học tập.' : accepted ? 'DEMO: Đã tiếp nhận hồ sơ minh họa.' : null,
      publicationNote: published ? 'DEMO: Tài liệu minh họa, không phải công trình đã xuất bản.' : null,
      submittedAt, createdAt: submittedAt, updatedAt: reviewed ? at(published ? 3 : 2) : at(0.01),
      acceptedAt: accepted ? at(2) : null, publishedAt: published ? at(3) : null,
      files: { create: { id: id(`${label}-file`), uploaderId: reader.id, storageKey, originalName: `${submissionCode}-minh-hoa.pdf`, mimeType: 'application/pdf', sizeBytes: buffer.length, checksumSha256: createHash('sha256').update(buffer).digest('hex'), versionNumber: 1, createdAt: at(0.01) } },
      events: { create: events.map(({ suffix, ...event }) => ({ id: id(`${label}-event-${suffix}`), ...event })) },
    } });
    created += 1;
  }
  return created;
}

module.exports = { seedDigital };
