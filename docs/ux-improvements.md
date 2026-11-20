# Cải thiện giao diện ngày 20/11/2026

## Các thay đổi đã triển khai

| Nhóm | Hành vi trên màn hình | Backend |
|---|---|---|
| Điều hướng | Nhóm Tài liệu, Bạn đọc & mượn trả, Báo cáo, Quản trị; tên theo công việc; menu tài khoản thu gọn; sửa dấu tiếng Việt | Giữ quyền từ phiên đăng nhập |
| Tìm nhanh nhân viên | Ctrl+K, tìm tên chức năng không dấu, Enter mở kết quả đầu, Esc đóng | Chỉ hiện nghiệp vụ theo quyền; đây là chuyển trang, chưa phải tìm toàn bộ dữ liệu |
| Trang chủ | Việc cần làm có số lượng và liên kết bộ lọc; mô tả đầy đủ ở truy cập nhanh | `GET /me/workspace` tính theo quyền thật của tài khoản |
| Hồ sơ | Bốn mục thông tin, thẻ, bảo mật, thông báo; Lưu khi có thay đổi; Hoàn tác; cảnh báo rời trang; đổi mật khẩu | Lịch sử thẻ gần nhất và số khoản đang mượn qua `/me/card/activity`, chỉ của phiên hiện tại |
| Thông báo | Chuông, số chưa đọc, 5 nhắc hạn mới nhất, đánh dấu các mục đang hiển thị đã đọc | `Notification.readAt`; `POST /me/notifications/read` trả 204 và kiểm tra chủ sở hữu |
| Tra cứu | Tìm không dấu, tìm nâng cao thu gọn, dropdown có số lượng, chip, URL, lọc còn sẵn, NXB và sort liên quan/năm/sẵn sàng | SQL có tham số, lọc/sort/phân trang ở PostgreSQL; tối đa 500 giá trị phổ biến mỗi facet |
| Chi tiết sách | NXB, năm, ngôn ngữ, ISBN, từng mã cuốn/vị trí/trạng thái và hướng dẫn lấy sách | Chỉ tài liệu công bố được đọc công khai |
| Danh mục nhân viên | Tìm kiếm, sort, phân trang thật, bộ lọc URL; hành động chính theo trạng thái; menu phụ; từ chối có dialog bắt buộc lý do; trang chi tiết chỉ đọc | Query allowlist, tìm tác giả/nhan đề/ISBN, lọc bản ghi bị từ chối; DTO có ngày tạo/cập nhật và NXB |
| Quầy mượn trả | Tìm gợi ý, quét/gõ mã thẻ và mã cuốn + Enter; thông tin điều kiện bạn đọc; tra khoản mượn bằng mã cuốn trước khi trả | Gợi ý giới hạn 20 bạn đọc/15 cuốn, ưu tiên mã khớp chính xác; vẫn kiểm tra điều kiện trong transaction |
| Khoản mượn | Bộ lọc URL, tìm/sort/phân trang, bảng thành thẻ trên điện thoại, lý do chặn gia hạn hiển thị trước | DTO tính lý do từ thẻ, quá hạn, giới hạn và hàng chờ; máy chủ kiểm tra lại khi gia hạn |
| Đặt trước/Phạt | Giữ trạng thái và trang trên URL; đặt trước chuyển sang phân trang API 20 mục | Tái sử dụng API hiện có |

Không thêm dependency cho ứng dụng. Giữ Vue/NestJS/Prisma và bộ màu navy/vàng hiện có.

## Đối chiếu activity với giao diện

Các sơ đồ gốc không bị thay đổi. Bảng này ghi phạm vi đợt cải thiện, không thay cho nghiệm thu toàn bộ quy trình nghiệp vụ.

| Activity | Màn hình tương ứng | Trạng thái đợt này |
|---|---|---|
| AD01 Biên mục | Danh sách, tạo/sửa và chi tiết bản ghi | Đã sửa danh sách, tiến trình/hành động và dialog lý do; wizard, tự điền ISBN, nghi trùng khi gõ chưa làm |
| AD02–AD05 Mượn/trả/gia hạn/đặt trước | Quầy mượn trả, đặt trước | Đã sửa tìm mã, điều kiện bạn đọc, phân trang/URL và lý do gia hạn; chưa có giỏ quét hàng loạt |
| AD06 Sự cố | Hồ sơ sự cố | Liên kết việc mới từ trang chủ tới bộ lọc có sẵn; chưa thiết kế lại toàn trang |
| AD07 Kiểm kê | Kiểm kê kho | Đổi tên điều hướng; giữ luồng hiện có |
| AD08 Học liệu số | Thư viện số, hồ sơ nộp và màn hình nhân viên | Sửa điều hướng/mô tả; chưa tìm chung với sách giấy |
| AD09 Tra cứu | Tra cứu công khai, chi tiết tài liệu | Đã bổ sung bộ lọc, thông tin ấn bản, mã cuốn, vị trí và hướng dẫn |
| AD10 Tự gia hạn | Khoản mượn của tôi | Đã hiện số lượt/giới hạn và lý do chặn trước khi bấm |
| AD11 Hồ sơ | Hồ sơ cá nhân, đổi mật khẩu | Đã gom liên hệ, ảnh, thẻ, bảo mật và thông báo; phát hiện thay đổi chưa lưu |
| AD12 Thẻ | Hồ sơ phần Thẻ thư viện, màn hình cán bộ quản lý thẻ | Đã hiện số đang mượn/lịch sử của bản thân; gia hạn vẫn do cán bộ có quyền thực hiện |
| AD13 Nhắc hạn | Chuông và trang thông báo | Đã có trạng thái đọc ở backend, chủ sở hữu và retry thao tác đọc |
| AD14 Thu/miễn giảm | Khoản phạt, biên nhận | Giữ nghiệp vụ hiện có, bổ sung trạng thái URL; chưa thiết kế lại toàn trang |
| AD15 Chính sách/lịch | Chính sách thư viện | Đổi nhóm/mô tả, giữ nghiệp vụ hiện có |

## Các phần chưa triển khai

- Tìm gần đúng/sửa chính tả, gợi ý khi gõ, lịch sử/lưu tìm kiếm, tìm chung sách và học liệu số; facet hiện đếm toàn danh mục công bố, chưa đếm theo các bộ lọc còn lại.
- Ảnh bìa thật, quản lý loại tài liệu thống nhất, đổi lưới/danh sách, quick view, trích dẫn APA/IEEE/BibTeX, wishlist và gợi ý sách.
- Quét nhiều cuốn thành một giao dịch, thao tác hàng loạt, saved views và sửa tại dòng. Không thêm “Hoàn tác trả sách” vì chưa có nghiệp vụ đảo giao dịch/phạt/giữ chỗ được định nghĩa.
- Tự điền ISBN từ dịch vụ ngoài, wizard, autosave, nhập Excel có xem trước.
- QR thẻ, bản đồ kệ, camera ISBN, PWA/offline, dark mode, đa ngôn ngữ và tour hướng dẫn.
- Biểu đồ so sánh kỳ, xuất Excel/PDF mọi bảng và nhật ký trước/sau dữ liệu.
- Chưa thay mọi loading/empty/error hoặc window.confirm ở toàn bộ những màn hình ngoài phạm vi trên.

## Migration và chạy kiểm tra

Thêm migration `20261120100000_notification_read`. Trước khi chạy API mới trên môi trường của bạn:

```powershell
npm run build --workspace packages/shared
npm run prisma:generate --workspace apps/api
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

Không reset hoặc xóa dữ liệu. Các kiểm thử mới dùng schema PostgreSQL riêng.

```powershell
npm run lint
npm run typecheck
npm run test
npm run build --workspace apps/web
npm run build --workspace apps/api
```

Các kiểm thử tích hợp: `apps/api/test/public-search.integration.cjs`, `catalog-list.integration.cjs`, `ux-workflows.integration.cjs`. Đọc đầu mỗi file để cấp DATABASE_URL cho schema test; public/catalog test yêu cầu schema riêng đã migrate; UX test tự tạo schema có tiền tố `ux_test_`.

Kiểm thử trình duyệt: `apps/web/test/ux.browser.cjs` dùng API fixture để kiểm tra tương tác; `ux-live.browser.cjs` chạy với API thật, Vite và schema do UX test tạo. Cấp `PLAYWRIGHT_MODULE_PATH` tới Playwright đã cài ngoài ứng dụng và dùng Microsoft Edge headless. Ảnh kiểm tra nằm ở `artifacts/ux-review/`.

Kết quả kiểm tra đợt này:

- Lint, typecheck, build web/API: đạt.
- `npm run test`: 3 kiểm thử schema shared đạt; workspace API/web chưa có unit test được runner mặc định phát hiện.
- Ba bộ PostgreSQL tích hợp ở trên đạt; có kiểm tra truy cập trái phép, đọc thông báo của tài khoản khác, thao tác đọc lặp và giao dịch mượn/trả/gia hạn đồng thời.
- Smoke e2e đạt: tra cứu công khai hoạt động, session và ảnh hồ sơ từ chối truy cập ẩn danh.
- Edge headless 1440px/390px: hồ sơ lưu/hoàn tác/cảnh báo rời trang, Ctrl+K, dialog từ chối, chip/URL tìm kiếm đạt với API fixture. Đăng nhập thật, việc theo quyền, tìm mã cuốn + Enter, gợi ý bạn đọc, thẻ cá nhân, đánh dấu thông báo trả 204 và tra cứu đạt với API/PostgreSQL test thật.
- Đã sửa lỗi tràn thanh đầu trang và chiều rộng thẻ khoản mượn trên điện thoại phát hiện khi kiểm tra. Chưa kiểm tra camera/máy quét vật lý, Safari hoặc mọi luồng của tất cả 15 activity.
