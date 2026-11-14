FROM python:3.11-slim

WORKDIR /app

RUN adduser --disabled-password --gecos "" appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

USER appuser

CMD ["python", "data_ingestor.py"]
