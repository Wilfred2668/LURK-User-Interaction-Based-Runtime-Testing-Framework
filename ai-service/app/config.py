"""Service configuration for AI Service with environment variable support."""

import os
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

APP_NAME: str = os.getenv("APP_NAME", "Runtime Monitoring AI Service")
APP_VERSION: str = "3C.1"
ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

# LLM Provider Configuration
# "none" = deterministic 3B fallback, "groq" = Groq API
LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "none").lower()
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
LLM_MODEL: str = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")
LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://api.groq.com")
LLM_TIMEOUT_SECONDS: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "30.0"))
