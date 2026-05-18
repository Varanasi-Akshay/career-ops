# Story Bank — Master STAR+R Stories

This file accumulates your best interview stories over time. Each evaluation (Block F) adds new stories here. Instead of memorizing 100 answers, maintain 5-10 deep stories that you can bend to answer almost any behavioral question.

## How it works

1. Every time `/career-ops oferta` generates Block F (Interview Plan), new STAR+R stories get appended here
2. Before your next interview, review this file — your stories are already organized by theme
3. The "Big Three" questions can be answered with stories from this bank:
   - "Tell me about yourself" → combine 2-3 stories into a narrative
   - "Tell me about your most impactful project" → pick your highest-impact story
   - "Tell me about a conflict you resolved" → find a story with a Reflection

## Stories

<!-- Stories will be added here as you evaluate offers -->
<!-- Format:
### [Theme] Story Title
**Source:** Report #NNN — Company — Role
**S (Situation):** ...
**T (Task):** ...
**A (Action):** ...
**R (Result):** ...
**Reflection:** What I learned / what I'd do differently
**Best for questions about:** [list of question types this story answers]
-->

### [Healthcare ML] Oncology Time-to-Next-Treatment Modeling
**Source:** Report #001 - Upperline Health - Machine Learning Engineer
**S (Situation):** An Omdena healthcare project needed data-driven insight into immunotherapy-based oncology patient treatment timing.
**T (Task):** Estimate time-to-next-treatment using patient demographics, diagnosis, and prior prescription history.
**A (Action):** Engineered patient-level features, experimented with survival-analysis models, and evaluated DeepSurv.
**R (Result):** Achieved best model performance with DeepSurv at c-index 0.715 and supported patient sentiment analysis using Tableau.
**Reflection:** Healthcare ML requires careful feature definitions, explicit assumptions, and humility around clinical context.
**Best for questions about:** healthcare data, feature engineering, learning a new domain, model evaluation.

### [Production ML] PriceEasy Product Recognition Pipeline
**Source:** Report #001 - Upperline Health - Machine Learning Engineer
**S (Situation):** PriceEasy needed in-store product recognition to support survey automation and retail analytics.
**T (Task):** Prototype, benchmark, and productionize a computer-vision model suitable for low-latency mobile inference.
**A (Action):** Benchmarked OpenAI CLIP and multiple deep-learning architectures, then deployed an EfficientNet-based classifier.
**R (Result):** Achieved 0.92 accuracy and integrated the model into an end-to-end survey automation pipeline.
**Reflection:** Strong ML engineering means choosing the model that fits the operational constraint, not just the most impressive benchmark.
**Best for questions about:** ML deployment, productionization, computer vision, model trade-offs.
