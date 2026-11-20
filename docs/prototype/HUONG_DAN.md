# Bản mẫu giao diện thư viện — đầy đủ các khu vực

Mở `index.html` bằng trình duyệt. Giữ `full.js` cùng thư mục. Có 7 vai trò mẫu: bạn đọc, mượn trả, biên mục, kho, học liệu số, ManagerLib, Admin. Nút đổi vai trò ở thanh trên cho phép thử các góc nhìn. Không nhập thông tin đăng nhập thật.

## Các màn hình

- Chung: đăng nhập (kèm thử lỗi/khóa), trang chủ, tra cứu, chi tiết tài liệu, đọc tài liệu, thông báo.
- Bạn đọc: mượn và đặt trước, khoản phạt, yêu cầu, nộp công trình, hồ sơ đã nộp, hồ sơ và thẻ.
- Cán bộ: công việc hôm nay, quầy mượn trả, bạn đọc và thẻ, khoản mượn/hàng chờ, danh mục, biên tập bản ghi, hỗ trợ biên mục, bản sao/vị trí, kiểm kê, sự cố/đề xuất, khoản phạt/thu tiền, tiếp nhận công trình, tài nguyên số.
- ManagerLib: phê duyệt, công bố bản ghi, báo cáo, chính sách, nhật ký.
- Admin: tài khoản/vai trò, nhật ký. Lịch và thiết lập phục vụ thuộc ManagerLib.

Form ngắn mở trong hộp thoại. Form biên mục và nộp công trình có trang riêng. Một mẫu màn hình được dùng lại theo vai trò; không tính tab/hộp thoại là trang độc lập.

## Luồng nên thử

1. Biên mục → tạo bản ghi → gửi duyệt → đổi sang ManagerLib → phê duyệt → công bố bản ghi → tra cứu.
2. Bạn đọc → đặt trước sách hết bản → xem mượn/đặt trước → hủy yêu cầu.
3. Mượn trả → quét AI-001 → xác nhận cho mượn → tab nhận trả → quét AI-001 → xác nhận → bạn đọc xem lịch sử.
4. Bạn đọc → nộp công trình → gửi hồ sơ → học liệu số tiếp nhận → tài nguyên số bổ sung giấy phép → đề xuất công bố → ManagerLib quyết định.
5. Bạn đọc đề nghị miễn giảm → ManagerLib xét số tiền → cán bộ mượn trả ghi nhận phần thực thu còn lại.
6. Kho → tạo đợt kiểm kê → quét AI-001-001 → lập hồ sơ tra soát. Bản đang mượn được ghi vắng mặt hợp lệ.
7. Admin → tạo tài khoản mẫu, cấp vai trò, khóa/mở khóa → kiểm tra nhật ký. Việc này không tạo tài khoản thật.

## Giới hạn cần hiểu

Đây là prototype frontend, chưa phải phần mềm vận hành. Dữ liệu giả được giữ trong bộ nhớ và đặt lại khi tải lại trang. Quyền menu được mô phỏng phía client, không phải cơ chế bảo mật. Chưa có backend, SSO, email, thanh toán hoặc AI thật.

Quầy mượn trả có ba bạn đọc mẫu để tra cứu và chọn. Danh sách bản sao chi tiết và bộ đếm khả dụng mô phỏng chưa có đầy đủ ràng buộc giao dịch như hệ thống thật. Cấu hình/chính sách được lưu để thử giao diện, chưa áp dụng qua một bộ máy quy tắc thống nhất. Tệp nộp chỉ giữ tên/tham chiếu trong phiên; không được tải lên máy chủ. Hỗ trợ AI tạo kết quả cố định và có ghi nhãn rõ. Nội dung đọc/tải là văn bản minh họa.

Kiểm tra đã thực hiện: cú pháp JS, render chuỗi HTML của các vai trò/menu, cú pháp handler, luồng gửi/duyệt bản ghi, phân luồng quyền, mượn/trả, tiếp nhận công trình và đề nghị miễn giảm qua môi trường DOM giả lập. Chưa xác nhận bố cục bằng trình duyệt tự động vì công cụ chặn giao thức file://.

`prototype-v1.html` là bản cũ được giữ để đối chiếu. Các file `index.html`, `full.js` và `refinements.js` là phiên bản hiện tại.

## Cập nhật theo phản hồi giao diện

- Quầy mượn trả tìm tên/mã/email và chọn một trong ba bạn đọc mẫu. Giao dịch gắn với mã cuốn cụ thể.
- Chi tiết sách nhóm theo tác phẩm, chọn ấn bản và xem vị trí từng bản sao. Có đặt trước khi không còn bản sẵn sàng và đề xuất cùng chủ đề.
- Tra cứu có lọc chủ đề, tác giả, khoảng năm, loại và khả dụng. Danh sách nội bộ có bộ lọc theo ngữ cảnh.
- Nhãn dán sách có xem trước và giải thích; chưa có mã vạch quét được. Rút khỏi cho mượn không xóa lịch sử.
- Báo cáo dùng khối trạng thái và bảng chi tiết, đối soát công nợ, giao dịch theo bạn đọc. ManagerLib có trang theo dõi xử lý và chi tiết hồ sơ trước quyết định.
- Bản sao và khả dụng trong các luồng quầy mượn trả đã được nối chung. Bản đang mượn AI-008-001 minh họa khoản mượn ngoài ba bạn đọc được cung cấp, nên tổng số bản đang mượn có thể khác tổng khoản mượn trong phạm vi mẫu.
- Báo cáo hiện là ảnh chụp dữ liệu của phiên, chưa có thống kê lịch sử theo khoảng ngày.

Giữ cả index.html, full.js và refinements.js trong cùng thư mục.

## Quyền thiết lập và bộ lọc

- ManagerLib quản lý điểm phục vụ, email liên hệ, số ngày giữ sách chờ nhận và ngày đóng cửa. Admin không được mở hoặc lưu trang này.
- Bộ lọc lấy lựa chọn từ đúng cột dữ liệu của bảng và so khớp chính xác. Tìm kiếm bỏ qua cột nút thao tác. Có số dòng kết quả và nút xóa bộ lọc.
- Thiết lập vẫn chỉ lưu trong phiên mẫu, chưa tự tính lại hạn nhận hoặc lịch giao dịch.

Biên mục: mở Danh mục nhà xuất bản để thêm mã tự sinh, tên và địa chỉ liên hệ. Trong Tạo/Sửa bản ghi, chọn nhà xuất bản và nhập nơi xuất bản, ngôn ngữ, lần xuất bản. Thông tin được lưu cùng bản ghi và hiển thị ở chi tiết sách. Dữ liệu vẫn chỉ tồn tại trong phiên mẫu.

## Sửa ưu tiên: dữ liệu, đăng nhập và quá hạn

- Trang đọc và tiêu đề/ghi chú hộp thoại escape dữ liệu văn bản.
- Đăng nhập bằng email mẫu hiển thị ở màn đăng nhập, mật khẩu ban đầu `Demo@12345`. Mật khẩu là dữ liệu thử, lưu trong bộ nhớ; không dùng tài khoản/mật khẩu thật. Quên mật khẩu chỉ mô phỏng yêu cầu, không gửi email.
- Tài khoản Admin tạo mới phải đổi mật khẩu lần đầu trước khi mở nghiệp vụ. Có mục Đổi mật khẩu cho các vai trò. Đây chưa phải cơ chế xác thực an toàn phía máy chủ.
- Cán bộ mượn trả có mục Sách quá hạn. Ngày tính theo Asia/Bangkok (UTC+7); ngày đến hạn chưa tính quá hạn. Bạn đọc có nhãn số ngày quá hạn. Nhắc hạn tạo thông báo mẫu, chặn lặp cùng khoản mượn trong ngày; không tự tính phạt.
- Đã bỏ khối khởi tạo biên mục bị lặp trong hàm hoàn tất mượn trả để tránh nhân đôi menu và ghi đè chức năng sau giao dịch. Chưa hoàn tất tái cấu trúc ba lớp mã thành một bộ mã duy nhất.
- Chưa bổ sung chuỗi mua/tiếp nhận tài liệu, phân trang/sắp xếp và lưu bộ lọc, tùy chọn kênh thông báo, menu di động thu gọn hoặc đợt rà soát khả năng truy cập/độ tương phản.
- Kiểm thử `check-priority.cjs`: escape trang đọc/hộp thoại, ranh giới ngày quá hạn, đăng nhập sai/đúng, bắt buộc đổi mật khẩu, nhắc hạn không lặp, trả sách khỏi danh sách quá hạn và giao dịch mượn/trả không khởi tạo lại menu. Kiểm tra trên DOM giả lập; chưa có kiểm tra trực quan bằng trình duyệt.

Hồ sơ & thẻ: gom ảnh thẻ, cập nhật email liên hệ/số điện thoại và đổi mật khẩu. Cán bộ có mục Hồ sơ cá nhân tương ứng; bỏ menu Đổi mật khẩu riêng. Tên và email đăng nhập, mã thẻ/hiệu lực thẻ chỉ xem. Ảnh JPG/PNG/WebP tối đa 2 MB, kiểm tra giải mã ảnh trước khi hiển thị, chỉ giữ trong phiên. Bước đổi mật khẩu bắt buộc lần đầu vẫn là màn riêng. Đã kiểm tra logic hồ sơ, phân biệt email liên hệ và email đăng nhập, giới hạn định dạng/dung lượng; chưa kiểm tra trực quan trình duyệt.
