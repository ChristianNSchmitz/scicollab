/**
 * The demo crowd: 38 more invented researchers around the twelve written
 * personas, so the local demo feels like a community with fifty members.
 * Local demo only (personaTables); scripts/seed-personas.mjs does not load it.
 *
 * Everything is generated from a fixed seed, so it is the same on every
 * start: profiles, topic groups, who follows whom, posts (many with a
 * figure, figures.ts), replies and reactions, job offers and funding calls,
 * a few events, and stories from the last day. Every name ends in ".ex",
 * every institution is invented, and the figures say "example data".
 */
import { rng, barChart, doseResponse, westernBlot, micrograph, timeSeries, scatter, benchScene, posterScene } from "./figures";

type Row = Record<string, any>;
type Field = "cell" | "neuro" | "psych" | "chem" | "comp" | "eco" | "materials" | "clinical";

/** id, name, institution, city, role, field, techniques, topic groups, avatar icon, bio */
const PEOPLE: [string, string, string, string, string, Field, string[], string[], string, string][] = [
  ["c-amara", "Amara Nwosu", "Lagos-Leiden Institute for Cell Science (example)", "Leiden", "Postdoctoral researcher", "cell", ["CRISPR", "flow cytometry", "lentivirus"], ["crispr", "cell-culture", "introductions"], "dna", "CRISPR screens in primary T cells. I post my failed guides too."],
  ["c-henrik", "Henrik Aalto", "Baltic Centre for Neurobiology (example)", "Turku", "Group leader", "neuro", ["patch clamp", "two-photon imaging"], ["electrophysiology", "microscopy", "grants-careers"], "brain", "Cortical circuits, slices and awake mice. Always happy to talk rigs."],
  ["c-sofia", "Sofia Marchetti", "Istituto Lombardo di Biochimica (example)", "Milan", "PhD student", "chem", ["LC-MS/MS", "proteomics"], ["mass-spec", "introductions", "negative-results"], "flask", "Third-year PhD, proteomics of the aging liver. Learning to love missing values."],
  ["c-kwame", "Kwame Mensah", "Volta Computational Biology Hub (example)", "Accra", "Data scientist", "comp", ["Python", "single-cell RNA-seq", "Snakemake"], ["stats-and-code", "rna-seq", "reproducibility"], "chart", "Pipelines that still run next year. Single-cell, mostly."],
  ["c-lea", "Léa Dubois", "Institut Rhodanien de Neurosciences (example)", "Grenoble", "Postdoctoral researcher", "neuro", ["iPSC culture", "MEA recordings"], ["cell-culture", "electrophysiology", "transfection"], "cell", "Human iPSC neurons on multi-electrode arrays."],
  ["c-tomas", "Tomás Herrera", "Universidad del Pacífico Sur (example)", "Valparaíso", "Associate professor", "eco", ["field sampling", "eDNA", "R"], ["field-sampling", "stats-and-code", "grants-careers"], "leaf", "Kelp forests and the eDNA they shed."],
  ["c-yuki", "Yuki Tanabe", "Kansai Institute for Structural Biology (example)", "Osaka", "Research scientist", "chem", ["cryo-EM", "protein purification"], ["spectroscopy", "instruments", "reproducibility"], "atom", "Membrane proteins in nanodiscs, and the grids that refuse to behave."],
  ["c-ines", "Inês Carvalho", "Centro de Psiquiatria Translacional (example)", "Porto", "Clinician scientist", "psych", ["fMRI", "clinical trials", "R"], ["stats-and-code", "reproducibility", "introductions"], "brain", "Psychiatrist. Resting-state fMRI in depression, pre-registered when I can."],
  ["c-daniel", "Daniel Okonkwo", "Thames Valley Institute of Psychiatry (example)", "Reading", "PhD student", "psych", ["EEG", "computational modelling"], ["stats-and-code", "introductions", "electrophysiology"], "brain", "Reinforcement learning models of anhedonia. EEG on Thursdays."],
  ["c-mira", "Mira Petrović", "Danube Institute for Molecular Medicine (example)", "Novi Sad", "Postdoctoral researcher", "cell", ["western blot", "co-IP", "lysosomal assays"], ["western-blot", "cell-culture", "negative-results"], "cell", "Lysosomes, autophagy and too many blots."],
  ["c-aarav", "Aarav Shah", "Deccan Centre for Chemical Biology (example)", "Pune", "Group leader", "chem", ["medicinal chemistry", "SPR", "dose-response assays"], ["mass-spec", "grants-careers", "reproducibility"], "flask", "Small molecules for lysosomal storage disorders. Hiring."],
  ["c-elin", "Elin Berg", "Norrland Materials Lab (example)", "Umeå", "Research engineer", "materials", ["XRD", "SEM", "EIS"], ["instruments", "spectroscopy", "introductions"], "atom", "I keep the diffractometer alive and the users happy."],
  ["c-pablo", "Pablo Esteban", "Instituto Aragonés de Biomedicina (example)", "Zaragoza", "Technician", "cell", ["cell culture", "mycoplasma testing", "flow cytometry"], ["cell-culture", "transfection", "western-blot"], "flask", "Core facility technician. Ask me about mycoplasma before you ask anyone else."],
  ["c-noor", "Noor Haddad", "Levant Institute of Neurogenetics (example)", "Beirut", "PhD student", "neuro", ["zebrafish", "CRISPR", "behaviour tracking"], ["crispr", "microscopy", "introductions"], "dna", "Zebrafish knockouts and the tracking code to go with them."],
  ["c-felix", "Felix Brandt", "Rhein-Main Zentrum für Psychiatrie (example)", "Frankfurt", "Clinician scientist", "psych", ["clinical trials", "psychopharmacology", "MRI"], ["reproducibility", "grants-careers", "stats-and-code"], "brain", "Psychiatrist running trials in treatment-resistant depression."],
  ["c-zara", "Zara Ahmed", "Pennine Institute for Data Science (example)", "Leeds", "Research software engineer", "comp", ["R", "Bayesian statistics", "Quarto"], ["stats-and-code", "reproducibility", "negative-results"], "chart", "Mixed models, priors and reproducible reports."],
  ["c-lucas", "Lucas Ferreira", "Instituto Paulista de Biologia Celular (example)", "Campinas", "Postdoctoral researcher", "cell", ["transfection", "live-cell imaging", "qPCR"], ["transfection", "microscopy", "cell-culture"], "cell", "Live imaging of transfected cells, and the phototoxicity that comes with it."],
  ["c-hana", "Hana Novak", "Moravian Institute of Plant Science (example)", "Brno", "PhD student", "eco", ["confocal microscopy", "qPCR"], ["microscopy", "introductions", "rna-seq"], "leaf", "Roots, auxin and a confocal that I share with eleven people."],
  ["c-omar", "Omar Haidari", "Caspian Institute for Systems Biology (example)", "Baku", "Group leader", "comp", ["mass spectrometry", "network analysis"], ["mass-spec", "stats-and-code", "grants-careers"], "chart", "Phosphoproteomics and the networks you can and cannot infer from it."],
  ["c-greta", "Greta Lindholm", "Gotland Marine Station (example)", "Visby", "Research scientist", "eco", ["eDNA", "field sampling", "metabarcoding"], ["field-sampling", "rna-seq", "reproducibility"], "leaf", "Baltic plankton, one bottle at a time."],
  ["c-wei", "Wei Zhang", "Pearl River Institute of Neuroscience (example)", "Guangzhou", "Postdoctoral researcher", "neuro", ["two-photon imaging", "optogenetics"], ["microscopy", "electrophysiology", "negative-results"], "brain", "Two-photon imaging of hippocampal place cells."],
  ["c-chiara", "Chiara Russo", "Istituto Tirrenico di Farmacologia (example)", "Pisa", "Associate professor", "clinical", ["pharmacokinetics", "LC-MS/MS"], ["mass-spec", "reproducibility", "grants-careers"], "flask", "Clinical pharmacology. Plasma levels or it did not happen."],
  ["c-jakob", "Jakob Weiss", "Alpine Institute for Biophysics (example)", "Innsbruck", "PhD student", "materials", ["AFM", "optical tweezers"], ["instruments", "spectroscopy", "introductions"], "atom", "Single-molecule force spectroscopy. Building my own tweezers."],
  ["c-anika", "Anika Roy", "Bengal Institute of Immunology (example)", "Kolkata", "Postdoctoral researcher", "cell", ["flow cytometry", "ELISA", "CRISPR"], ["crispr", "western-blot", "cell-culture"], "dna", "Macrophage polarisation; spectral flow when the cytometer is free."],
  ["c-matteo", "Matteo Conti", "Centro Adriatico di Neuroimaging (example)", "Trieste", "Research scientist", "psych", ["fMRI", "fMRIPrep", "Python"], ["stats-and-code", "reproducibility", "electrophysiology"], "chart", "Neuroimaging pipelines. Head motion is the enemy."],
  ["c-olga", "Olga Sokolova", "Ural Institute of Chemistry (example)", "Yekaterinburg", "Group leader", "chem", ["NMR", "organic synthesis"], ["spectroscopy", "grants-careers", "negative-results"], "flask", "Synthesis and NMR. We publish the reactions that did not work."],
  ["c-ben", "Ben Achterberg", "Zuiderzee Institute for Ecology (example)", "Amsterdam", "PhD student", "eco", ["camera traps", "occupancy models", "R"], ["field-sampling", "stats-and-code", "introductions"], "leaf", "Camera traps in the dunes, occupancy models on the laptop."],
  ["c-priyanka", "Priyanka Iyer", "Western Ghats Neuroscience Centre (example)", "Bengaluru", "Group leader", "neuro", ["iPSC culture", "CRISPR", "calcium imaging"], ["cell-culture", "crispr", "grants-careers"], "brain", "Autism risk genes in human neurons. Two open PhD positions."],
  ["c-sam", "Sam Whitfield", "Cairngorm Clinical Research Unit (example)", "Aberdeen", "Trial manager", "clinical", ["clinical trials", "REDCap", "GCP"], ["reproducibility", "grants-careers", "introductions"], "chart", "I make trials run on time. Mostly."],
  ["c-leila", "Leila Moradi", "Zagros Institute for Pharmacology (example)", "Shiraz", "PhD student", "clinical", ["cell viability assays", "dose-response assays"], ["negative-results", "cell-culture", "stats-and-code"], "flask", "Drug combinations in glioma lines. Synergy is harder than it looks."],
  ["c-erik", "Erik Johansson", "Göta Älv Battery Lab (example)", "Gothenburg", "Postdoctoral researcher", "materials", ["EIS", "XRD", "glovebox"], ["instruments", "spectroscopy", "negative-results"], "atom", "Solid electrolytes, impedance and humidity logs."],
  ["c-fatima", "Fatima Diallo", "Sahel Institute of Public Health (example)", "Dakar", "Epidemiologist", "clinical", ["epidemiology", "R", "survey design"], ["stats-and-code", "reproducibility", "grants-careers"], "chart", "Cohort studies and the missing data that come with them."],
  ["c-nikolai", "Nikolai Petrov", "Neva Institute of Neurophysiology (example)", "St Petersburg", "Senior researcher", "neuro", ["patch clamp", "slice electrophysiology"], ["electrophysiology", "negative-results", "instruments"], "brain", "Thirty years of patch clamp and still learning."],
  ["c-julia", "Julia Kowalska", "Vistula Institute of Biochemistry (example)", "Kraków", "Postdoctoral researcher", "cell", ["protein purification", "western blot", "SPR"], ["western-blot", "mass-spec", "introductions"], "cell", "Kinases, purified and misbehaving."],
  ["c-raul", "Raúl Domínguez", "Instituto Andaluz de Salud Mental (example)", "Seville", "PhD student", "psych", ["ecological momentary assessment", "R"], ["stats-and-code", "introductions", "reproducibility"], "brain", "Phone surveys five times a day: mood in daily life."],
  ["c-astrid", "Astrid Holm", "Jutland Institute of Microbiology (example)", "Aarhus", "Research scientist", "eco", ["16S sequencing", "anaerobic culture"], ["rna-seq", "field-sampling", "cell-culture"], "leaf", "Soil microbes and the anaerobic chamber that never seals."],
  ["c-tobias", "Tobias Keller", "Bodensee Centre for Imaging (example)", "Konstanz", "Core facility manager", "materials", ["light-sheet microscopy", "image analysis"], ["microscopy", "instruments", "stats-and-code"], "microscope", "I run the light-sheet. Book early, bring clean samples."],
  ["c-nadia", "Nadia Benali", "Atlas Institute of Medical Genetics (example)", "Rabat", "Clinician scientist", "clinical", ["exome sequencing", "variant interpretation"], ["rna-seq", "reproducibility", "grants-careers"], "dna", "Clinical genetics: one family, one variant at a time."],
];

/** What people in each field post about: room, kind, title, text, and a figure. */
type Template = { room: string; intent: string; title: string; body: string; fig?: (seed: number) => string };
const T: Record<Field, Template[]> = {
  cell: [
    { room: "western-blot", intent: "result", title: "Knock-down holds for 96 h, gone by day 6", body: "Three independent transfections, siRNA at 20 nM. The band is back by day 6 in every replicate, so our day-7 phenotype readout needs a second dose.", fig: (s) => westernBlot(s, "Target protein after siRNA", ["ctrl", "24 h", "48 h", "96 h", "6 d"], "target") },
    { room: "cell-culture", intent: "general", title: "Mycoplasma positive after a supplier's FBS lot change: anyone else?", body: "PCR positive in two lines a week after switching FBS lots. The old lot stays negative. Before I blame the serum: has anyone seen this with a recent lot?" },
    { room: "transfection", intent: "result", title: "Electroporation beats lipofection in our primary fibroblasts", body: "Same plasmid, same cells, passage 6. Electroporation 62% GFP+, lipofection 18%. Viability is lower with electroporation, so we now seed 30% more cells.", fig: (s) => barChart(s, "GFP+ cells after delivery", ["lipo A", "lipo B", "nucleo", "electro"], "% GFP+") },
    { room: "crispr", intent: "data_question", title: "Editing efficiency by guide: which ones would you keep?", body: "Six guides, ICE analysis, two replicates. Guide 4 looks best but has a predicted off-target in an exon. Would you take the second best instead?", fig: (s) => barChart(s, "Indel frequency per guide", ["g1", "g2", "g3", "g4", "g5", "g6"], "% indels", "#0B7A4B") },
    { room: "negative-results", intent: "result", title: "Rapamycin did not induce autophagy flux in our line at all", body: "LC3-II up, but no change with bafilomycin on top, so no flux. Three runs, two antibody lots. Posting so nobody else spends a month on it.", fig: (s) => westernBlot(s, "LC3-II with and without bafilomycin", ["ctrl", "rapa", "baf", "rapa+baf"], "LC3-II") },
    { room: "microscopy", intent: "update", title: "First clean images from the new spinning disk", body: "After two weeks of alignment: nuclei and lysosomes in fixed HeLa, 60x oil. The flatness across the field is finally acceptable.", fig: (s) => micrograph(s, "Nuclei (blue) and LAMP1 (green)") },
  ],
  neuro: [
    { room: "electrophysiology", intent: "general", title: "Seal resistance drops after 10 minutes in our slices", body: "Gigaseals form fine, then drift below 500 MΩ around minute ten. ACSF is fresh, osmolarity checked. Pipette glass or something in the perfusion?" },
    { room: "microscopy", intent: "result", title: "Place cells stable over 5 days in CA1", body: "Two-photon imaging through a cannula window, 412 cells tracked. About half keep their field from day 1 to day 5.", fig: (s) => timeSeries(s, "Place field stability", ["mouse 1", "mouse 2", "mouse 3"], "correlation to day 1") },
    { room: "cell-culture", intent: "result", title: "MEA bursts appear from week 5 in our iPSC neurons", body: "Network bursts start in week 5 and are synchronous by week 7. Astrocyte co-culture brings it forward by about a week.", fig: (s) => timeSeries(s, "Burst rate on the MEA", ["neurons only", "with astrocytes"], "bursts per minute") },
    { room: "negative-results", intent: "result", title: "Optogenetic stimulation did not change the behaviour we expected", body: "ChR2 in the target population, verified by histology and slice recordings. No effect on the task across 14 mice. Posting the whole dataset.", fig: (s) => barChart(s, "Task performance", ["light off", "light on", "control virus"], "% correct", "#6B3FA0") },
    { room: "crispr", intent: "general", title: "Knockout zebrafish lines: how many founders do you screen?", body: "We screen ten founders per guide and keep two. Is that enough, or do you go further to rule out compensation?" },
  ],
  psych: [
    { room: "stats-and-code", intent: "data_question", title: "Head motion differs between groups: censor or model it?", body: "Patients move more than controls (mean FD 0.21 vs 0.14). Scrubbing removes 18% of patient volumes. Would you censor, add motion as a covariate, or both?", fig: (s) => barChart(s, "Mean framewise displacement", ["controls", "MDD", "TRD"], "mm", "#B33600") },
    { room: "reproducibility", intent: "update", title: "Our trial protocol is pre-registered, with the analysis code", body: "Primary outcome, analysis plan and the code that will produce Table 2, frozen before the first patient. Comments welcome while we can still change things." },
    { room: "stats-and-code", intent: "result", title: "Momentary mood and sleep the night before", body: "EMA five times a day, 21 days, 86 participants. Sleep quality predicts next-day positive affect, much less so negative affect.", fig: (s) => scatter(s, "Sleep quality and next-day mood", "sleep quality (0-10)", "positive affect") },
    { room: "introductions", intent: "general", title: "Psychiatrist new here: looking for people doing resting-state in depression", body: "I run a small fMRI study in treatment-resistant depression. Interested in harmonised preprocessing across sites. Who else is on this?" },
    { room: "stats-and-code", intent: "result", title: "Reward learning rate lower in anhedonia, replicated", body: "Second sample, same task, same model. The learning-rate difference holds (d = 0.41) and the model fits as well as in sample one.", fig: (s) => doseResponse(s, "Choice curves by group", "controls", "anhedonia") },
  ],
  chem: [
    { room: "mass-spec", intent: "data_question", title: "30% missing values in our label-free proteomics: impute or filter?", body: "Missingness is clearly not at random (low-abundance proteins). Would you impute from a down-shifted distribution, or filter to proteins seen in 70% of samples?", fig: (s) => barChart(s, "Proteins quantified per sample", ["S1", "S2", "S3", "S4", "S5", "S6"], "proteins (thousands)", "#0B7A4B") },
    { room: "spectroscopy", intent: "result", title: "Nanodisc size changes the stability of our transporter", body: "Larger discs (MSP2N2) keep it active three times longer at 4 °C. Thermal shift data below.", fig: (s) => doseResponse(s, "Thermal shift", "MSP1D1", "MSP2N2") },
    { room: "negative-results", intent: "result", title: "The Suzuki coupling that worked in 2019 no longer does", body: "Same paper, same catalyst supplier, new lot. Yield fell from 78% to 9%. We tested water, base and degassing. Fresh catalyst from another supplier fixed it." },
    { room: "mass-spec", intent: "result", title: "Plasma levels after the first dose, 24 patients", body: "LC-MS/MS, validated method. Exposure varies fourfold between patients; body weight explains little of it.", fig: (s) => timeSeries(s, "Plasma concentration", ["low dose", "high dose"], "ng/mL") },
    { room: "reproducibility", intent: "update", title: "Our dose-response analysis is now a package", body: "Four-parameter fits, outlier rule written down, plots that match the paper. On our GitLab, with the example data.", fig: (s) => doseResponse(s, "IC50 fits", "compound 7", "compound 12") },
  ],
  comp: [
    { room: "stats-and-code", intent: "general", title: "Snakemake or Nextflow for a small lab in 2026?", body: "Three people, one cluster, mostly single-cell. We started in Snakemake but the new student knows Nextflow. Which would you standardise on?" },
    { room: "rna-seq", intent: "result", title: "Batch effects in our single-cell data, before and after integration", body: "Four batches, 62 000 cells. Harmony removes most of the batch structure without merging the two rare populations we care about.", fig: (s) => scatter(s, "Batch mixing after integration", "UMAP 1", "UMAP 2") },
    { room: "reproducibility", intent: "result", title: "We re-ran our 2022 analysis from the archive: it gives the same numbers", body: "Container, lockfile and data from the repository. Every figure reproduced to the third decimal. It took 40 minutes and one renamed column." },
    { room: "stats-and-code", intent: "data_question", title: "Random slopes for every subject: model does not converge", body: "Mixed model with random slopes for time by subject, 120 subjects, 5 visits. Singular fit. Simplify, or go Bayesian with weak priors?", fig: (s) => scatter(s, "Per-subject slopes", "baseline score", "slope over time") },
  ],
  eco: [
    { room: "field-sampling", intent: "update", title: "eDNA from 40 kelp sites, three species we did not expect", body: "Filtered 2 L per site, two primer sets. Three fish species show up that nobody has recorded here. Checking for contamination before we get excited.", fig: (s) => barChart(s, "Reads per site group", ["north", "bay", "south", "open"], "reads (thousands)", "#0B7A4B") },
    { room: "field-sampling", intent: "general", title: "Camera traps: how do you deal with false triggers from grass?", body: "Half our images are wind in the grass. Sensitivity down, or cut the grass and change the habitat we are measuring?" },
    { room: "rna-seq", intent: "result", title: "Root transcriptome after drought, 3 time points", body: "Clear response by 48 h, mostly back by day 7 after watering. Auxin genes behave differently than in the literature.", fig: (s) => timeSeries(s, "Expression of drought genes", ["gene cluster 1", "gene cluster 2", "gene cluster 3"], "log2 fold change") },
    { room: "stats-and-code", intent: "data_question", title: "Occupancy models with only three visits per site?", body: "Twenty sites, three visits each, detection around 0.3. Is that enough to say anything about occupancy, or should I pool seasons?" },
  ],
  materials: [
    { room: "instruments", intent: "update", title: "XRD back in service, booking reopened", body: "New tube, alignment done, standard within spec. First slots are next week; please bring powder that is actually dry." },
    { room: "spectroscopy", intent: "result", title: "Impedance of our solid electrolyte depends on humidity in the glovebox", body: "Same pellets, same cell. Ionic conductivity drops by a third when the glovebox reads 3 ppm water instead of 0.5. We now log humidity with every measurement.", fig: (s) => scatter(s, "Conductivity and glovebox humidity", "H2O (ppm)", "conductivity (mS/cm)") },
    { room: "negative-results", intent: "result", title: "Our home-built optical tweezers drift 20 nm per minute", body: "Temperature stabilised, table floated. The drift follows the air conditioning cycle. Enclosure next." },
  ],
  clinical: [
    { room: "reproducibility", intent: "update", title: "Data management plan template for small investigator-led trials", body: "What we use for our trials: REDCap, a monitoring plan, and the exact export the statistician gets. Free to reuse." },
    { room: "stats-and-code", intent: "data_question", title: "Missing follow-up in 22% of a cohort: multiple imputation enough?", body: "Dropout is related to baseline severity. MI with severity in the model, or a pattern-mixture sensitivity analysis on top?", fig: (s) => barChart(s, "Follow-up completion", ["baseline", "3 mo", "6 mo", "12 mo"], "% of cohort", "#8A5A00") },
    { room: "negative-results", intent: "result", title: "The synergy we saw in two glioma lines is gone in the third", body: "Bliss synergy in U87 and LN229, none in the patient-derived line. Same plates, same reader. The combination is not as general as we hoped.", fig: (s) => doseResponse(s, "Viability with the combination", "drug A alone", "drug A + B") },
    { room: "grants-careers", intent: "general", title: "Clinician scientists: how do you protect research time?", body: "I have one research day a week on paper and about half of it in practice. What arrangements have worked in your hospital?" },
  ],
};

const REPLIES = [
  "We saw the same last year. In our case it was the lot, not the protocol.",
  "Could you share the raw numbers? I would like to compare with our runs.",
  "Have you tried it at a lower passage? That changed everything for us.",
  "Thanks for posting the negative result, this saves us a month.",
  "I would keep the second guide. One exonic off-target is one too many.",
  "Happy to send you our protocol, it is on a method card already.",
  "Same question here; following.",
  "We moved to Nextflow last year and do not regret it, but the learning curve is real.",
  "Censor and model it. Reviewers will ask for both anyway.",
  "That is a really clean result. What n per group?",
  "Check the humidity log first. It was the culprit in our lab too.",
  "We pool seasons and model the season as a covariate. Works fine with detection around 0.3.",
  "Would you be open to a joint analysis? We have a comparable dataset.",
  "Interesting. Did the effect survive excluding the two outliers?",
  "We filter to 70% presence and then impute the rest. Sensitivity analysis both ways.",
];

const JOBS: [string, string, string, string, Field][] = [
  ["PhD position: CRISPR screens in primary immune cells", "PhD", "c-amara", "Fully funded for four years. Genome-wide screens, arrayed validation, a friendly lab.", "cell"],
  ["Postdoc in cortical circuit physiology (3 years)", "Postdoc", "c-henrik", "Patch clamp and two-photon imaging in awake mice. Experience with one of the two is enough.", "neuro"],
  ["Research technician, proteomics core (80-100%)", "Technician", "c-omar", "Run sample preparation and the Orbitrap queue, train users.", "chem"],
  ["Data scientist, single-cell pipelines", "Data scientist", "c-kwame", "Build and maintain our Snakemake pipelines, help students with analysis.", "comp"],
  ["Clinician scientist, treatment-resistant depression (50% research)", "Clinician scientist", "c-felix", "Half research, half clinic. Trials, MRI and a team that likes pre-registration.", "psych"],
  ["PhD student in computational psychiatry", "PhD", "c-daniel", "Reinforcement learning models, EEG and patients. Python and curiosity required.", "psych"],
  ["Two PhD positions: autism risk genes in human neurons", "PhD", "c-priyanka", "iPSC neurons, CRISPR, calcium imaging. Start in spring.", "neuro"],
  ["Postdoc in medicinal chemistry for lysosomal disorders", "Postdoc", "c-aarav", "Design, synthesis and SPR. Two years with extension.", "chem"],
  ["Field technician, marine eDNA (seasonal)", "Technician", "c-greta", "May to September on the island. Boat licence an advantage.", "eco"],
  ["Postdoc in neuroimaging methods (fMRIPrep, harmonisation)", "Postdoc", "c-matteo", "Multi-site resting-state data, harmonisation and open tools.", "psych"],
  ["Research software engineer (R, Quarto)", "Data scientist", "c-zara", "Help six labs turn analyses into reproducible reports.", "comp"],
  ["Trial manager, investigator-led trials", "Technician", "c-sam", "Coordinate two trials, monitoring and data management.", "clinical"],
  ["PhD in solid-state battery materials", "PhD", "c-erik", "Impedance, XRD and a glovebox with a humidity log.", "materials"],
  ["Light-sheet microscopy specialist, imaging core", "Technician", "c-tobias", "Run and develop our light-sheet systems, train users, analyse data.", "materials"],
  ["Postdoc, clinical genetics and variant interpretation", "Postdoc", "c-nadia", "Exomes from families with rare disease, functional follow-up.", "clinical"],
  ["Group leader, computational biology (tenure track)", "Group leader", "c-omar", "Start-up package, core access, a growing institute.", "comp"],
  ["Postdoc in plant root imaging", "Postdoc", "c-hana", "Confocal and light-sheet imaging of roots under drought.", "eco"],
  ["Student assistant, behaviour tracking code (10 h/week)", "Student assistant", "c-noor", "Python, video analysis, zebrafish. Flexible hours.", "neuro"],
  ["Epidemiologist, cohort study (2 years)", "Data scientist", "c-fatima", "Analyse a 12 000-person cohort, missing data and all.", "clinical"],
  ["PhD in single-molecule biophysics", "PhD", "c-jakob", "Optical tweezers, AFM, and building instruments.", "materials"],
];
const FUNDING: [string, string, string, string][] = [
  ["Seed grants for cross-lab replication (example)", "Project grant", "c-zara", "Small grants to repeat a published method in a second lab and publish the outcome either way. Invented for the demo."],
  ["Travel grants for early-career researchers (example)", "Travel grant", "c-chiara", "Up to 1 500 for a conference or a lab visit. Invented for the demo; check real calls with your funder."],
  ["Open-hardware microscopy fund (example)", "Project grant", "c-tobias", "Funds for building and documenting open microscopes. Invented for the demo."],
  ["Clinician scientist protected-time programme (example)", "Fellowship", "c-felix", "Two years of 50% protected research time. Invented for the demo."],
  ["Data reuse prize (example)", "Prize", "c-kwame", "For a paper built on someone else's open dataset. Invented for the demo."],
  ["Field-season support for marine ecology (example)", "Project grant", "c-greta", "Boat time and consumables for one season. Invented for the demo."],
];

const STORY_TEXT = [
  "Thesis submitted. 214 pages. Going to sleep for a week.",
  "First patient randomised in our trial this morning.",
  "The cryo-EM grids finally look good. Fingers crossed for the weekend session.",
  "Lab retreat: we wrote down every protocol nobody else knows. 23 so far.",
  "Reviewer 2 liked the negative results section. A first.",
  "Two open PhD positions in my lab, details under Jobs.",
  "Our pipeline ran on a fresh laptop from the archive. Reproducibility works.",
  "Defended today!",
  "Back from the field: 40 sites, 80 L of seawater filtered.",
  "Journal club tomorrow, bring your worst figure.",
];
const STORY_PICS: [string, (s: number) => string][] = [
  ["Day 1 at the poster session", (s) => posterScene(s, "Lysosomes under stress")],
  ["Friday at the bench", (s) => benchScene(s, "Friday at the bench")],
  ["The new spinning disk is in", (s) => micrograph(s, "First image", "#f472b6")],
  ["Media change at 7 am", (s) => benchScene(s, "7 am media change", "#1e293b")],
  ["Poster is up, come say hi", (s) => posterScene(s, "Mood in daily life")],
];

/** Ids of the written personas the crowd interacts with. */
const CORE = ["u-rivera", "u-okafor", "u-lindqvist", "u-bhatt", "u-mateo", "u-ingrid", "u-lena", "u-newcomer"];

export function crowdTables(at: (local: string) => string, base: Record<string, Row[]>): void {
  const r = rng(424242);
  const pick = <X,>(xs: X[]) => xs[Math.floor(r() * xs.length)];
  const day = (lo: number, hi: number) => `2026-${lo < 31 ? "10" : "10"}-${String(Math.max(1, Math.min(23, Math.round(lo + r() * (hi - lo))))).padStart(2, "0")} ${String(7 + Math.floor(r() * 14)).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}`;
  const push = (t: string, rows: Row[]) => { (base[t] ??= []).push(...rows); };
  const colours = ["#0D0D0D", "#B33600", "#0B7A4B", "#1B4FA0", "#6B3FA0", "#8A5A00"];

  // ── people
  push("profiles", PEOPLE.map(([id, name, inst, city, role, , tech, , icon, bio], i) => ({
    id, display_name: `${name}.ex`, institution: `${inst}, ${city}`, role_title: role, field: "", techniques: tech, orcid: null,
    avatar_url: i % 4 === 3 ? null : `preset:${icon}:${colours[i % colours.length]}`, email: "", bio,
    notifications_seen_at: null, weekly_digest: false, public_profile: false, open_to: i % 3 === 0 ? ["collaborate", "feedback"] : [],
    created_at: at(`2026-09-${String(1 + (i % 28)).padStart(2, "0")} 10:00`),
  })));
  push("user_rooms", PEOPLE.flatMap(([id, , , , , , , rooms]) => rooms.map((room_id) => ({ user_id: id, room_id, joined_at: at("2026-09-15 10:00") }))));

  // ── who follows whom: Alex follows sixteen of them, everyone follows a few
  const ids = PEOPLE.map((p) => p[0]);
  const follows: Row[] = [];
  const addFollow = (a: string, b: string) => { if (a !== b && !follows.some((f) => f.follower_id === a && f.followee_id === b)) follows.push({ follower_id: a, followee_id: b, created_at: at(day(1, 20)) }); };
  ids.slice(0, 32).filter((_, i) => i % 2 === 0).forEach((id) => addFollow("u-rivera", id));
  for (const id of ids) {
    for (let k = 0; k < 4 + Math.floor(r() * 5); k++) addFollow(id, pick(ids));
    if (r() < 0.45) addFollow(id, "u-rivera");
    if (r() < 0.25) addFollow(id, pick(CORE));
  }
  push("follows", follows);

  // ── groups: eight join the open journal club, two new open groups
  const members: Row[] = ["c-lucas", "c-pablo", "c-amara", "c-lea", "c-anika", "c-mira", "c-leila", "c-julia"].map((u) => ({ group_id: "gr-transfection", user_id: u, role: "member", joined_at: at(day(5, 20)) }));
  push("groups", [
    { id: "gr-comp-psych", name: "Computational psychiatry reading group", access: "open", created_by: "c-ines", created_at: at("2026-09-12 18:00"), institution: "", description: "One paper a fortnight on models of mood, reward and learning, with the code when there is code." },
    { id: "gr-imaging-core", name: "Imaging core users", access: "open", created_by: "c-tobias", created_at: at("2026-09-05 09:00"), institution: "", description: "Light-sheet, spinning disk and two-photon users sharing settings, bookings and sample prep." },
  ]);
  members.push(...[["gr-comp-psych", "c-ines", "owner"], ["gr-comp-psych", "c-daniel", "member"], ["gr-comp-psych", "c-matteo", "admin"], ["gr-comp-psych", "c-felix", "member"], ["gr-comp-psych", "c-raul", "member"], ["gr-comp-psych", "c-zara", "member"],
    ["gr-imaging-core", "c-tobias", "owner"], ["gr-imaging-core", "c-wei", "member"], ["gr-imaging-core", "c-hana", "member"], ["gr-imaging-core", "c-lucas", "member"], ["gr-imaging-core", "c-henrik", "member"], ["gr-imaging-core", "u-lindqvist", "member"]]
    .map(([group_id, user_id, role]) => ({ group_id, user_id, role, joined_at: at(day(5, 18)) })));
  push("group_members", members);

  // ── posts, replies and reactions
  const posts: Row[] = [], replies: Row[] = [], reactions: Row[] = [];
  let n = 0;
  PEOPLE.forEach(([id, , , , , field], i) => {
    const pool = T[field];
    const count = 1 + (i % 3 === 0 ? 2 : i % 2);
    for (let k = 0; k < count; k++) {
      const t = pool[(i + k * 2) % pool.length];
      const pid = `cp-${++n}`;
      const when = day(2 + k * 5, 23);
      posts.push({
        id: pid, author_id: id, room_id: t.room, group_id: null, intent: t.intent, title: t.title, body: t.body,
        method_card_id: null, project_id: null, technique: "", organism: "", deadline: null, offer: "",
        images: t.fig ? [t.fig(1000 + n)] : [], link_preview: null, audience: "topic", feedback_kinds: [], call_status: "open",
        created_at: at(when),
      });
      const nReplies = Math.floor(r() * 4);
      for (let j = 0; j < nReplies; j++) {
        const who = r() < 0.2 ? pick(CORE) : pick(ids);
        if (who === id) continue;
        replies.push({ id: `cr-${n}-${j}`, post_id: pid, author_id: who, body: pick(REPLIES), anchor: "", helped_at: null, created_at: at(day(Number(when.slice(8, 10)), 23)) });
      }
      const nReact = Math.floor(r() * 6);
      for (let j = 0; j < nReact; j++) {
        const who = pick([...ids, ...CORE]);
        if (who === id || reactions.some((x) => x.target_id === pid && x.user_id === who)) continue;
        reactions.push({ id: `crx-${n}-${j}`, user_id: who, target_kind: "post", target_id: pid, kind: pick(["useful", "seen", "can_help"]), created_at: at(when) });
      }
    }
  });
  // Group discussions in the two new groups.
  posts.push(
    { id: "cp-g1", author_id: "c-ines", room_id: "", group_id: "gr-comp-psych", intent: "update", title: "Next paper: learning rates in anhedonia, the replication", body: "Daniel presents on the 14th. Read the methods; the model comparison is the interesting part.", method_card_id: null, project_id: null, technique: "", organism: "", deadline: null, offer: "", images: [], link_preview: null, audience: "topic", feedback_kinds: [], call_status: "open", created_at: at("2026-10-20 18:00") },
    { id: "cp-g2", author_id: "c-tobias", room_id: "", group_id: "gr-imaging-core", intent: "update", title: "Light-sheet down for maintenance on Monday", body: "Laser alignment and a new filter set. Back on Tuesday morning.", method_card_id: null, project_id: null, technique: "", organism: "", deadline: null, offer: "", images: [micrograph(77, "Calibration beads", "#fbbf24")], link_preview: null, audience: "topic", feedback_kinds: [], call_status: "open", created_at: at("2026-10-21 08:30") },
  );
  // Replies from the crowd on a few of Alex's posts, so the persona's world connects.
  for (const [k, pid] of ["p-1", "p-2", "p-3"].entries()) replies.push({ id: `cr-core-${k}`, post_id: pid, author_id: ["c-lucas", "c-pablo", "c-amara"][k], body: REPLIES[k + 1], anchor: "", helped_at: null, created_at: at(`2026-10-${20 + k} 11:00`) });
  push("posts", posts);
  push("post_replies", replies);
  push("reactions", reactions);

  // ── jobs and funding
  const opps: Row[] = [];
  JOBS.forEach(([title, level, by, body, field], i) => {
    const p = PEOPLE.find((x) => x[0] === by)!;
    opps.push({ id: `cop-j${i}`, kind: "job", title, org: p[2], place: p[3], level, url: "", deadline: new Date(Date.parse(at("2026-11-01 12:00")) + (14 + Math.floor(r() * 80)) * 864e5).toISOString().slice(0, 10),
      topics: p[7].slice(0, 2), techniques: p[6].slice(0, 3), body, posted_by: by, status: "open", created_at: at(day(5, 23)), field });
  });
  FUNDING.forEach(([title, level, by, body], i) => {
    opps.push({ id: `cop-f${i}`, kind: "funding", title, org: "Example funder", place: "International", level, url: "", deadline: new Date(Date.parse(at("2026-11-01 12:00")) + (20 + Math.floor(r() * 120)) * 864e5).toISOString().slice(0, 10),
      topics: ["grants-careers"], techniques: [], body, posted_by: by, status: "open", created_at: at(day(3, 23)) });
  });
  push("opportunities", opps.map(({ field, ...o }) => o));

  // ── a few events
  const soon = (d: number, h: number) => new Date(Date.parse(at("2026-11-01 00:00")) + d * 864e5 + h * 36e5).toISOString();
  push("events", [
    { id: "cev-1", group_id: "gr-comp-psych", kind: "journal_club", title: "Learning rates in anhedonia: the replication", starts_at: soon(13, 17), ends_at: soon(13, 18), location: "", online_url: "https://meet.example.org/comp-psych", body: "Daniel presents.", created_by: "c-ines", created_at: at("2026-10-20 18:00") },
    { id: "cev-2", group_id: "gr-imaging-core", kind: "workshop", title: "Light-sheet sample clearing, hands-on", starts_at: soon(9, 9), ends_at: soon(9, 13), location: "Imaging core, room 0.12", online_url: "", body: "Bring two fixed samples.", created_by: "c-tobias", created_at: at("2026-10-18 09:00") },
    { id: "cev-3", group_id: null, kind: "conference", title: "Open Methods Symposium (example)", starts_at: soon(30, 8), ends_at: soon(31, 17), location: "Leiden", online_url: "", body: "Two days on methods that travel between labs. Invented for the demo.", created_by: "c-amara", created_at: at("2026-10-10 12:00") },
  ]);
  push("event_attendees", [["cev-1", "c-daniel"], ["cev-1", "c-matteo"], ["cev-2", "c-wei"], ["cev-2", "u-lindqvist"], ["cev-3", "c-lucas"], ["cev-3", "c-mira"]]
    .map(([event_id, user_id]) => ({ event_id, user_id, status: "going", created_at: at("2026-10-21 12:00") })));

  // ── stories from the last day, relative to now (the demo store is built at start)
  const now = Date.now();
  const storyAuthors = ["c-lucas", "c-pablo", "c-amara", "c-lea", "c-ines", "c-felix", "c-tobias", "c-greta", "c-priyanka", "c-sofia", "c-wei", "c-mira", "c-kwame", "c-yuki", "u-okafor", "u-lindqvist", "c-anika", "c-julia"];
  const stories: Row[] = [];
  storyAuthors.forEach((author, i) => {
    const count = 1 + (i % 3 === 0 ? 2 : i % 2);
    for (let k = 0; k < count; k++) {
      const hoursAgo = 0.5 + r() * 21;
      const created = new Date(now - hoursAgo * 36e5);
      const pic = (i + k) % 2 === 0;
      const [caption, draw] = STORY_PICS[(i + k) % STORY_PICS.length];
      stories.push({
        id: `cst-${i}-${k}`, author_id: author, kind: pic ? "image" : "text",
        image_path: pic ? draw(500 + i * 7 + k) : null, body: pic ? caption : STORY_TEXT[(i * 3 + k) % STORY_TEXT.length],
        colour: colours[(i + k) % colours.length] === "#0D0D0D" ? "#1B4FA0" : colours[(i + k) % colours.length],
        created_at: created.toISOString(), expires_at: new Date(created.getTime() + 24 * 36e5).toISOString(),
      });
    }
  });
  push("stories", stories.sort((a, b) => a.created_at.localeCompare(b.created_at)));
  // Alex has already looked at a few.
  push("story_views", stories.filter((_, i) => i % 4 === 0).map((s) => ({ story_id: s.id, viewer_id: "u-rivera", seen_at: new Date(now - 30 * 60e3).toISOString() })));
}
