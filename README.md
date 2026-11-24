# thu-vien

Hệ thống quản lý thư viện dưới dạng monorepo npm workspaces: một backend NestJS, một frontend Vue 3 và một gói dùng chung.

## Cấu trúc

- `apps/api` — NestJS; module nghiệp vụ dưới `src/modules/`; Prisma + PostgreSQL.
- `apps/web` — Vue 3 + Vite; feature dưới `src/features/`; gọi API qua `src/shared/api/client.ts`.
- `packages/shared` — Zod schema, enum, khai báo vai trò/quyền dùng chung.
- `docs` — quy tắc nghiệp vụ, rules, prototype đối chiếu, UML và ADR.

Vai trò quyết định quyền và menu, không quyết định nơi chứa mã chức năng. Một backend và một frontend; chưa cần microservices.

## Yêu cầu

- Node 20 trở lên
- Docker (PostgreSQL và Mailpit qua `docker-compose.yml`)

## Cách 1: Chạy toàn bộ bằng Docker Compose

```bash
docker compose up --build -d
```

Lệnh này **build image rồi khởi động** web, API, PostgreSQL và Mailpit. Mở `http://localhost:8080`. Khi database mới được tạo, API tự chạy migration và nạp dữ liệu demo. Những lần chạy sau seed nhận ra dữ liệu đã có nên không chèn trùng hay ghi đè.

Docker bind-mount dữ liệu vào `data/` trong thư mục project:

- `data/postgres/` — database PostgreSQL.
- `data/documents/` — PDF học liệu.
- `data/demo-credentials/login.txt` — tài khoản và mật khẩu demo; xem trực tiếp file này sau lần chạy đầu.

Thư mục `data/` nằm trong `.gitignore`: không đưa database, PDF riêng hoặc mật khẩu lên GitHub. Người mới clone project sẽ tự có các thư mục và dữ liệu demo sau lần chạy đầu; dữ liệu người dùng từ máy khác không nằm trong GitHub. Muốn giữ hoặc chuyển database, dừng container rồi sao lưu `data/`. Đây là cấu hình demo local; không đưa thông tin mặc định ra Internet như hệ thống production.

`docker compose build` chỉ build image. Để build **và** khởi động cùng lúc, dùng `docker compose up --build -d` như trên. Sau đó dùng `docker compose stop` để dừng hoặc `docker compose down` để xóa container (thư mục `data/` vẫn giữ nguyên).

## Cách 2: Chạy API và web bằng npm

Dùng cách này khi muốn sửa code và tự reload. PostgreSQL và Mailpit vẫn chạy trong Docker; chạy API và web ở hai terminal riêng.

Nếu trước đó đã chạy cả ứng dụng bằng Compose, dừng riêng API/web trước để tránh trùng cổng:

```powershell
docker compose stop api web
```

Terminal thứ nhất (PowerShell):

```powershell
npm install
docker compose up -d postgres mailpit
$env:DATABASE_URL = "postgresql://thu_vien:thu_vien@localhost:5432/thu_vien?schema=public"
$env:SESSION_SECRET = "thay-bang-secret-that-it-nhat-16-ky-tu"
$env:WEB_ORIGIN = "http://localhost:5173"
$env:SMTP_HOST = "localhost"
$env:SMTP_PORT = "1025"
npm run prisma:generate --workspace apps/api
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm run prisma:seed:demo --workspace apps/api -- --apply
npm run dev:api
```

Terminal thứ hai:

```powershell
npm run dev:web
```

Mở `http://localhost:5173`. Nếu database đã có bộ demo thì seed tự bỏ qua; file thông tin đăng nhập được ghi tại thư mục tạm của hệ điều hành và đường dẫn được in ra bởi script.

## Build, lint và kiểm tra kiểu

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```
