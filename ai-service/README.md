# Layer 3 — Python AI Diagnostic Inference Service

FastAPI Python microservice powered by Groq LLM (with deterministic offline fallback) that transforms telemetry evidence into structured engineering assessments.

---

## Overview
- **Engineering Assessment**: Synthesizes page-level runtime behavior into a high-level technical assessment.
- **Root Cause Interpretation**: Explains plausible underlying triggers for observed errors, broken promises, or degraded performance.
- **Likely Impact & Next Steps**: Details the potential impact on user experience and specifies concrete remediation steps for developers.
- **Provider Abstraction**: Supports Groq LLM (`openai/gpt-oss-20b` or custom models) with automatic offline deterministic fallback if no API key is provided.

---

## Setup & Execution

### Setup Environment
```powershell
# 1. Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt
```

### Configuration (`.env`)
Create a `.env` file in `ai-service/`:
```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key_here
LLM_MODEL=openai/gpt-oss-20b
PORT=8001
```

### Start the Service
```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

### Run Tests
```powershell
pytest -v
```
