# TroHub Web Admin

Ban build lại web quản lý phòng trọ TroHub, chỉ gồm giao diện Web Admin.

- Không dùng API.
- Không dùng database.
- Không có mobile app tenant.
- Dữ liệu demo nằm trong `src/data.js`.

## Chạy web

```bash
npm run dev
```

Mở trình duyệt tại:

```text
http://127.0.0.1:5173
```

## Tài khoản demo

```text
admin@trohub.vn / 123456
```

## Cấu trúc

```text
trohub-web-only/
├── index.html
├── package.json
├── README.md
└── src/
    ├── app.js
    ├── data.js
    └── styles.css
```
