# ----------------------------------------------------
# NY Sun Works — Partner School Success Dashboard
# Production Multi-Language Container (Node.js + Python)
# ----------------------------------------------------
FROM node:20-slim

# Install Python 3, venv, and pip
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set up isolated Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Copy dependency files first for layer caching
COPY package*.json ./
COPY requirements.txt ./

# Install Node dependencies and Python Excel ingestion libraries
RUN npm install
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application source code, scripts, and Excel data
COPY . .

# Run data ingestion pipeline and compile production Vite bundle
RUN python scripts/ingest_real_data.py && npm run build

# Expose default HTTP port
ENV PORT=3000
EXPOSE 3000

# Start production web server
CMD ["node", "server.js"]
