# Đối chiếu yêu cầu hoàn thiện

Nguồn: `../../CONTEXT_CHO_AGENT_HOAN_THIEN.md`, AD01–AD15 trong `../../So_do_Activity_thu_vien/nguon/`. Trạng thái dưới đây dựa trên đọc code, không thay thế kết quả kiểm thử.

| Yêu cầu | Màn hình / API / model hiện có | Trạng thái và bằng chứng |
|---|---|---|
| P0 tài khoản | `/accounts`, `modules/accounts`, Account/AccountRole/Session | Đã có implementation; cần test xuyên suốt tạo/khóa/reset/thu hồi phiên |
| P0 quyền dữ liệu lưu thông | `fines.controller.ts`, `reservations.controller.ts`, shared `auth/permissions.ts` | Đã tách quyền và kiểm thử HTTP theo vai trò trong `apps/api/test/inventory.integration.cjs` trên schema riêng |
| AD01 biên mục | `/catalog/records`, `/holdings`, Work/Edition/Copy | Có; Work là phạm vi duyệt/công bố. Các Edition phải có trước khi Work được duyệt; `RecordsService.update` không cho sửa Work đã công bố |
| AD02–AD05 lưu thông | `/circulation/*`, `modules/circulation` | Đã thêm thẻ bắt buộc ở mượn/gia hạn/đặt trước và khóa giao dịch gia hạn; còn thiếu nhật ký gia hạn riêng, snapshot chính sách và liên kết bản sao giữ chỗ |
| AD06 sự cố | `/incidents`, Incident/IncidentEvent | Có; phần bồi thường và thông báo chưa hoàn thiện |
| AD07 kiểm kê | `/inventory`, InventoryRun/Item/Event | Có; test `apps/api/test/inventory.integration.cjs`, hướng dẫn `kiem-ke.md` |
| AD08 tài liệu số | Chưa có module tương ứng | Chưa triển khai hồ sơ nộp, lưu tệp và quyền toàn văn |
| AD09 tra cứu, tự đặt trước | `/search`, `/books/:id`, `modules/public`, `/me/reservations` | Đã bổ sung giao diện tra cứu/chi tiết, lọc và phân trang giữ trên URL; đặt trước kiểm tra thẻ, tác phẩm đã công bố, ấn bản hết bản sẵn sàng và trùng yêu cầu trong transaction. Phạm vi công bố hiện là Work. Chưa build/test lượt code giao diện |
| AD10 tự gia hạn | `/me/loans`, `/me/loans/:id/renew`, `ReaderLayout`, `MeModule` | Đã đăng ký `MeModule` vào `AppModule`; thêm lịch sử khoản mượn cá nhân, lọc/phân trang URL và gia hạn có kiểm tra sở hữu, thẻ, quá hạn, hạn mức, hàng chờ; khóa khoản mượn để tuần tự hóa gia hạn. Cần lưu sự kiện gia hạn và kiểm chứng |
| AD11 hồ sơ, ảnh | `/me/profile`, `Profile.contactEmail`, `modules/me`, `ReaderLayout` | Đã bổ sung khu vực bạn đọc và màn hình sửa họ tên, số điện thoại, email liên hệ; email đăng nhập chỉ đọc; thẻ liên kết hiển thị chỉ đọc. Chưa có ảnh thẻ; migration mới và giao diện chưa được kiểm chứng |
| AD12 quản lý thẻ | `/circulation/cards`, `LibraryCard`, `LibraryCardEvent`, quyền `cards:manage` | Đã thêm cấp/gia hạn/khóa/mở khóa có lý do/lịch sử; bắt buộc thẻ đang hiệu lực khi mượn, gia hạn, đặt trước. Ngày hết hạn do cán bộ nhập, tính hết ngày theo UTC+7; cần xác nhận quy chế ngày thẻ và kiểm chứng |
| AD13 nhắc hạn | Mailpit cấu hình | Chưa có notification/outbox/worker chống trùng và retry |
| AD14 thu, miễn giảm | Fine, pay/waive toàn khoản | Cần lần thu, biên nhận, đề nghị/duyệt miễn giảm và số dư; không coi endpoint hiện có là hoàn thiện AD14 |
| AD15 chính sách/lịch | Policy đơn bản, PolicyController | Cần phiên bản, phạm vi áp dụng, lịch phục vụ và snapshot giao dịch |
| Báo cáo / audit toàn hệ thống | Nhật ký riêng incident/inventory | Chưa có API/màn báo cáo và nhật ký tổng hợp |

## Thứ tự triển khai

1. Kiểm tra P0 accounts, quyền và giao dịch cạnh tranh.
2. Thẻ và dữ liệu bạn đọc làm nền kiểm tra điều kiện; tra cứu công khai và cổng bạn đọc (AD09–AD12).
3. Sổ thu/miễn giảm, chính sách có phiên bản, thông báo/outbox (AD13–AD15).
4. Báo cáo, audit và học liệu số AD08.

## Quyết định cần chốt

- Bản ghi hiện lưu trạng thái công bố trên Work. `RecordsService.update` chỉ cho sửa Work ở trạng thái `draft`/`withdrawn`, nên các ấn bản được duyệt cùng Work trước khi công bố. Nếu sau này cho phép thêm ấn bản vào Work đã công bố, cần luồng duyệt ấn bản riêng trước khi mở dữ liệu công khai.
- Tham số 5 cuốn/30 ngày/5.000 VND là dữ liệu mẫu theo `quy-tac-nghiep-vu.md`, chưa phải quy chế trường.
- AD09 đề xuất chỉ đặt trước khi hết bản sẵn sàng. Cần đồng bộ chính sách máy chủ khi triển khai.
- Mức truy cập CAMPUS_ONLY cần nguồn xác minh mạng/SSO được cấu hình trước khi mở toàn văn.

## Kiểm tra thực tế đợt P0

- `docker compose build api web`: đạt.
- `node /app/inventory.integration.cjs` trong container test, schema `inventory_test_permissions_20261028`: đạt. Kiểm tra reader/cataloging/admin bị từ chối đọc phạt và đặt trước toàn thư viện; circulation/manager được đọc; manager không được thu, circulation không được miễn giảm. Đồng thời chạy hồi quy AD07.
- Review độc lập thay đổi quyền: không còn phát hiện cụ thể. Chưa kiểm thử UI phân quyền trực tiếp trong trình duyệt ở đợt này.
