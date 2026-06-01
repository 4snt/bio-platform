FROM rocker/r-ver:4.4.0

RUN apt-get update && apt-get install -y \
    libpq-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

RUN Rscript -e "install.packages(c('RPostgres', 'DBI', 'jsonlite', 'aws.s3', 'elastic', 'randomForest'), repos='https://cloud.r-project.org')"
RUN Rscript -e "if (!requireNamespace('BiocManager', quietly=TRUE)) install.packages('BiocManager')"
RUN Rscript -e "BiocManager::install(c('DESeq2', 'phyloseq', 'ANCOMBC', 'MaAsLin2', 'clusterProfiler'), ask=FALSE)"

WORKDIR /worker
COPY . .

CMD ["Rscript", "worker.R"]
