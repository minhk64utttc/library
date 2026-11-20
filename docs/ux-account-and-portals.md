# Tinh gọn tài khoản, điều hướng và bộ lọc

## Khu vực và đường dẫn

| Khu vực | Đường dẫn | Ghi chú |
|---|---|---|
| Nghiệp vụ | `/` | Công việc theo quyền; tài khoản chỉ có vai trò bạn đọc được đưa về `/me/loans` |
| Hồ sơ nhân viên | `/account/profile` | Dùng lại chức năng và dữ liệu hồ sơ, giữ StaffLayout |
| Bảo mật nhân viên | `/account/security` | Dùng lại chức năng đổi mật khẩu trong StaffLayout |
| Thông báo nhân viên | `/account/notifications` | Giữ khung nghiệp vụ khi mở từ chuông |
| Tra cứu và học liệu | `/search`, `/digital/library` | Nhận diện Cổng bạn đọc |
| Tài khoản bạn đọc | `/me/loans`, `/me/reservations`, `/me/fines`, `/me/profile`, `/me/security`, `/me/digital` | Khung bạn đọc, dùng cùng tài khoản và dữ liệu |

Menu tài khoản dùng chung ở ba layout, hiển thị tên, vai trò và email; gom hồ sơ, bảo mật, chuyển khu vực và đăng xuất. Link chuyển sang cổng bạn đọc chỉ hiện với vai trò `reader`; link nghiệp vụ chỉ hiện với tài khoản có vai trò nhân viên. Không đổi vai trò hoặc tạo phiên/tài khoản mới khi chuyển khu vực.

Menu đóng khi bấm ngoài, nhấn Esc, Tab ra ngoài hoặc đổi trang. ArrowDown mở và focus mục đầu; mũi tên lên/xuống, Home/End điều hướng các mục; Esc trả focus về nút mở. Menu và chuông được giới hạn trong màn hình hẹp. “Đi tới…” đổi thành “Tìm nhanh chức năng”; trên điện thoại dùng biểu tượng tìm kiếm có nhãn hỗ trợ đọc màn hình.

Đăng xuất gặp lỗi mạng hoặc lỗi máy chủ giữ lại thông tin tài khoản và báo lỗi để thử lại; chỉ xóa trạng thái đăng nhập sau khi thành công hoặc máy chủ xác nhận phiên đã hết hạn. Đã thêm kiểm tra trình duyệt cho cả thất bại và thử lại thành công.

`/me/profile` của nhân viên không có vai trò bạn đọc được chuyển về `/account/profile`. Link cũ `/change-password` được chuyển về khung phù hợp khi không bắt buộc đổi mật khẩu; luồng bắt buộc đổi sau đăng nhập vẫn giữ nguyên.

## Danh sách và biểu mẫu

- Tài khoản: bảng chỉ xem; nhóm bạn đọc bằng chữ và chỉ áp dụng với vai trò bạn đọc. Vai trò rút gọn tối đa hai nhãn rồi `+N`. Form tạo chỉ mở từ nút; sửa, khóa/mở khóa và đặt lại mật khẩu có dialog riêng. Có giải thích việc thu hồi phiên đăng nhập, khóa pending và giữ lỗi trong dialog. Menu dòng đóng bằng Esc/bấm ngoài. Không đổi dữ liệu khi chọn bộ lọc, mở dialog hoặc hủy.
- Kho: danh sách cuốn, tổng số và phân trang là nội dung chính. Thêm cuốn, vị trí kệ, mã xếp giá và cập nhật cuốn mở riêng. Thay vị trí trong dialog chỉ ghi khi nhấn Lưu. API trả `locationName` để không phải tải toàn bộ vị trí chỉ nhằm hiển thị bảng; giữ nguyên kiểm tra transaction nghiệp vụ.
- Bộ lọc tài khoản, kho và tra cứu dùng thao tác áp dụng/xóa rõ ràng, query URL, tổng số và phân trang API. Bộ lọc tra cứu giữ nguyên giá trị mã trên URL nhưng hiển thị tên ngôn ngữ dễ đọc; giải thích khi chưa có NXB liên kết trong tài liệu công bố, không hiển thị chi tiết giới hạn kỹ thuật.
- Điện thoại: bộ lọc tra cứu mở dialog riêng; hủy/Esc/bấm nền giữ bộ lọc đang áp dụng. Thay đổi query bằng điều hướng đóng dialog và đồng bộ lại từ URL. Bảng tài khoản và cuốn chuyển sang thẻ.

Không thêm dependency hoặc migration trong lượt này. Phân quyền API và dữ liệu hồ sơ dùng chung không thay đổi.

## Kiểm chứng

- Lint, typecheck, build web/API và ba schema test shared đạt. Runner unit mặc định của API/web hiện không phát hiện unit test.
- `apps/api/test/accounts-workflows.integration.cjs`: PostgreSQL schema riêng, kiểm tra payload tạo/sửa nhiều vai trò/nhóm, bộ lọc/phân trang, DTO an toàn, khóa và reset thu hồi phiên; đạt.
- `apps/web/test/portal-navigation.browser.cjs`: Edge headless với API fixture, desktop 1440px/điện thoại 390px; kiểm tra menu bằng phím/bấm ngoài, khung hồ sơ và bảo mật, chuyển khu vực theo vai trò, bảng chỉ xem, mở/hủy không ghi dữ liệu, bộ lọc bản nháp/áp dụng/hủy và vị trí menu; đạt.
- `apps/web/test/ux-live.browser.cjs`: API thật và PostgreSQL test riêng, đăng nhập, khung hồ sơ/bảo mật nhân viên, danh sách tài khoản và mở/hủy tạo, cùng các luồng mượn/tra cứu/thông báo trước đó; đạt.
- `apps/web/test/ux.browser.cjs`: hồi quy hồ sơ, cảnh báo chưa lưu, tìm nhanh và lý do từ chối biên mục; đạt.

Các script trình duyệt dùng `PLAYWRIGHT_MODULE_PATH` tới Playwright ngoài ứng dụng. `UX_WEB_URL` chọn địa chỉ Vite, mặc định portal test là `http://localhost:5174`, các test cũ là `http://localhost:5173`. Ảnh kiểm tra mới nằm trong `artifacts/account-refinement/`. Kiểm tra với API thật chỉ dùng schema có tiền tố `ux_test_`; không dùng database chính.

Chưa kiểm tra máy quét vật lý, camera hoặc trình duyệt Safari; không bổ sung PWA, gợi ý sách hay chức năng nghiệp vụ mới trong lượt tinh gọn này.
