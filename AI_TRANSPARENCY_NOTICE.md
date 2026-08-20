# AI 與演算法透明度聲明 / AI & Algorithm Transparency Notice

**合規對標 / Compliance Alignment:** ISO/IEC 42001:2023, EU AI Act (Article 50)

---

## 繁體中文

### 1. 核心物理運算性質 (Deterministic Algorithms)
本模擬器的飛行姿態、開普勒軌道及 Runge-Kutta 積分**完全基於確定性數學與物理方程 (Deterministic Physics Equations)**，不包含不可預測的機器學習推論黑盒。

### 2. AI 治理與透明度規範 (AI Governance Framework)
若未來版本整合生成式 AI (Generative AI) 或大語言模型 (LLM) 提供智慧事故分析：
* **生成式內容標示：** 所有 AI 產生的診斷建議均會明確加註「本分析由 AI 輔助生成 (AI-Generated Content)」，符合歐盟 AI 法案透明度要求。
* **人機協同 (Human-in-the-Loop)：** AI 建議僅作為輔助教學參考，使用者應保持批判性驗證。
* **零資料訓練承諾：** 不會將使用者的本機配置或操作行為傳輸至任何第三方模型進行訓練。

---

## English

### 1. Deterministic System Baseline
The core physics calculations (RK4 numerical integration, J2 gravity fields, Keplerian orbital mechanics) are executed via **deterministic algorithms**, operating without autonomous neural blackbox decision-making.

### 2. AI Governance & Transparency
In alignment with ISO/IEC 42001 and EU AI Act transparency obligations, should future extensions integrate Generative AI (LLMs) for mission telemetry diagnostics:
* **Clear Attribution:** All AI-synthesized debriefings will feature prominent disclosures confirming automated generation.
* **Human Oversight:** Automated outputs serve purely as educational recommendations and must not supersede verified engineering standards.
* **No Model Training:** User inputs and local parameters are never transmitted or repurposed for third-party AI model training.
