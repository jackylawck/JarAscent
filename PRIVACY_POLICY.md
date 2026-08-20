# 隱私政策 / Privacy Policy

**最後更新日期 / Last Updated:** 2026-08-20

---

## 繁體中文

### 1. 資料收集原則 (Data Minimization)
「躍上穹蒼 3D (JarAscent 3D)」為完全在使用者瀏覽器本地端運行的開源、非商業科學模擬沙盒。本應用遵守歐盟《一般資料保護規則》(GDPR) 的「資料最小化原則」：
* **無個人識別資訊 (PII)：** 本應用不收集、不傳輸、不儲存任何使用者的姓名、電子郵件、IP 位址或生物特徵數據。
* **無外部資料庫：** 本專案無任何後端伺服器或追蹤分析資料庫。

### 2. 本地儲存 (Local Storage & PWA Caching)
* 本應用使用瀏覽器的 `localStorage` 技術，僅用於在使用者本機端保存發射參數（例如發動機設定、推力比例、語言偏好）。
* 透過 Service Worker 快取應用程式靜態資源，以支援離線遊玩 (PWA)。
* 使用者可隨時透過瀏覽器設定清除快取與本地儲存資料。

### 3. 第三方資源與安全性
本應用載入之外部依賴（如 CDN 代管的 Three.js 程式庫）均遵循內容安全策略 (CSP)，不包含任何惡意廣告或使用者追蹤程式碼。

---

## English

### 1. Data Minimization & Collection
"JarAscent 3D" is an open-source, non-commercial educational simulation sandbox that operates entirely client-side. In accordance with the EU General Data Protection Regulation (GDPR):
* **No Personally Identifiable Information (PII):** This application does not collect, transmit, or store any personal data, including names, emails, IP addresses, or biometric profiles.
* **No External Database:** There are no backend tracking servers, telemetry trackers, or external analytical databases.

### 2. Local Storage & Caching
* The application utilizes browser `localStorage` solely to persist user-configured flight parameters (e.g., engine profiles, throttle settings, UI language) locally on your device.
* Service Workers are utilized to cache static assets for offline Progressive Web App (PWA) functionality.
* Users may delete all locally stored data at any time via browser settings.

### 3. Third-Party Dependencies & Security
External libraries loaded via CDNs (such as Three.js) comply with strict Content Security Policies (CSP) and contain no commercial advertising or third-party tracking scripts.
