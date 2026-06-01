# bioconductor_docker já inclui R 4.4 + DESeq2 + phyloseq + edgeR + limma pré-compilados
FROM bioconductor/bioconductor_docker:RELEASE_3_19

# Dependências de sistema para RPostgres e aws.s3
RUN apt-get update && apt-get install -y \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Pacotes CRAN que não vêm na imagem base
RUN Rscript -e "install.packages(c('RPostgres','DBI','jsonlite','aws.s3','elastic','randomForest'), repos='https://cloud.r-project.org', quiet=TRUE)"

# Pacotes Bioconductor adicionais (os core já estão no base image)
RUN Rscript -e "BiocManager::install(c('ANCOMBC','MaAsLin2','clusterProfiler','SpiecEasi'), ask=FALSE, update=FALSE)"

WORKDIR /worker
COPY . .

CMD ["Rscript", "worker.R"]
