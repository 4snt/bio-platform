export interface ChartOption {
  key: string
  label: string
}

export interface AnalysisDefinition {
  key: string
  label: string
  description: string
  charts: ChartOption[]
}

const SHARED: AnalysisDefinition[] = [
  {
    key: "spieceasi",
    label: "SpiecEasi",
    description: "Rede microbiana (co-ocorrência)",
    charts: [
      { key: "network", label: "Rede Interativa" },
    ],
  },
  {
    key: "random_forest",
    label: "Random Forest",
    description: "Classificação e importância de features",
    charts: [
      { key: "importance_bar", label: "Feature Importance" },
    ],
  },
  {
    key: "gsea",
    label: "GSEA / clusterProfiler",
    description: "Enriquecimento de vias metabólicas",
    charts: [
      { key: "bubble", label: "Bubble Plot" },
      { key: "dot_plot", label: "Dot Plot" },
    ],
  },
]

export const ANALYSES_CATALOG: Record<'16S' | 'ITS', AnalysisDefinition[]> = {
  "16S": [
    {
      key: "deseq2",
      label: "DESeq2",
      description: "Expressão diferencial de genes / ASVs",
      charts: [
        { key: "volcano", label: "Volcano Plot" },
        { key: "ma_plot", label: "MA Plot" },
        { key: "heatmap", label: "Heatmap" },
      ],
    },
    {
      key: "maaslin2",
      label: "MaAsLin2",
      description: "Série temporal / regressão multivariada",
      charts: [
        { key: "scatter", label: "Scatter Plot" },
        { key: "coef_plot", label: "Coefficient Plot" },
      ],
    },
    {
      key: "picrust2",
      label: "PICRUSt2",
      description: "Predição funcional baseada em 16S",
      charts: [
        { key: "functional_bar", label: "Functional Bar Chart" },
        { key: "pcoa", label: "PCoA Funcional" },
      ],
    },
    ...SHARED,
  ],
  "ITS": [
    {
      key: "ancombc2",
      label: "ANCOM-BC2",
      description: "Análise fatorial de composição microbiana",
      charts: [
        { key: "bar_chart", label: "Bar Chart" },
        { key: "lollipop", label: "Lollipop Chart" },
      ],
    },
    {
      key: "funguild",
      label: "FUNGuild",
      description: "Anotação funcional de fungos",
      charts: [
        { key: "donut", label: "Donut Chart" },
        { key: "bar_chart", label: "Bar Chart Funcional" },
      ],
    },
    ...SHARED,
  ],
}
