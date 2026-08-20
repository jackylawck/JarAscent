# 🚀 躍上穹蒼 3D | JarAscent 3D

> **Where Aerospace Physics Meets Interactive Art.**  
> 一個融合嚴謹航太天體力學、程序化 3D 渲染與沉浸式飛行體驗的 WebGL 開源模擬沙盒。

---

## 📖 關於本專案 (About This Project)

### 繁體中文
本專案最初是為了我和兒子共渡美好時光而開發的非商業個人專案！我們希望透過親手打造的 3D 火箭，讓孩子在探索宇宙與科學模擬的過程中感受創造的快樂。誠摯邀請所有熱愛航太、科技與程式設計的朋友一起體驗火箭升空的震撼與樂趣，共創無價的探索回憶！

### English
This project is a non-commercial, personal endeavor created to spend quality, inspiring moments with my son! By building an interactive 3D rocket sandbox together, we aim to ignite curiosity about space science and the joy of creation. We warmly invite friends, educators, and space enthusiasts worldwide to experience the thrill of spaceflight and build priceless memories together!

---

## 🌟 核心特色 (Key Features)

* **🔬 航太工程級天體力學 (Aerospace Dynamics Core)**
  * **顯式質量守恆 RK4 數值積分 (Explicit Mass RK4)**：四階 Runge-Kutta 積分器同步解算位置、速度與燃料消耗導數。
  * **J2 帶諧扁率攝動 (J2 Oblateness Perturbation)**：真實還原地球自轉橢球體重力場效應。
  * **三維月球星曆攝動 (3D Lunar Perturbations)**：納入 $5.14^\circ$ 白道傾角與 $e=0.0549$ 離心率橢圓軌道。
  * **NASA CEA 非線性燃燒比衝模型**：區分富氧與富燃料工況的非對稱熱化學衰減。
  * **黏性共轉大氣與風梯度力矩 (Viscous Atmosphere & Wind Shear Torque)**：高層大氣指數衰減與對流層急流側向力矩擾動。
  * **PD-TVC 推力向量姿態阻尼控制**：比例-微分閉環控制器，消除跨大氣層過衝與共振。

* **🎨 3A 級程序化 PBR 幾何管線 (Procedural PBR & Geometry Pipeline)**
  * **Sobel 切線空間立體法線貼圖 (Tangent-Space Normal Mapping)**：程序化生成裝甲縫與鉚釘微表面光影。
  * **德拉瓦爾鐘型噴管連續車削 (Lathe Bell Nozzles)**：遵循二次拋物線擴散樣條與萬向節結構。
  * **真實分離機構與熱防護 (Staging & Thermal Ablation)**：包含實體火工爆炸螺栓、隔熱瓦網格、底部高溫燒蝕與冷凝水流痕。
  * **多級幾何適配 (Multi-LOD System)**：支援 LOD0 (64段) / LOD1 (32段) / LOD2 (16段) 視角自適應。

* **🕹️ 沉浸式駕駛艙與硬核互動 (Cockpit Experience & Player Agency)**
  * **第一人稱座艙視角 (Cockpit View - 鍵盤 `C`)**：坐在飛船舷窗前俯瞰地球弧線與茫茫星海。
  * **WASD / QE 手動姿態操縱 (Manual Flight Controls)**：允許手動介入 TVC 噴嘴偏航 (Yaw)、俯仰 (Pitch) 與滾轉 (Roll)。
  * **400km 天宮空間站霍曼交會雷達 (Orbital Rendezvous Radar)**：實時解算相對距離 $\Delta r$、相對速度 $\Delta v$ 與相位角。
  * **三頻分層聲學引擎 (Tri-Band Audio Synthesis)**：52Hz 次重音地面震撼 + 粉紅噪聲燃燒撕裂 + 高頻超音速噴流呼嘯。
  * **事故黑盒重建 (Blackbox Reconstruction)**：提供詳細事故日誌與首席工程師調校建議。
  * **0.3s 電影級淡入淡出快速重試 (Seamless Retry)**：保留調校參數，無需重新整理網頁。
  * **自訂 3D 打印 STL 載入**：自動計算網格體積、乾重、特徵截面積與氣動外形。

---

## 🚀 收錄火箭型號 (Supported Launch Vehicles)

| 型號 (Model) | 推進劑類型 (Propellant) | 級數 (Stages) | 起飛推力 (Sea-Level Thrust) | 任務構型 (Mission Profile) |
| :--- | :--- | :---: | :--- | :--- |
| **長征十號甲 (CZ-10A)** | 液氧/煤油 (LOX/Kerosene) | 2 | 8,400 kN (7x YF-100K) | 登月載人飛船 (Crew Lunar) |
| **長征十二號乙 (CZ-12B)** | 液氧/煤油 (LOX/Kerosene) | 2 | 5,000 kN (4x YF-100K) | 4米級商業主力 (SSO/LEO) |
| **天龍三號 (TL-3)** | 液氧/煤油 (LOX/Kerosene) | 2 | 7,550 kN (9x TH-12) | 大型液體複用型 (Constellation) |
| **力箭二號 (LJ-2)** | 液氧/煤油 + 2捆綁助推 | 2 | 4,000 kN | 液體捆綁低軌發射 (SSO) |
| **引力一號 (YL-1)** | 全固體推進劑 (Solid) | 2 | 5,900 kN (4捆綁固體) | 全固體重型星座發射 |
| **雙曲線三號 (SQX-3)** | 液氧/甲烷 (Methalox) | 2 | 7,600 kN (9x JD-2) | 甲烷垂直回收型 (VTVL) |
| **長征二號F (CZ-2F)** | 四氧化二氮/偏二甲肼 | 2 | 5,920 kN (4捆綁助推) | 神舟載人飛船專用型 |
| **星艦全系統 (Starship)** | 液氧/甲烷 (Methalox) | 2 | 72,000 kN (33x Raptor) | 120m 超重型深空探索全系統 |
| **土星五號 (Saturn V)** | 液氧/煤油 + 液氫/液氧 | 2 | 34,500 kN (5x F-1) | 阿波羅登月重型火箭 |
| **自訂 3D 打印模型 (Custom STL)** | 風洞動態解算 | 2 | 依據體積與幾何自動估算 | 使用者自製 3D 模型沙盒 |

---

## 🎮 操作指南 (Control Guide)

### 鍵盤快捷鍵 (Keyboard Shortcuts)
* **`Space`**：暫停 / 繼續飛行 (Pause / Resume)
* **`C`**：切換第一人稱座艙視角 / 外景導演鏡頭 (Toggle Cockpit View)
* **`W` / `S`**：手動俯仰姿態微調 (Pitch Up / Down)
* **`A` / `D`**：手動偏航姿態微調 (Yaw Left / Right)
* **`Q` / `E`**：手動滾轉姿態微調 (Roll Left / Right)

### 畫面觸控與滑鼠操作 (Mouse & Touch)
* **滑鼠左鍵拖曳 / 單指滑動**：360° 旋轉軌道鏡頭。
* **滑鼠右鍵拖曳 / 雙指平移**：平移鏡頭焦點。
* **滾輪滾動 / 雙指縮放**：拉近 / 推遠視角距離。
* **快速重試按鈕 (`⚡ 再次挑戰`)**：一鍵將火箭復位至發射台，保留所有調校參數。

---

## 📁 專案架構 (Architecture)

```text
JarAscent/
├── index.html              # 3A 級駕駛艙 HUD、交會雷達、PWA 進入點
├── manifest.json           # PWA 行動應用配置清單
├── sw.js                   # Service Worker 快取與版本控制
├── JarAscenticon-192.png   # 應用程式圖示
└── js/
    ├── physics_core.js     # 顯式 RK4、J2 攝動、三體、NASA CEA 燃燒模型與 PD-TVC
    ├── rockets_data.js     # 推進劑熱化學庫、噴管面積比與事件驅動分離資料庫
    ├── rocket_builder.js   # 程序化切線空間法線、德拉瓦爾鐘型噴管與 Multi-LOD
    └── rocket_game.js      # 狀態機、三頻分層音效、座艙視角與霍曼交會主控

```

---

## 💻 本地運行 (Local Setup)

本專案採用純原生 **HTML5 + WebGL (Three.js)** 構建，**零外部後端依賴、零編譯打包步驟**。

1. **Clone 專案庫**
```bash
git clone [https://github.com/your-username/JarAscent.git](https://github.com/your-username/JarAscent.git)
cd JarAscent

```


2. **啟動靜態伺服器** (因 ES Module 與 Service Worker 限制，需透過 HTTP 伺服器開啟)
```bash
# 使用 Python
python -m http.server 8080

# 或使用 Node.js http-server
npx http-server -p 8080

```


3. **開啟瀏覽器**
造訪 `http://localhost:8080` 即可開始點火發射！

---

## 📱 PWA 手機端安裝 (Install as PWA)

1. 使用 iPhone (Safari) 或 Android (Chrome) 打開專案網址。
2. 點擊瀏覽器選單上的 **「分享」** 或 **「設定」** $\to$ 選擇 **「加入主畫面 (Add to Home Screen)」**。
3. 即可在手機上體驗無瀏覽器邊框、全螢幕運行的 60 FPS 獨立 App。

---

## 📄 開源授權 (License)

本專案基於 **MIT License** 開源發布。您可以自由修改、研發與非商業使用，歡迎一同為孩子與航太社群共創更豐富的模擬功能！

