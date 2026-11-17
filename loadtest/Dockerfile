FROM python:3.14-slim
WORKDIR /app
COPY loadtest/requirements.txt loadtest/requirements.txt
RUN pip install --no-cache-dir -r loadtest/requirements.txt
COPY loadtest loadtest
ENV PYTHONUNBUFFERED=1 AWS_DEFAULT_REGION=us-east-2
CMD ["python", "loadtest/runner.py", "--help"]
