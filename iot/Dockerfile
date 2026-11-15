FROM python:3.11-slim

WORKDIR /app

COPY iot/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY iot/ ./iot/
COPY data/ ./data/

RUN adduser --disabled-password --gecos "" appuser
RUN chown -R appuser:appuser /app

USER appuser
WORKDIR /app/iot

CMD ["python", "data_ingestor.py"]
