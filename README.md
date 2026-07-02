# Interview Helper

Interview Helper is a local web application for technical interview assistance. It captures live audio, transcribes speech through Xfyun realtime ASR, and asks DeepSeek for concise interview-ready answers.

This fork includes fixes for:

- DeepSeek requests through a backend proxy, avoiding browser CORS issues.
- Xfyun realtime speech-to-text with APPID, APIKey, and APISecret.
- Browser-based microphone capture.
- Browser-based meeting/system audio capture through screen sharing.
- Automatic interviewer-question detection.
- Manual question sending to DeepSeek.
- Candidate/project context injection for more relevant computer science and AI answers.
- A fixed-height bottom toolbar to avoid layout jumping during recording.

## Features

- Realtime transcript panel
- AI answer panel with Markdown rendering
- Manual question input
- Meeting audio mode for Tencent Meeting, Zoom, browser tabs, and other shared-audio sources
- Microphone mode for local speech testing
- DeepSeek configuration from the app settings page
- Xfyun realtime ASR configuration from the app settings page
- Login and session APIs backed by FastAPI, PostgreSQL, and Redis

## Tech Stack

Frontend:

- React 19
- TypeScript
- Vite
- Ant Design
- Zustand
- Web Audio API

Backend:

- FastAPI
- PostgreSQL
- Redis
- SQLAlchemy
- JWT authentication
- httpx proxy for DeepSeek-compatible chat completion APIs

External services:

- DeepSeek Chat API
- Xfyun realtime speech-to-text large model WebSocket API

## Quick Start With Docker

The easiest way to run the full application is:

```bash
docker compose -f docker-compose.full.yml up --build -d
```

Default services:

| Service | URL / Port |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:9000 |
| Backend Swagger | http://localhost:9000/docs |
| PostgreSQL | localhost:5462 |
| Redis | localhost:6389 |

Check containers:

```bash
docker ps
```

Restart after code changes:

```bash
docker restart ai-interview-backend-full ai-interview-frontend-full
```

View logs:

```bash
docker logs -f ai-interview-backend-full
docker logs -f ai-interview-frontend-full
```

## Default Account

The project includes a default test account in the original setup scripts:

```text
username: test
password: test1234
```

If the account does not exist in your database, run the backend initialization script inside the backend container or register a new account from the app.

## App Configuration

Open:

```text
http://localhost:5173/settings
```

Configure the following providers in the UI.

### DeepSeek

Recommended values:

```text
API Key: your DeepSeek API key
API Base URL: https://api.deepseek.com
Model: deepseek-chat
Temperature: 0.3 to 0.7
Max Tokens: 2000
```

DeepSeek requests are sent to:

```text
Frontend -> Backend /api/ai/chat/completions -> DeepSeek API
```

This keeps the browser from calling DeepSeek directly and avoids CORS problems.

### Xfyun Realtime ASR

Use the Xfyun realtime speech-to-text large model service.

Console page:

```text
https://console.xfyun.cn/services/new_rta
```

Required fields:

```text
APPID
APIKey
APISecret
```

The application uses the WebSocket endpoint:

```text
wss://office-api-ast-dx.iflyaisol.com/ast/communicate/v1
```

Do not commit real API keys to this repository. Store them through the app settings page or local environment variables only.

## Using Meeting Audio

For online interviews, use `Meeting audio` mode.

1. Open the interview page.
2. Select `Meeting audio` in the bottom toolbar.
3. Click `Start interview`.
4. The browser will ask you to share a screen, window, or tab.
5. Choose the source that contains the meeting audio.
6. Enable audio sharing in the browser sharing dialog.
7. Start speaking or let the interviewer speak.

Notes:

- In Chromium-based browsers, tab audio sharing is usually the most reliable option.
- Some desktop meeting apps may not expose audio to browser screen capture on all systems.
- If meeting audio is unavailable, try joining the meeting in a browser tab and sharing that tab.
- Use `Microphone` mode to test whether ASR and DeepSeek work without meeting audio.

## Interview Flow

1. Log in.
2. Create or open an interview.
3. Configure role, language, and region.
4. Select `Meeting audio` or `Microphone`.
5. Click `Start interview`.
6. The right panel shows live transcript messages.
7. Interviewer messages can trigger DeepSeek automatically.
8. You can also type a question manually and click `Send`.
9. Answers appear in the main panel.

## Candidate Context

This fork includes a local candidate context file:

```text
frontend/src/data/candidateContext.ts
```

It helps DeepSeek answer questions about the candidate's resume and projects, including:

- Password Attack Detection and Privacy-Preserving Training Platform
- CrossNotify cross-device instant notification system

The context intentionally avoids private contact details such as phone number and email.

To customize it, edit the file and rebuild/restart the frontend:

```bash
docker exec ai-interview-frontend-full npm run build
docker restart ai-interview-frontend-full
```

## Local Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Build:

```bash
cd frontend
npm run build
```

### Backend

```bash
cd backend
pip install -r requirements.txt
python run_server.py
```

For Windows-specific startup:

```bash
cd backend
python run_server_windows.py
```

## Environment Variables

Backend example:

```env
DATABASE_URL=postgresql://postgres:root@localhost:5462/ai_interview_helper
REDIS_URL=redis://localhost:6389
SECRET_KEY=change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=["http://localhost:5173", "http://localhost:3000"]
```

Frontend example:

```env
VITE_API_BASE_URL=http://localhost:9000
```

Optional Xfyun variables are supported, but using the settings page is recommended:

```env
VITE_XFYUN_APPID=your_app_id
VITE_XFYUN_API_KEY=your_api_key
VITE_XFYUN_API_SECRET=your_api_secret
```

## API Endpoints

Main endpoints:

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/health` | Backend health check |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/sessions/` | Interview sessions |
| GET/POST | `/api/sessions/{id}/messages` | Session messages |
| POST | `/api/ai/chat/completions` | DeepSeek-compatible chat completion proxy |

API docs:

```text
http://localhost:9000/docs
http://localhost:9000/redoc
```

## Troubleshooting

### DeepSeek does not answer

Check:

- DeepSeek API key is configured in Settings.
- Base URL is `https://api.deepseek.com`.
- Backend is running on port `9000`.
- Browser can reach `http://localhost:9000/health`.
- Backend logs do not show upstream API errors.

Useful commands:

```bash
docker logs -f ai-interview-backend-full
docker restart ai-interview-backend-full
```

### Realtime transcript stops after a few seconds

Check:

- Xfyun APPID, APIKey, and APISecret are from the `new_rta` service page.
- You have remaining service time or quota in the Xfyun console.
- Browser microphone or screen audio permission is granted.
- For meeting audio, audio sharing was enabled in the screen-share dialog.
- Try `Microphone` mode first to isolate ASR configuration from meeting-audio capture.

### Meeting audio is silent

Try:

- Join the meeting from a browser tab, then share that tab with audio.
- Use Chrome or Edge.
- Verify system audio is not muted.
- Switch from `Meeting audio` to `Microphone` to verify ASR still works.

### Bottom toolbar jumps or resizes

This fork fixes the toolbar height and truncates long status text. If it still jumps, hard refresh the browser after rebuilding:

```text
Ctrl + F5
```

## Security Notes

- Do not commit real DeepSeek or Xfyun keys.
- Rotate keys if they were ever pasted into public logs or commits.
- The backend AI proxy currently accepts API keys from the frontend request body. This is convenient for local use, but for production deployment you should move provider keys to backend environment variables and enforce user-level authorization.
- Change `SECRET_KEY` before any production deployment.

## Repository

```text
https://github.com/mengqixi/interview-helper
```

## License

This project follows the license of the upstream project unless changed by the repository owner.
