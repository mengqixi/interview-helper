export const CANDIDATE_CONTEXT = `
Candidate background:

Basic profile:
- Name: Zhou Hejian.
- School: Shanghai Polytechnic University, School of Computer and Information Engineering.
- Major: Network Engineering.
- Study period: 2023.09-2027.06.
- English: CET-4.

Skills:
- Programming: Python and basic SQL development.
- Engineering tools: basic Linux and Git practice.
- AI tools: uses Codex, Claude, and DeepSeek API for coding, debugging, API integration, testing, and project documentation.
- Other: video editing and self-media operation experience; personal Bilibili account has about 15,000+ followers.

Project 1: Password Attack Detection and Privacy-Preserving Training Platform, municipal innovation project.
- Repository: github.com/mengqixi/dachuang.
- Stack: Python, Flask, SQLite, pandas, scikit-learn, PyCryptodome, logging, configuration utilities.
- Positioning: a security analysis platform for account-login security, password attack detection, and privacy-preserving training scenarios.
- User-side features: CSV/JSON upload, account risk detection, cause analysis, and report download.
- Admin-side features: user-submission review, data processing, model version management, training records, system access audit, and security event inspection.
- Detection approach: combines rule-based scoring, behavior-feature scoring, and lightweight model scoring to output risk level, risk score, attack type, trigger factors, and mitigation suggestions.
- Machine learning: uses scikit-learn based risk recognition, including Isolation Forest and lightweight Logistic Regression or MLP-style models; the codebase also contains an LSTM detector and public security dataset ingestion extensions.
- Security and privacy: uploaded data is encrypted for archival storage, sensitive fields are masked for display, AES is used for file protection, and Paillier homomorphic encryption is used to demonstrate protected numeric fields and privacy-preserving workflows.
- Federated learning: includes a FedAvg four-node training flow, FATE/Primihub client direction, model-version tracking, and training-task records. The practical landing point is account-login security and password-attack risk recognition.
- Candidate contribution: independently built user and admin sides, handled requirement breakdown, API integration, tests, deployment documentation, and project report writing.
- Good interview angles: explain why Flask and SQLite were chosen for fast delivery, why rule-plus-model fusion improves interpretability compared with a single black-box model, and how privacy/security modules can be extended.

Project 2: CrossNotify, cross-device instant notification system.
- Repository: github.com/mengqixi/qqwx.
- Stack: Node.js, ws WebSocket, Electron, Kotlin, OkHttp, AndroidX, HMS Push, Firebase Admin SDK, Nginx, PM2.
- Positioning: a cross-device instant notification and message-transfer tool between PC and Android.
- Architecture: a Node.js WebSocket signaling server connects a PC Electron client and an Android Kotlin client; the server integrates HMS Push or FCM for offline push; deployment runs on Linux with Nginx SSL reverse proxy and PM2 process management.
- Main features: bidirectional text notifications, image transfer, offline push, persistent message history, pinned messages, Android floating bubble, automatic reconnect, background keep-alive, and boot receiver startup.
- Android implementation: WebSocketService handles foreground service, persistent connection, and WakeLock; HmsPushService handles Huawei push; BubbleService shows floating message history; BootReceiver starts the service after boot.
- PC implementation: Electron main process, preload, and renderer are separated for desktop notification, WebSocket communication, image selection/saving, and UI interaction.
- Candidate contribution: independently built the server, Windows desktop client, and Android client, and completed Linux cloud deployment and daily operations.
- Good interview angles: explain trade-offs between WebSocket long connections and offline push, reconnect strategy, Android background restrictions, message persistence, Electron desktop integration, and deployment operations.

Answering strategy:
- When the interviewer asks about projects, prefer using the two projects above. Do not invent experience that is not listed here.
- For AI, backend, or security questions, prefer Project 1 and emphasize feature engineering, rule/model fusion, interpretability, data security, federated learning, and homomorphic-encryption demonstration.
- For engineering, networking, mobile, realtime communication, or deployment questions, prefer Project 2 and emphasize WebSocket long connections, offline push, Android background limits, Electron desktop client design, and Linux deployment.
- It is acceptable to say the candidate mainly handled independent development, integration, testing, and documentation, while using AI tools to improve efficiency. Do not make the answer sound fully dependent on AI.
`.trim()
