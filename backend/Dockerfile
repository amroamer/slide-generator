FROM python:3.12-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    # LibreOffice for PPTX to PDF conversion (slide thumbnails)
    libreoffice-impress \
    libreoffice-common \
    # PDF to PNG conversion
    poppler-utils \
    # Fonts for proper slide rendering
    fonts-liberation \
    fonts-liberation2 \
    fonts-dejavu-core \
    fonts-noto-core \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    fontconfig \
    # WeasyPrint dependencies
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS production

COPY . .

RUN mkdir -p /app/uploads /app/outputs

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--timeout-keep-alive", "300"]
