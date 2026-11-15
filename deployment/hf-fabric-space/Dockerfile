FROM python:3.10-slim

WORKDIR /app

# Install minimal system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server and config
COPY . .

# Setup persistent cache directory
RUN mkdir -p /app/data && chmod -R 777 /app/data

EXPOSE 7860

CMD ["python", "server.py"]
