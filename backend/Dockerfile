FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Ensure the initial alimentos.xlsx exists
COPY alimentos.xlsx .

CMD ["gunicorn", "--workers", "4", "--bind", "0.0.0.0:8050", "--worker-class", "uvicorn.workers.UvicornWorker", "server:app"]
