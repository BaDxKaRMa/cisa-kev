# syntax=docker/dockerfile:1
FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --upgrade pip && pip install --no-cache-dir flask gunicorn requests

COPY . .



EXPOSE 8080

CMD ["python", "-m", "app"]
