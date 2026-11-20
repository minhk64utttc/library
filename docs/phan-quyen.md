# Ma trận phân quyền — bản dự thảo cần chốt

Vai trò và quyền được khai báo một nguồn tại `packages/shared/src/auth/`. API thực thi quyền trên từng endpoint và tài nguyên; frontend chỉ dùng để hiển thị menu và nút. Menu không phải cơ chế bảo mật.

Vai trò không thay thế một use case: cán bộ gửi bản ghi và người duyệt đều thuộc nghiệp vụ biên mục; không viết lại màn duyệt trong thư mục theo vai trò.

## Vai trò

| Vai trò | Mô tả |
|---|---|
| reader | Bạn đọc: tra cứu, mượn/đặt trước, hồ sơ, nộp công trình |
| circulation | Cán bộ mượn trả: quầy, khoản mượn, hàng chờ, phạt/thu tiền |
| cataloging | Cán bộ biên mục: bản ghi, nhà xuất bản, gửi duyệt |
| inventory | Cán bộ kho: bản sao, vị trí, kiểm kê, sự cố |
| digital | Học liệu số: tiếp nhận hồ sơ, tài nguyên số, quyền truy cập |
| manager | ManagerLib: phê duyệt, công bố, chính sách, báo cáo, nhật ký |
| admin | Quản trị: tài khoản, vai trò, khóa/mở; không mặc nhiên có quyền nghiệp vụ |

## Quyền theo vai trò

Ma trận dưới đây là dự thảo, cần chốt với thư viện trước khi thực thi. Không hardcode quyền ở nhiều lớp.

| Quyền | reader | circulation | cataloging | inventory | digital | manager | admin |
|---|---|---|---|---|---|---|---|
| catalog:read | x | x | x | x | x | x | |
| catalog:write | | | x | | | | |
| catalog:approve | | | | | | x | |
| holdings:manage | | | | x | | | |
| inventory:manage | | | | x | | | |
| circulation:manage | | x | | | | | |
| cards:manage | | x | | | | x | |
| digital:manage | | | | | x | | |
| policies:manage | | | | | | x | |
| reports:read | | x | | | | x | |
| accounts:manage | | | | | | | x |
| audit:read | | | | | | x | x |

## Ghi chú

- Quyền đọc đặt trước toàn thư viện: `reservations:read`, cấp cho circulation và manager.
- Quyền đọc khoản phạt toàn thư viện: `fines:read`, cấp cho circulation và manager.
- Thu tiền: `fines:collect`, cấp cho circulation; quản lý chỉ có quyền này khi đồng thời được gán vai trò circulation.
- Miễn giảm: `fines:waive`, cấp cho manager; quyền `catalog:approve` không còn quyết định quyền miễn giảm.
- Quản lý thẻ bạn đọc: `cards:manage`, cấp cho circulation và manager; Admin chỉ quản trị tài khoản, không tự có quyền sửa trạng thái thẻ.
- Quyền đọc metadata biên mục không cho phép đọc thông tin đặt trước hoặc khoản phạt của bạn đọc. API cá nhân sẽ lấy người sở hữu từ phiên khi triển khai AD09–AD14.

- Một tài khoản có thể có nhiều vai trò nếu quy chế cho phép.
- Quyền phê duyệt, miễn giảm và mức bồi thường nằm trong quy tắc nghiệp vụ cần chốt; xem docs/quy-tac-nghiep-vu.md.
