FROM python:3.11-slim
ARG WITH_ML=0
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY requirements.txt requirements-ml.txt ./
RUN pip install --no-cache-dir -r requirements.txt && if [ "$WITH_ML" = "1" ]; then pip install --no-cache-dir -r requirements-ml.txt; fi
COPY . .
