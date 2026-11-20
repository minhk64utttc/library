# Kiểm kê và tra soát (AD07)

Mở mục Kho tài liệu → Kiểm kê. Cán bộ kho tạo đợt theo một vị trí; mỗi vị trí chỉ có một đợt chưa đóng. Danh sách dự kiến giữ trạng thái, vị trí và thời điểm cập nhật của bản sao khi mở đợt.

## Quy trình

1. Quét mã cuốn và chọn vị trí thực tế. Sách thuộc kệ khác vẫn được ghi nhận vào báo cáo. Nếu sai kệ, đưa về đúng kệ rồi quét lại.
2. Đối soát tối đa 100 cuốn chưa quét mỗi lần. Sách đang mượn, đã di chuyển hoặc có biến động sau khi mở đợt được ghi lý do và giữ nguyên trạng thái.
3. Bản sao không thấy và không có giao dịch/hồ sơ khác chuyển sang `pending_search`. Vị trí quét để trống; vị trí dự kiến được giữ lại.
4. Cán bộ kho ghi nhận tìm thấy và vị trí. Quản lý có quyền xác nhận thất lạc với căn cứ xử lý. Các thao tác ghi người thực hiện trong `InventoryEvent`.
5. Đóng đợt khi không còn mục chưa kiểm tra, sai vị trí hoặc chờ tra soát. Yêu cầu đóng lặp không tạo thêm nhật ký.

## Phạm vi hiện tại

Vị trí là danh mục phẳng. Hệ thống chưa có phiếu điều chuyển riêng; thay đổi vị trí sau lúc mở đợt được ghi là biến động. Đợt đang chờ tra soát được giữ mở để xử lý tiếp. Không tự coi sách chưa quét là sách mất.

## Kiểm thử

`apps/api/test/inventory.integration.cjs` chạy trong container API kiểm thử với `DATABASE_URL` trỏ tới schema riêng có tên bắt đầu bằng `inventory_test_`. Script từ chối schema khác, tạo dữ liệu có mã ngẫu nhiên và kiểm tra API qua HTTP, phân quyền, snapshot, quét/đối soát, audit, retry và yêu cầu đồng thời. Không chạy script trên schema ứng dụng.

Docker chạy `prisma migrate deploy` khi khởi động API. Migration `20261028100000_inventory_observations` bổ sung dấu phân biệt snapshot và quan sát phát sinh; không reset database.
