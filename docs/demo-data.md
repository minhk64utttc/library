# Bộ dữ liệu mẫu lớn cho giao diện

Đã bổ sung vào PostgreSQL local của Docker, schema `public`, ngày 20/11/2026. Dữ liệu cũ và mật khẩu tài khoản cũ được giữ nguyên; đã so sánh fingerprint các bản ghi cũ trước/sau khi nạp.

| Loại dữ liệu thêm | Số lượng |
|---|---:|
| Tài khoản (80 bạn đọc, 9 nhân viên/đa vai trò) | 89 |
| Thẻ thư viện, gồm còn hạn/hết hạn/khóa | 83 |
| Tác phẩm (100 công bố, còn lại nháp/chờ duyệt/đã duyệt/thu hồi) | 120 |
| Ấn bản có NXB, ISBN giả lập, năm và ngôn ngữ | 150 |
| Bản sao của tài liệu đã công bố | 750 |
| Nhà xuất bản / vị trí kệ | 12 / 18 |
| Khoản đang mượn / đã trả | 132 / 64 |
| Lịch sử gia hạn | 8 |
| Đặt trước: chờ, chờ nhận, đã nhận, hủy, hết hạn | 48 |
| Phạt: chưa thu, thu một phần, đã thu, đã miễn | 32 |
| Hồ sơ học liệu số có tệp PDF minh họa thật | 24 |
| Hồ sơ sự cố / đợt kiểm kê | 8 / 3 |
| Thông báo minh họa | 32 |
| Nhật ký nghiệp vụ minh họa | 80 |

Đầu sách, tác giả, ISBN, thông tin học thuật và chính sách snapshot của khoản mượn chỉ là giả lập để thử ứng dụng, không phải thư mục xuất bản hoặc quy chế đã duyệt. PDF có đánh dấu DEMO rõ ràng và không chứa nội dung của sách/công trình thật. Không đổi chính sách thư viện hiện có. Các hồ sơ mới tắt email nhắc hạn, thông báo mẫu không gửi email.

## Mở xem

- Tra cứu công khai: `http://localhost:8080/search`.
- Học liệu số: `http://localhost:8080/digital/library`; có 4 tài liệu công khai tải được PDF, 4 tài liệu thành viên và các hồ sơ ở những bước xét duyệt khác.
- Tài khoản: `demo.admin@thu-vien.local`.
- Quầy mượn trả: `demo.circulation@thu-vien.local`.
- Kho: `demo.inventory@thu-vien.local`.
- Biên mục: `demo.catalog@thu-vien.local`.
- Phê duyệt, phạt, báo cáo: `demo.manager@thu-vien.local`.
- Học liệu số nhân viên: `demo.digital@thu-vien.local`.
- Chuyển hai khu vực: `demo.dual@thu-vien.local`, `demo.staff@thu-vien.local`, `demo.multirole@thu-vien.local`.
- Bạn đọc: `demo.reader001@thu-vien.local` đến `demo.reader080@thu-vien.local`. Các tài khoản 078–080 bị khóa để thử bộ lọc. Bạn đọc 001 có nhiều khoản mượn; bạn đọc 013 có lịch sử và khoản phạt.
- Thử quét thẻ `DEMO-THE-0001`; mã cuốn còn sẵn `DEMO-S001-E1-002`. Chỉ gõ rồi Enter là có thể thử tìm, chưa ghi giao dịch nếu chưa xác nhận.

Mật khẩu mới được tạo ngẫu nhiên, chỉ ghi vào file riêng giao cho người dùng; không ghi vào source hoặc log. Thông tin đăng nhập không làm thay đổi `admin@thu-vien.local` hay những tài khoản trước đó.

## Chạy lại an toàn

Script mới là `apps/api/prisma/seed-demo.cjs`, helper tệp số là `demo-digital.cjs`. Dùng môi trường local `thu_vien` và truyền `DATABASE_URL` qua biến môi trường. Chạy không có `--apply` chỉ xem trước. Có thể dùng `npm run prisma:seed:demo --workspace apps/api -- --apply` sau khi cấu hình môi trường.

Script dùng một transaction và advisory lock; marker hoàn thành khiến lần chạy sau không thêm trùng và không đặt lại các dữ liệu đã thử sửa. Không dùng script seed cũ để nạp lại vì script cũ có chức năng đặt lại tài khoản mẫu mặc định. Không xóa marker để ép chạy lại.

Thông tin đăng nhập được ghi thành công vào file riêng trước khi tạo tài khoản. Nếu transaction thất bại, chỉ file credentials vừa được script tạo mới được dọn đi; file đã tồn tại không bị ghi đè. Khi chạy Compose, file nằm tại `data/demo-credentials/login.txt`, PDF ở `data/documents/`, database ở `data/postgres/`; toàn bộ `data/` được loại khỏi Git bằng `.gitignore`.

Kiểm tra đã chạy: schema PostgreSQL riêng, chạy lại không trùng, đối chiếu dữ liệu cũ, điều kiện thẻ/ngày công bố/gia hạn, quan hệ cuốn–khoản mượn–đặt trước, số dư thu/miễn, snapshot kiểm kê và checksum 24 PDF. Script kiểm tra là `apps/api/prisma/check-demo.cjs`.

Sau khi nạp, database local có tổng cộng 95 tài khoản, 121 tác phẩm, 151 ấn bản, 752 bản sao, 199 khoản mượn, 49 đặt trước, 34 khoản phạt, 24 hồ sơ số, 9 sự cố và 6 đợt kiểm kê. Trình duyệt với Docker thật đã kiểm tra 101 kết quả công khai, 12 NXB, 4 học liệu công khai tải PDF được; đăng nhập hai tài khoản demo và tra thẻ/cuốn bằng Enter thành công, không xác nhận giao dịch nghiệp vụ. Script: `apps/web/test/demo-live.browser.cjs`.
