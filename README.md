# ApexA2A

This is a monorepo containing a Next.js frontend and a FastAPI backend.

## Prerequisites

- Node.js (v18+ recommended)
- Python 3.11+ (Python 3.13 was used for this setup)

## Frontend Setup

The frontend is built with Next.js 14, TypeScript, and Tailwind CSS.

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at [http://localhost:3000](http://localhost:3000).

## Backend Setup

The backend is built with FastAPI and uses Pydantic v2.

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment (Windows):
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   ```
   (On macOS/Linux, use `source venv/bin/activate`)
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the backend development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The backend will be available at [http://localhost:8000](http://localhost:8000). You can test the health endpoint at [http://localhost:8000/health](http://localhost:8000/health).
