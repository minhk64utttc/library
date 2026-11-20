# Hướng dẫn AI — thu-vien

## Phạm vi và trạng thái
- Áp dụng toàn bộ repository thu-vien. Đây là kiến trúc đích; không khẳng định app đã được tạo hoặc chạy.
- Stack: Vue 3, Vite, TypeScript strict, Pinia; NestJS; Prisma; PostgreSQL; Zod; npm workspaces.
- Không dùng axios. Web gọi HTTP qua apps/web/src/shared/api/client.ts dùng fetch.
- Đọc docs/quy-tac-nghiep-vu.md trước khi sửa nghiệp vụ; prototype và UML là tài liệu đối chiếu, không phải nguồn quyết định khi mâu thuẫn.
- Đọc docs/rules/api.md khi sửa apps/api/src/modules/**; docs/rules/web.md khi sửa apps/web/src/features/**; docs/rules/shared.md khi sửa packages/shared/**.

## Cách làm
- Trước khi sửa: kiểm tra scripts, phiên bản và lockfile thực tế; nêu ngắn gọn phạm vi thay đổi.
- Một chức năng có một implementation chính. Không ghi đè hàm toàn cục, vá chuỗi HTML hoặc sao chép nguyên prototype vào ứng dụng mới.
- Giữ modules theo nghiệp vụ; controller điều phối, service xử lý nghiệp vụ, Prisma truy cập dữ liệu.
- Vai trò quyết định quyền và menu, không quyết định nơi chứa mã chức năng. Không viết lại cùng một nghiệp vụ trong thư mục theo vai trò.
- Tạo module khi triển khai chức năng; cây thư mục là cấu trúc đích, không tạo hàng loạt thư mục trống trước khi có luồng thực tế.
- Không tự đổi stack hoặc thêm thư viện trùng chức năng. Khi cần dependency mới, giải thích lý do và cập nhật lockfile.
- Không hardcode quyền, giới hạn mượn hoặc phí ở nhiều lớp. Máy chủ quyết định; frontend chỉ phản ánh kết quả.
- Không coi dữ liệu mẫu là quy chế thật. Ghi rõ giả định chưa chốt.
- Không đưa secrets, mật khẩu, reset token hoặc toàn bộ hồ sơ cá nhân vào log, git, URL hay phản hồi lỗi.
- Không sửa migration đã áp dụng; tạo migration mới. Không reset/drop database có dữ liệu người dùng nếu chưa được yêu cầu.
- Không sửa docs/prototype/** trong công việc triển khai trừ khi người dùng yêu cầu cập nhật bản đối chiếu.

## Hoàn thành công việc
- Chạy lint, typecheck và kiểm thử phù hợp qua scripts thực sự có trong package.json. Không báo đã chạy lệnh chưa tồn tại.
- Sửa UI: kiểm tra loading/error/empty, bàn phím và màn hình nhỏ; nêu rõ nếu chưa kiểm tra trình duyệt.
- Sửa mượn/trả/phân quyền: kiểm thử phía API với PostgreSQL test và trường hợp cạnh tranh đồng thời.
- Báo cáo: thay đổi gì, kiểm thử nào đã chạy, hạn chế còn lại. Không gọi bản mô phỏng là tính năng production.
- Khi bootstrap, tạo scripts root dự kiến: dev, build, lint, typecheck, test, test:e2e; chỉ ghi hướng dẫn chạy sau khi đã kiểm chứng.

## Skills
- Dùng docs/skill-map.md để chọn skill theo nhiệm vụ; không nạp mọi skill cho mỗi lần sửa.
- Skill không thay thế rule dự án, kiểm thử tự động hoặc phân quyền phía máy chủ.

## Agent chuyên trách
Rule quy định chung; skill là quy trình một loại việc; agent chuyên trách nhận một nhiệm vụ có phạm vi và kết quả bàn giao rõ; CI/test là kiểm tra tự động — không thay bằng lời nhận xét của agent.

| Agent | Nhiệm vụ | Quyền |
|---|---|---|
| implementer | Viết chức năng xuyên suốt shared → API → web | Sửa phần được giao |
| domain-reviewer | Kiểm tra quy chế, quyền, trạng thái mượn/trả, đặt trước, phạt | Chỉ đọc và báo lỗi |
| code-reviewer | Kiểm tra validation, truy cập trái phép, transaction, XSS, phiên đăng nhập | Chỉ đọc và báo lỗi |

Không cần chạy mọi agent mỗi lần. Ví dụ đổi màu nút chỉ cần kiểm tra UI; sửa cho mượn sách cần review nghiệp vụ và transaction. Ưu tiên một agent triển khai chính + hai reviewer (nghiệp vụ và code/bảo mật); chỉ chia nhiều agent cùng viết khi đã thống nhất API/schema và ít đụng cùng file.

## Quy trình code review

```text
Chốt yêu cầu + tiêu chí nghiệm thu
              ↓
Agent chính triển khai và chạy kiểm thử
              ↓
Reviewer nghiệp vụ  ║  Reviewer code/bảo mật
              ↓
Agent chính xem xét phát hiện, sửa lỗi
              ↓
Chạy lại kiểm thử liên quan
              ↓
Review lại phần đã sửa → bàn giao
```

- Với thay đổi nghiệp vụ, phân quyền, dữ liệu hoặc bảo mật, yêu cầu review độc lập trước khi bàn giao.
- Reviewer đọc diff và phần mã liên quan; không tự sửa mã.
- Kiểm tra theo yêu cầu và quy tắc nghiệp vụ đã chốt. Không biến giả định chưa xác nhận thành lỗi chắc chắn.
- Ưu tiên lỗi ảnh hưởng hành vi, dữ liệu, bảo mật và khả năng vận hành. Không yêu cầu refactor chỉ vì sở thích cá nhân.
- Mỗi phát hiện phải có: 1) mức độ nghiêm trọng; 2) file và dòng mã; 3) điều kiện gây lỗi; 4) hậu quả cụ thể; 5) cách tái hiện hoặc kiểm thử chứng minh; 6) hướng sửa ngắn gọn.
- Không khẳng định đã chạy test nếu chỉ đọc mã.
- Agent triển khai phải xử lý từng phát hiện: sửa và kiểm thử, hoặc giải thích có bằng chứng vì sao không sửa.
- Reviewer kiểm tra lại phần thay đổi sau khi sửa.
- Nếu không tìm thấy lỗi, ghi rõ phạm vi đã kiểm tra và những phần chưa kiểm chứng.
- Agent không tự merge, deploy hoặc thay đổi dữ liệu thật chỉ vì review không còn phát hiện.
