FROM python:3.11-slim

WORKDIR /app

# Install uv for fast dependency management
RUN pip install uv

# Copy dependency files
COPY pyproject.toml .
COPY src ./src

# Install dependencies
RUN uv pip install --system -e .

# Run the worker
CMD ["python", "-m", "mitt_worker"]
