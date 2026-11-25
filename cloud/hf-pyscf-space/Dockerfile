# ============================================================================
# RPrime True-DFT & AutoDock Vina 1.2 — Hugging Face Spaces Docker Image
# Target: Sanctioned Free Tier (2 vCPU / 16 GB RAM, Non-Root UID 1000, Port 7860)
# ============================================================================
FROM mambaorg/micromamba:1.5.8-bookworm-slim

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Ensure Hugging Face Spaces standard UID 1000 user exists cleanly
RUN id -u 1000 >/dev/null 2>&1 || useradd -m -u 1000 -s /bin/bash user

USER $MAMBA_USER

# Install Python 3.11 + GFN2-xTB binary + AutoDock Vina CLI/bindings from conda-forge
RUN micromamba install -y -n base -c conda-forge \
    python=3.11 \
    pip \
    xtb=6.7.1 \
    autodock-vina=1.2.5 \
    openbabel \
    && micromamba clean --all --yes

ENV PATH="/opt/conda/bin:${PATH}" \
    PYTHONUNBUFFERED="1" \
    PYTHONDONTWRITEBYTECODE="1" \
    OMP_NUM_THREADS="2" \
    OPENBLAS_NUM_THREADS="2" \
    MKL_NUM_THREADS="2" \
    VECLIB_MAXIMUM_THREADS="2" \
    NUMEXPR_NUM_THREADS="2" \
    PYSCF_MAX_MEMORY="6000" \
    RPRIME_CACHE_DIR="/tmp/rprime_cache"

WORKDIR /tmp/build
COPY --chown=$MAMBA_USER:$MAMBA_USER requirements.txt /tmp/build/requirements.txt
RUN /opt/conda/bin/pip install --no-cache-dir --upgrade pip && \
    /opt/conda/bin/pip install --no-cache-dir -r /tmp/build/requirements.txt

USER root
RUN mkdir -p /app /tmp/rprime_cache && chown -R 1000:1000 /app /tmp/rprime_cache
USER 1000

WORKDIR /app
COPY --chown=1000:1000 quantum_engine.py docking_engine.py app.py /app/

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=8s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:7860/health || exit 1

CMD ["/opt/conda/bin/uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
