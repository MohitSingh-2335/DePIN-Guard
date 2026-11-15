FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies FIRST
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code, ai-service models, and datasets
COPY backend/ ./backend/
COPY ai-service/ ./ai-service/
COPY data/ ./data/

# Create non-root user for security
RUN adduser --disabled-password --gecos "" appuser
RUN chown -R appuser:appuser /app

USER appuser
WORKDIR /app/backend

EXPOSE 8000

# Health check - verify API is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Start FastAPI with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
