# ChatApp

The frontend is plain HTML, CSS, Bootstrap 5, and JavaScript modules. It does not use React, Angular, or TypeScript.

## Frontend structure

```text
chatapp-frontend/
├── index.html
└── src/
    ├── main.js                 # Vite entry point
    ├── style.css               # ChatApp theme and responsive layout
    ├── js/
    │   └── app.js              # Views, form handling, navigation, chat state
    ├── api/
    │   ├── http.js             # REST requests and JWT handling
    │   └── chatApi.js           # Auth, user, conversation, and message APIs
    └── websocket/
        └── stompClient.js       # Native WebSocket STOMP client and reconnect
```

## Run locally

Start PostgreSQL and the Spring Boot backend first. From this folder, run:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. Create an optimized frontend build with:

```powershell
npm run build
```

## Real-time chat

The backend exposes a native STOMP WebSocket at `ws://localhost:8080/ws` (no SockJS). The frontend sends the JWT in the STOMP `CONNECT` Authorization header, publishes messages to `/app/chat.send`, and subscribes to `/topic/conversation/{conversationId}`. WebSocket messages are persisted by the backend before broadcasting. The frontend loads REST history and deduplicates messages by server message ID.

The backend inbound interceptor authenticates STOMP connections, restricts client sends to `/app/chat.send`, and allows a conversation topic subscription only if the authenticated user belongs to that conversation.

## Test with two users

1. Register two users with distinct mobile numbers and Gmail addresses. For local OTP verification, read each OTP from the Spring Boot console.
2. Sign in as user A in one browser profile and user B in a separate profile or private window.
3. In both profiles, open a chat with the other user's mobile number.
4. Send a message from either profile. It should appear in both active chats without refreshing and remain in chat history after reopening.
5. The backend rejects a subscription if the authenticated user is not a participant in that conversation.
