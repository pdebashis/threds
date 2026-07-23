  ### 1. Overall Project Concept

  Threds is an anonymous imageboard / discussion platform (inspired by traditional message boards like 4chan).

  • Categorized Boards: Users can view and participate in topic-based boards (e.g., Work /w, Random /r, Travel /t).
  • Thread & Post Creation: Users can create new discussion threads with a subject, text content, and optional attached images.
  • Replies & Interaction: Within a thread, users can submit post replies, reference specific existing posts (replyToId), and share images.
  • Anonymity: User posts default to anonymous authoring.
  ──────
  ### 2. High-Level System Architecture

  The project is structured as a decoupled Client-Server Architecture split into two main repositories:

    threds/
    ├── threds-api/   # Ruby on Rails REST API (Backend)
    └── threds-ui/    # React + TypeScript + Vite SPA (Frontend)

    graph TD
        Client["React Frontend (threds-ui)"] <-->|JSON REST API| Server["Ruby on Rails Backend (threds-api)"]
        Server <-->|ActiveRecord| DB[("Database (SQLite3 / PostgreSQL)")]
        Server <-->|Media Storage| Cloudinary["Cloudinary CDN"]
    ──────
  ### 3. Frontend Architecture (package.json)

      into frontend camelCase).
  • Tech Stack: Built using React 19, TypeScript, and Vite.
  • Key Components & Services:
      • App.tsx: Manages board state, thread views, navigation, and modal forms for posting/replying.
      • api.ts: Service layer that communicates with the backend. Handles client-server data mapping (converting backend snake_case payloads
      • types.ts: Data contracts defining types.ts, types.ts, and types.ts.

  ──────
  ### 4. Backend Architecture (Gemfile)

  • Tech Stack: Built with Ruby on Rails 7 (API mode) running on Ruby 3.2.
  • Database:
      • Development/Testing: SQLite3
      • Production: PostgreSQL (pg gem)
      • Schema (schema.rb):
          • threds: Stores board_type, subject, and root metadata.
          • posts: Stores post content, author, image_url, parent thred_id, and reply_to_id.

  • API Endpoints & Controllers (routes.rb):
      • threds_controller.rb: Listing (GET /boards/:board_type/threds) and creating threads (POST /boards/:board_type/threds).
      • posts_controller.rb: Appending replies (POST /threds/:id/posts).
      • uploads_controller.rb: Handling media uploads via Cloudinary.
  • Infrastructure & Security:
      • Media CDN: Integrated with Cloudinary for image hosting.
      • Rate Limiting & CORS: Configured with rack-attack and rack-cors.
      • Deployment: Dockerized (Dockerfile) and configured for hosting platforms like Render.

## Run locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Deploy

1. git push to branch.
2. Render auto detects new commit and redeploys.

# Rails Server

Local

rails s : Runs backend on 3000 port




