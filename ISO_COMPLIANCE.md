# ISO 國際標準治理合規聲明 / ISO Standards Compliance Statement

**對標標準 / Target Standards:**  
- ISO/IEC 27001:2022 (Information Security Management Systems)  
- ISO/IEC 27701:2019 (Privacy Information Management Systems)  
- ISO/IEC 42001:2023 (Artificial Intelligence Management Systems)  

**最後更新 / Last Updated:** 2026-08-20

---

## 繁體中文

### 1. ISO/IEC 27001:2022 資訊安全控制 (Information Security)
* **零伺服器攻擊面 (Zero-Backend Architecture)：** 專案採用 100% 客戶端運算架構，不設遠端資料庫與使用者帳號系統，消除資料集中外洩之技術風險。
* **安全編碼與供應鏈安全 (Secure Coding & Supply Chain)：** 外部資源僅引用高可用性 CDN 驗證之 Three.js 核心庫，並透過嚴格之 Content-Security-Policy (CSP) 阻斷 XSS 跨站腳本與非法資料外聯。
* **傳輸層防護 (In-Transit Protection)：** 全面強制啟用 HTTPS 協定，確保靜態資產與 Service Worker 快取之完整性。

### 2. ISO/IEC 27701:2019 隱私資訊管理 (Privacy Information)
* **隱私預設與設計 (Privacy by Design and by Default)：** 遵循資料最小化（Data Minimization）原則，完全不收集、不處理、不共享任何個人識別資訊（PII）。
* **本機儲存可控性 (Data Subject Control)：** 使用者配置參數（如火箭發動機選型、節流閥開度）均純本機儲存於瀏覽器 `localStorage`，使用者可隨時一鍵清除或透過瀏覽器抹除。

### 3. ISO/IEC 42001:2023 人工智慧管理 (AI Management)
* **確定性算法基準 (Deterministic Baseline)：** 系統核心飛行軌道與大氣動力學採用經典物理與確定性數值積分方程（RK4），具備 100% 可重複性與數學可解釋性（Explainability）。
* **AI 透明度與風險界定 (AIMS Transparency)：** 若未來整合生成式 AI 提供事故黑盒診斷，將全面遵循人機協同（Human-in-the-Loop）原則，標註生成式內容來源，並確保本機遙測資料不被回傳用於模型微調訓練。

---

## English

### 1. ISO/IEC 27001:2022 Information Security Controls
* **Zero-Backend Attack Surface:** Operating strictly as a client-side WebGL application, the system eliminates centralized database breach vectors and unauthorized server-side access risks.
* **Secure Coding & Supply Chain Assurance:** External script dependencies are strictly managed via high-integrity CDNs under a rigorous Content-Security-Policy (CSP) to mitigate Cross-Site Scripting (XSS).
* **Transport Encryption:** Mandatory HTTPS enforcement ensures the cryptographic integrity of static assets and Service Worker caches.

### 2. ISO/IEC 27701:2019 Privacy Information Controls
* **Privacy by Design & Data Minimization:** The architecture inherently prohibits the collection, storage, or transmission of Personally Identifiable Information (PII).
* **User Data Sovereignty:** Flight settings and preferences are stored exclusively within client-side `localStorage`, granting users full autonomy to inspect or purge records at will.

### 3. ISO/IEC 42001:2023 AI Management Controls
* **Deterministic Baseline & Explainability:** Astrodynamics and physics simulations rely solely on verified numerical integration (RK4), ensuring full mathematical explainability without autonomous neural blackboxes.
* **AIMS Governance & Human-in-the-Loop:** Should automated/Generative AI modules be introduced for mission debriefing, they will feature strict provenance disclosures and Human-in-the-Loop verification, with a complete prohibition on telemetry harvesting for model training.
