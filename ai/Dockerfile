FROM python:3.10-slim

WORKDIR /app

# Upgrade pip and install build dependencies if needed
# Although slim variants provide many pre-built wheels, 
# gcc is sometimes rarely needed. But usually pure scipy/numpy 
# from pip have windows/linux x86_64 prebuilt wheels.
# RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install packages system-wide in container, avoid cache to reduce size
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY main.py .

# Run the AI script as a background worker
CMD ["python", "-u", "main.py"]
