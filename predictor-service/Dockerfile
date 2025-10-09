FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Рантайм залежності для numpy/pandas/sklearn/matplotlib
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopenblas0-pthread liblapack3 libgomp1 \
    libfreetype6 libpng16-16 fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

COPY predictor.py .

# каталог для збереження артефактів (монтується томом)
VOLUME ["/models"]

ENV MONGODB_URI=mongodb://mongo:27017/fleetms \
    MONGO_DB=fleetms \
    AMQP_URL=amqp://user:password@rabbitmq \
    AMQP_QUEUE="predict.trip" \
    MODELS_DIR=/models

CMD ["python", "predictor.py"]
