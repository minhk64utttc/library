# Quy tắc nghiệp vụ — bản dự thảo cần chốt với thư viện

## Các nguyên tắc đã thống nhất trong thiết kế
- Tác phẩm → ấn bản → bản sao. Ngôn ngữ, năm, lần xuất bản, ISBN và nhà xuất bản thuộc ấn bản; mã cuốn thuộc bản sao.
- Nhà xuất bản có mã, tên, địa chỉ liên hệ. Không bắt buộc ISBN cho mọi tài liệu.
- Mượn/trả gắn với bản sao; đặt trước theo ấn bản, chỉ gán bản sao khi phân bổ giữ sách.
- Chỉ bản ghi đã công bố xuất hiện trên tra cứu công khai; học liệu số kiểm tra quyền bản ghi/toàn văn/tải riêng.
- Tiếp nhận công trình không đồng nghĩa công bố toàn văn.
- Báo mất không tự đóng giao dịch hoặc chuyển LOST; cần tra soát và người có quyền xác nhận.
- Quá hạn là thuộc tính của khoản mượn, không phải trạng thái bản sao.
- ManagerLib thiết lập chính sách và lịch phục vụ; Admin quản lý tài khoản/quyền.
- Phiếu mượn cần giữ chính sách áp dụng. Nếu mỗi cuốn có chính sách khác nhau, lưu liên kết/snapshot ở chi tiết mượn.

## Giá trị prototype — KHÔNG coi là quy chế đã phê duyệt
| Tham số | Dữ liệu minh họa | Cần xác nhận |
|---|---|---|
| Số cuốn tối đa | 5 | Theo nhóm bạn đọc, loại tài liệu |
| Hạn mượn | 30 ngày | Cách tính ngày và loại tài liệu |
| Gia hạn | 1 lần, thêm 7 ngày | Quá hạn, phạt tồn, hàng chờ có chặn không |
| Phạt quá hạn | 5.000 VND/ngày | Mức trần, miễn ngày nghỉ, thời điểm phát sinh |
| Giữ sách chờ nhận | Prototype từng có 2 và 5 ngày | Chọn chính sách chính thức, mốc bắt đầu |
| Ngày đóng cửa | Chủ nhật trong bản mẫu | Ngày lễ, nghỉ đột xuất, từng cơ sở |

## Quyết định còn mở
- Nguồn tài khoản: local hay SSO trường; cách đồng bộ người dùng/thẻ và quy trình ảnh thẻ.
- Đến hạn theo ngày hay giờ; cuối ngày tại Việt Nam; cách dời hạn nếu ngày nghỉ.
- Có đặt trước khi vẫn còn bản sẵn sàng không; FIFO, ưu tiên, hủy và hết hạn giữ.
- Phân quyền phê duyệt, tự duyệt, miễn giảm, mức bồi thường; xử lý tiền đã thu khi điều chỉnh.
- Luồng đề xuất bổ sung → duyệt → mua/tặng → nhận lô → biên mục → bản sao sẵn sàng.
- Vai trò không thay thế một UC: UC mô tả mục tiêu có kết quả cho tác nhân, không tách từng trường nhập thành UC.

Khi chưa chốt: triển khai phần độc lập, ghi giả định cạnh chức năng; không âm thầm biến số mẫu thành quy định thật.
