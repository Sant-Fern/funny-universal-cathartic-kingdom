FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt && useradd --create-home --uid 10001 pogo
COPY server /app/server
COPY shared /app/shared
COPY gateway /app/gateway
USER pogo
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "gateway.app:app", "--host", "0.0.0.0", "--port", "8000", "--ws-max-size", "2048", "--no-access-log", "--log-level", "warning"]
