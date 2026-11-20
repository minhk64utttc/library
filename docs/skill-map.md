# Áp dụng skills theo nhiệm vụ

Phân biệt bốn thành phần:

| Thành phần | Vai trò | Nơi khai báo |
|---|---|---|
| Rule (`AGENTS.md`, `CLAUDE.md`) | Quy định chung: stack, nghiệp vụ, bảo mật, cách kiểm thử | `AGENTS.md` (Command Code đọc file này) |
| Skill | Quy trình thực hiện một loại việc | skill trong môi trường |
| Agent chuyên trách | Nhận một nhiệm vụ có phạm vi, đầu vào và kết quả bàn giao rõ | `.commandcode/agents/*.md` |
| CI/test | Kiểm tra tự động; không thay bằng lời nhận xét của agent | `.github/workflows/ci.yml` |

Agent chuyên trách hiện có: `implementer` (triển khai shared → API → web), `domain-reviewer` (quy chế, quyền, mượn/trả, đặt trước, phạt), `code-reviewer` (validation, truy cập trái phép, transaction, XSS, phiên). Luồng review nằm ở mục "Quy trình code review" trong `AGENTS.md`.

Rule là ràng buộc dự án; skill là quy trình hỗ trợ một công việc. Viết tên skill ở đây không tự cài hoặc tự kích hoạt nó.

| Skill có trong môi trường hiện tại | Dùng khi | Không dùng để |
|---|---|---|
| create-rule | Tạo/sửa bộ luật và phạm vi file | Tự quyết định quy chế thư viện |
| frontend-design | Thiết kế lại layout, component, mobile và trạng thái UI Vue | Áp đặt React/Next hoặc tự đổi stack |
| find-skills | Tìm skill còn thiếu cho Vue/Nest/Prisma/kiểm thử | Tự cài gói chỉ vì nhiều lượt tải |
| skill-creator | Đóng gói quy trình review nghiệp vụ thư viện lặp lại | Thay rule bằng một skill quá lớn |
| computer-use:computer-use | Kiểm tra UI tương tác khi công cụ cho phép | Vượt hạn chế công cụ hoặc coi DOM giả là kiểm thử trình duyệt |
| documents:documents | Tạo/chỉnh thuyết minh DOCX | Sửa code ứng dụng |
| pdf:pdf | Xuất/kiểm tra tài liệu PDF | Render ứng dụng production |
| presentations:Presentations | Slide bảo vệ đồ án | Phát triển API |

Không có skill chuyên Vue/NestJS/Prisma được liệt kê trong phiên này. Có thể làm theo tài liệu chính thức trước; nếu bổ sung, cần đọc SKILL.md, kiểm tra repo nguồn, độ phù hợp phiên bản, phụ thuộc/quyền và hoạt động của script trước khi cài. Chưa cài thêm skill ngoài.
Không chọn React/Next best-practices cho dự án Vue chỉ vì nó đứng đầu bảng skills.sh.
Không dùng Sites để thay thế monorepo Vue/Nest khi chưa có yêu cầu đổi nền tảng/hosting.

Gợi ý skill riêng sau này: library-domain-review — kiểm tra quyền, trạng thái mượn/trả, transaction, idempotency và tình huống biên từ quy-tac-nghiep-vu.md; chỉ tạo khi có nhu cầu dùng lại rõ ràng.
