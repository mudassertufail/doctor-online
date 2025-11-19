# Doctor Online 24/7

AI-powered medical triage platform providing instant consultation via text chat or voice call.

## Features

- **Text Chat**: Real-time streaming chat with AI doctor powered by Llama
- **Voice Call**: Browser-based voice consultation with speech-to-text and text-to-speech
- **Session Management**: Persistent conversation history for each patient
- **Smart Triage**: AI provides symptom analysis, precautions, diet advice, and specialist referrals
- **Configurable Timeouts**: Auto-disconnect on inactivity or max duration

## Tech Stack

### Backend

- Node.js + TypeScript + Express
- Ollama (local Llama LLM)
- AssemblyAI (Speech-to-Text)
- AWS Polly (Text-to-Speech)
- WebSocket for real-time communication

### Frontend

- React + TypeScript
- Material-UI
- React Router
- WebRTC for voice calls

## Setup

### Prerequisites

- Node.js v18+
- Ollama installed and running locally
- AssemblyAI API key
- AWS credentials (for Polly TTS)

### Backend Setup

1. Navigate to backend directory:

```bash
cd backend
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env` file from example:

```bash
cp env.example .env
```

4. Configure environment variables in `.env`:

```env
PORT=4000
OLLAMA_MODEL=llama3.1
OLLAMA_HOST=http://127.0.0.1:11434

# Voice Call Configuration
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
AWS_POLLY_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
AWS_POLLY_VOICE_ID=Joanna

# Call Timeouts (milliseconds)
CALL_INACTIVITY_TIMEOUT_MS=60000
CALL_MAX_DURATION_MS=300000
```

5. Start Ollama and pull the model:

```bash
ollama serve
ollama pull llama3.1
```

6. Build and run backend:

```bash
npm run build
npm run dev
```

### Frontend Setup

1. Navigate to frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. (Optional) Create `.env` file from example:

```bash
cp env.example .env
```

Edit `.env` if you need to change the backend URL (defaults to `http://localhost:4000`).

4. Start development server:

```bash
npm run dev
```

5. Open browser at `http://localhost:5173`

## Usage

### Text Chat

1. Enter your name and email on the landing page
2. Select "Chat" mode
3. Click "Start session"
4. Type your symptoms and press Enter or click Send
5. AI doctor will respond with analysis and recommendations

### Voice Call

1. Enter your name and email on the landing page
2. Select "Call" mode
3. Click "Start session"
4. Allow microphone access when prompted
5. Speak your symptoms clearly
6. AI doctor will respond via voice
7. Live transcript appears on screen
8. Click "End Call" when done

## Project Structure

```
DoctorOnline/
├── backend/
│   ├── src/
│   │   ├── config.ts              # Environment configuration
│   │   ├── constants.ts           # System prompts and disclaimers
│   │   ├── index.ts               # Express server + WebSocket setup
│   │   ├── types.ts               # TypeScript interfaces
│   │   ├── routes/
│   │   │   ├── sessionRoutes.ts   # Session management endpoints
│   │   │   ├── chatRoutes.ts      # Chat streaming endpoints
│   │   │   └── callRoutes.ts      # Voice call endpoints
│   │   ├── services/
│   │   │   ├── chatService.ts     # Chat + Llama integration
│   │   │   ├── voiceCallService.ts # Voice call orchestration
│   │   │   ├── stt/
│   │   │   │   ├── STTProvider.ts          # STT interface
│   │   │   │   └── AssemblyAIProvider.ts   # AssemblyAI implementation
│   │   │   ├── tts/
│   │   │   │   ├── TTSProvider.ts          # TTS interface
│   │   │   │   └── AWSPollyProvider.ts     # AWS Polly implementation
│   │   │   └── webrtc/
│   │   │       ├── SignalingServer.ts      # WebRTC signaling
│   │   │       └── CallWebSocketHandler.ts # Voice call WebSocket
│   │   └── store/
│   │       └── sessionStore.ts    # In-memory session storage
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Main app + routing
│   │   ├── context/
│   │   │   └── SessionContext.tsx # Session state management
│   │   ├── hooks/
│   │   │   └── useVoiceCall.ts    # Voice call WebRTC hook
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx    # Name/email + mode selection
│   │   │   ├── ChatPage.tsx       # Text chat interface
│   │   │   └── VoiceCallPage.tsx  # Voice call interface
│   │   └── types/
│   │       └── chat.ts            # TypeScript types
│   └── package.json
└── README.md
```

## API Endpoints

### Session Management

- `POST /api/session` - Create new session
- `GET /api/session/:id` - Get session details

### Chat

- `POST /api/chat` - Send message (Server-Sent Events response)

### Voice Call

- `POST /api/call/start` - Initialize voice call
- `POST /api/call/end` - End voice call
- `GET /api/call/status/:sessionId` - Check call status
- `WS /api/call/ws` - WebSocket for audio streaming

## Configuration

### Swapping STT/TTS Providers

The system uses interfaces for STT and TTS, making it easy to swap providers:

**To replace AssemblyAI:**

1. Create new class implementing `STTProvider` interface in `backend/src/services/stt/`
2. Update `voiceCallService.ts` to instantiate your provider

**To replace AWS Polly:**

1. Create new class implementing `TTSProvider` interface in `backend/src/services/tts/`
2. Update `voiceCallService.ts` to instantiate your provider

### Timeout Configuration

Edit `.env` to adjust call timeouts:

- `CALL_INACTIVITY_TIMEOUT_MS` - Auto-disconnect after silence (default: 60s)
- `CALL_MAX_DURATION_MS` - Maximum call length (default: 5min)

## Troubleshooting

### Voice call not connecting

- Ensure microphone permissions are granted
- Check browser console for WebSocket errors
- Verify AssemblyAI API key is valid
- Confirm AWS credentials have Polly access

### Chat not streaming

- Verify Ollama is running (`ollama serve`)
- Check model is pulled (`ollama list`)
- Ensure backend is running on correct port

### Build errors

- Run `npm install` in both backend and frontend
- Check Node.js version (v18+ required)
- Clear `node_modules` and reinstall if needed

## License

ISC

## Author

Mudasser Tufail
