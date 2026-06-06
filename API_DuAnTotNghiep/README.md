# 🏢 Room Management System - Backend API

This is the Backend API for a Room/Boarding House Management System. It supports managing rooms, tenants, online contracts, invoices, and repair requests. Built as a graduation project, this API serves as the data foundation for frontend applications (Web/Mobile App).

## 🚀 Live URL (Production)

* **Base URL:** `https://api-phong-tro.onrender.com`

> ⚠️ **Note for Frontend Team:** The system is hosted on Render's free tier. If there is no incoming traffic for 15 minutes, the server will automatically spin down (hibernate). The first request of the day may take 30 - 50 seconds to wake the server up. Subsequent requests will respond at normal speed.

---

## 🛠️ Tech Stack

* **Runtime Environment:** Node.js
* **Framework:** Express.js
* **Database:** MongoDB Atlas (Cloud Database)
* **ODM:** Mongoose
* **Hosting:** Render.com
* **Version Control:** Git & GitHub

---

## 📁 Project Structure

```text
├── src/
│   ├── configs/       # Database connection configuration (db.js)
│   ├── controllers/   # Business logic handlers (rooms, contracts, repairs...)
│   ├── models/        # Data structure definitions (Mongoose Schemas)
│   └── routes/        # API Endpoints routing
├── .env               # Environment variables configuration (Security for URI, Port)
├── .gitignore         # Files and folders to be ignored by Git
├── package.json       # Project dependencies and npm scripts
└── server.js          # Main application entry point