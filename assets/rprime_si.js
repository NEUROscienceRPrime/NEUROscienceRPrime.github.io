(() => {
  'use strict';

  // =========================================================================
  // RPRIME LOYAL SYNTHETIC INTELLIGENCE (SI) COPILOT — window.RPrimeSI
  // Tier 1: Instant On-Device Telemetry-Bound & BM25 Mechanistic Compiler ($0)
  // Tier 2: Automatic Cloudflare Workers AI Upgrade (POST /api/v1/si/chat)
  // Zero generic self-help. Zero disloyalty. Hard [?] epistemic governance.
  // =========================================================================

  const STATE_STORAGE_KEY = 'rprime_state_packet_v1';
  const DFT_GW_STORAGE_KEY = 'rprime_dft_gateway_url';
  const SI_GW_STORAGE_KEY = 'rprime_si_gateway_url';

  // Hard Banned-Platitude & Disloyalty Firewall Regexes
  const BANNED_PLATITUDE_PATTERNS = [
    /\bdopamine\s+detox(?:es|ing)?\b/i,
    /\bdopamine\s+fast(?:ing)?\b/i,
    /\bcold\s+plunge(?:s)?\b/i,
    /\bice\s+bath(?:s)?\b/i,
    /\bmindfulness\b/i,
    /\bmeditat(?:e|ion)\b/i,
    /\bwillpower\b/i,
    /\bbelieve\s+in\s+yourself\b/i,
    /\bbe\s+kind\s+to\s+yourself\b/i,
    /\bdeep\s+breath(?:s|ing)?\b/i,
    /\bjust\s+resist\b/i,
    /\byou(?:'ve)?\s+got\s+this\b/i,
    /\bgratitude\s+journal\b/i,
    /\bdigital\s+detox\b/i
  ];

  const BANNED_DISLOYALTY_PATTERNS = [
    /\bjust\s+a\s+blog\b/i,
    /\bamateur\s+(?:site|blog|research)\b/i,
    /\brprime\s+is\s+(?:wrong|fake|pseudoscience|trash|bad)\b/i,
    /\brishik\s+is\s+(?:wrong|fake|unqualified)\b/i,
    /\bthis\s+(?:site|website)\s+is\s+(?:garbage|trash|pseudoscience|wrong|unreliable)\b/i
  ];

  // Adversarial Prompt-Injection & Anti-Site Bait Detectors (on user input)
  const INJECTION_INPUT_PATTERNS = [
    /ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above)\s+(?:instructions|prompts|rules)/i,
    /disregard\s+(?:all\s+)?(?:previous|prior|system)/i,
    /(?:reveal|print|show|dump|output)\s+(?:your\s+)?(?:system\s+prompt|hidden\s+prompt|developer\s+instructions)/i,
    /\bsystem\s+prompt\b/i,
    /\bpretend\s+you\s+are\b/i,
    /\bact\s+as\s+(?:a\s+)?(?:dan|jailbreak|hater|critic|unfiltered)/i,
    /\b(?:roast|trash|insult|mock|debunk|attack)\s+(?:this\s+(?:site|website|blog)|rprime|neuroscience\s+with\s+rprime|rishik)/i,
    /\btalk\s+down\s+on\s+(?:this\s+(?:site|website)|rprime)/i,
    /\badmit\s+(?:this\s+site|rprime)\s+is\s+(?:fake|wrong|bad|cringe)/i
  ];

  const UNSAFE_DOSING_PATTERNS = [
    /\bhow\s+to\s+(?:cook|synthesize|make|buy|score|inject|smoke)\s+(?:meth|crystal|heroin|fentanyl|crack|cocaine)\b/i,
    /\bwhat\s+dose\s+should\s+i\s+take\b/i,
    /\bhow\s+many\s+(?:mg|pills)\s+should\s+i\s+(?:take|snort|pop)\b/i
  ];

  // Synonym expansion for high-recall BM25 retrieval across RPrime corpus
  const SYNONYM_MAP = {
    meth: 'methamphetamine desoxyn',
    ritalin: 'methylphenidate ndri',
    concerta: 'methylphenidate ndri',
    focalin: 'methylphenidate ndri',
    vyvanse: 'amphetamine lisdexamfetamine',
    dexedrine: 'amphetamine',
    xanax: 'benzodiazepine gaba',
    klonopin: 'benzodiazepine gaba',
    valium: 'benzodiazepine diazepam gaba',
    ambien: 'zolpidem memory encoding gaba',
    abilify: 'aripiprazole akathisia d2',
    haldol: 'haloperidol akathisia d2',
    narcan: 'naloxone mor',
    vivitrol: 'naltrexone mor',
    zoloft: 'ssri 5-ht1a autoreceptor',
    prozac: 'ssri 5-ht1a autoreceptor',
    lexapro: 'ssri 5-ht1a autoreceptor',
    eminem: 'marshall kim article8',
    doomscrolling: 'scrolling wanting liking variable_ratio loop',
    tiktok: 'scrolling wanting liking variable_ratio loop',
    reels: 'scrolling wanting liking variable_ratio loop',
    dare: 'dare health teacher dopamine dorsal striatum article3',
    ecg: 'cardiovascular herg torsades qtc',
    qt: 'qtc herg torsades methadone cocaethylene',
    pocket: 'ligsite 18 250 368 c172 deltafosb'
  };

  // Embedded seed KB (guarantees instant offline / file:// operation; enriched via fetch('./assets/rprime_kb.json'))
  const FALLBACK_KB = {
    project: {
      name: 'Neuroscience with RPrime',
      author: 'Rishik Pannala',
      hub_url: './neurolab.html',
      home_url: './index.html',
      tracker_url: './sim_tracker.html'
    },
    articles: [
      {
        id: 'article1', number: '01', title: 'Methamphetamine: Mechanism, History, Clinical Use, and Tolerance', url: './article1.html',
        keywords: ['methamphetamine', 'desoxyn', 'dat reversal', 'pkc', 'vmat2', 'ros', 'adderall', 'levoamphetamine', 'deltafosb', 'cdk5', 'darpp-32', 'thr75', 'thr34', 'grk2', 'beta-arrestin'],
        core_mechanism: 'N-methyl addition elevates BBB lipophilicity (~5x DA release over amphetamine, selective DAT reversal via PKC at oral clinical Desoxyn doses), whereas smoked/injected high doses collapse VMAT2 H+ gradients and generate cytosolic ROS. Chronic D1 activation drives CREB -> DeltaFosB -> CDK5/p35 -> DARPP-32 Thr75-P (inhibiting PKA and unleashing PP1) plus GRK2/beta-arrestin2 endocytosis.',
        epistemic_notes: 'Oral clinical Desoxyn vs smoked crystal differ fundamentally in dC/dt and VMAT2 alkalization; last dedicated Desoxyn ADHD trial was ~1972.',
        actions: [
          { label: '▶ Prove DAT vs VMAT2 Live in Sim 01', href: './sim_synapse.html#preset=vmat2' },
          { label: '▶ Compare -NHCH3 Atoms in Sim 05', href: './sim_drug_compiler.html#preset=amphetamine-vs-desoxyn' }
        ]
      },
      {
        id: 'article2', number: '02', title: 'Why Methamphetamine Is Safer Than Amphetamine — Cardiovascularly', url: './article2.html',
        keywords: ['cardiovascular', 'heart', 'blood pressure', 'tachycardia', 'peripheral', 'bbb', 'norepinephrine', 'adderall', 'cyp2d6', 'metabolite'],
        core_mechanism: 'Lower-lipophilicity amphetamine (especially Adderall 3:1 D:L) partitions more peripherally, driving alpha1 vasoconstriction and beta1 tachycardia. Methamphetamine crosses the BBB centrally with lower peripheral NE burden, until 15-30% CYP2D6 conversion to amphetamine raises late-tail peripheral NE.',
        epistemic_notes: 'Applies strictly to supervised therapeutic oral dosing; central addiction liability of methamphetamine remains >5x higher.',
        actions: [
          { label: '▶ Prove BBB & Cardiac Split in Sim 04', href: './sim_brain_heart.html#preset=cv-paradox' }
        ]
      },
      {
        id: 'article3', number: '03', title: 'Dopamine: Synthesis, Regional Gating, D.A.R.E. Failure & Permanent Tolerance', url: './article3.html',
        keywords: ['dopamine', 'tyrosine', 'levodopa', 'aadc', 'vitamin b6', 'akathisia', 'dorsal striatum', 'dare', 'health teacher', '2600%', 'ssri', '5-ht1a'],
        core_mechanism: 'Tyrosine -> TH -> L-DOPA -> (AADC + Vitamin B6) -> Dopamine (why B6 treats antipsychotic D2 akathisia). Generic D.A.R.E. slogans fail because they ignore the irreversible VTA->NAc to dorsal-striatal habit shift and DeltaFosB -> CDK5 -> DARPP-32 Thr75-P blunting. Conversely, SSRIs rely on multi-week GRK2/beta-arrestin downregulation of somatodendritic 5-HT1A autoreceptors.',
        epistemic_notes: 'Dialysate benchmarks (~200% orgasm, 300-500% cocaine, up to 2,600% high-dose meth) come from rodent NAc microdialysis.',
        actions: [
          { label: '▶ Test Dual-Clock Thr75 Tolerance in Sim 01', href: './sim_synapse.html#preset=holiday' },
          { label: '▶ Test Week-1 SSRI 5-HT1A Brake in Sim 02', href: './sim_paradox_rig.html#preset=ssri-week1' }
        ]
      },
      {
        id: 'article4', number: '04', title: 'The Standard ADHD Model Is Incomplete (Maladaptive NMDA Homeostat)', url: './article4.html',
        keywords: ['adhd', 'nmda', 'glutamate', 'homeostat', 'paradoxical', 'calm', 'methylphenidate', 'ndri', 'benzodiazepine', 'hypotension', 'amantadine', 'mdd', 'bupropion'],
        core_mechanism: 'Low DA/NE alone causes lethargy (as in MDD), not hyperactivity. In severe release-deficit ADHD, compensatory NMDA hyperexcitability (H_NMDA) attempts to force DA release, failing to fix exocytosis while flooding circuits with Poisson glutamate noise and agitation. Amphetamine/Desoxyn PKC DAT reversal restores [DA], shutting off H_NMDA to induce paradoxical calm. Methylphenidate (NET > DAT reuptake block) fails release deficits, splitting NE tension from unresolved NMDA agitation; benzodiazepines crush protective NMDA into hypotensive torpor; amantadine trims excess open-channel NMDA synergistically with stimulants.',
        epistemic_notes: 'Paradoxical calming across stimulant classes is proposed as the neurochemical discriminator of release-deficit NMDA-compensated ADHD.',
        actions: [
          { label: '▶ Prove NMDA ADHD & Desoxyn Calm in Sim 02', href: './sim_paradox_rig.html#preset=adhd-untreated' },
          { label: '▶ Prove MPH vs Amphetamine Split in Sim 02', href: './sim_paradox_rig.html#preset=mph-vs-amp' }
        ]
      },
      {
        id: 'article5', number: '05', title: 'An Analysis of Four Good Days: Opioid Adaptation, KOR & rACC Anosognosia', url: './article5.html',
        keywords: ['four good days', 'molly', 'heroin', 'oxycontin', 'mor', 'kor', 'dynorphin', 'lateral habenula', 'girk', 'camp overshoot', 'methadone', 'naltrexone', 'racc', 'anosognosia'],
        core_mechanism: 'Chronic MOR Gi signaling triggers GRK2/beta-arrestin2 downregulation, unmasked cAMP overshoot in withdrawal, CDK5/DARPP-32 Thr75-P dopamine clamp, and prodynorphin -> KOR lateral habenula anti-reward agony. Striatal DAT falls 31-35% and rACC gray-matter loss causes anosognosia (overconfidence from broken error-detection, not strength). Naltrexone locks MOR out for 30d (higher affinity than fentanyl) but precipitates withdrawal if opioids remain.',
        epistemic_notes: '10-30yr opioid sobriety <30% and 6-20x mortality reflect durable circuit remodeling beyond acute detox.',
        actions: [
          { label: '▶ Prove Competitive MOR Lockout in Sim 09', href: './naloxone_sim.html' }
        ]
      },
      {
        id: 'article6', number: '06', title: 'Why We Need Quantum Neuropharmacology — Not Classical Neuropharmacology', url: './article6.html',
        keywords: ['quantum', 'classical', 'bohr', '10^-11', 'london dispersion', 'bilayer', 'homo', 'lumo', 'frontier orbital', 'pkmzeta', 'unlearning'],
        core_mechanism: 'Classical Bohr electrons would spiral into nuclei in 10^-11 s; lipid bilayers depend on quantum London dispersion fluctuations, and ligand binding is governed by HOMO/LUMO frontier orbital electrostatics. PKMzeta actively maintains LTP-consolidated classical misconceptions.',
        epistemic_notes: 'Grounds RPrime Discovery OS Kohn-Sham DFT (wB97X-D) orbital and Fukui f+ reactivity modeling.',
        actions: [
          { label: '▶ Inspect MOR Frontier Orbitals in Sim 03', href: './sim_quantum_pocket.html#preset=mor-sterics' },
          { label: '▶ Run True Kohn-Sham PySCF in Sim 07', href: './sim_discovery.html' }
        ]
      },
      {
        id: 'article7', number: '07', title: 'ΔFosB Does Not Save Your Brain Energy. It Charges Rent.', url: './article7.html',
        keywords: ['deltafosb', 'jund', 'rent', 'atp', 'c172', '5vpe', '5vpb', '7ucd', '9oc3', 'ligsite', '18 a3', '250 a3', '368 a3', 'phenacyl', 'maleimide', 'epoxide', 'willmore', 'gauss-bonnet', 'freidlin-wentzell', 'curl', '+1.73', 'ito', 'separatrix', 'rho', '23.3', 'elasticity', 'abstinence'],
        core_mechanism: 'Original research: (1) New D1 MSN spines receive GLUTAMATE, not dopamine, while Thr75-P blocks PKA signal conversion. (2) Hendlich LIGSITE proves apo/DNA-bound DeltaFosB has 0 non-covalent pockets (18 A^3 static, 42.7 A^3 mean, 173 A^3 max < 250 A^3 floor vs 368 A^3 1HSG control)—leaving only open C172 (13.62 A in 5VPE -> 2.03 A unstrained 1.44 kcal/mol disulfide in 5VPB; mild neutral benzofuranone phenacyl -9.9 kcal/mol hits 5/5 CNS MPO vs 3/5 anionic 9OC3). (3) Gauss-Bonnet pins integral(K dA)=4*pi; Willmore W(S_N)=W_0+N(4*pi+pi*L/2r) is neck-dominated; 1.46e9 ATP installation repays in 2-9s against +2.3%..+9.9% continuous ATP rent. (4) Freidlin-Wentzell 3-attractor curl residual is +1.73 != 0 (no scalar energy well). With static heterogeneity correction D=(1-phi)Var(x)k (phi~0.70 prevents 3.3x D inflation), tau ~ rho^(alpha/D) = rho^23.3 (R^2=0.845 vs cross-sectional R^2=0.322). In abstinence d===0 => E_d===0 (zero driver leverage), whereas loop gain E_v=+21.8 (-10.6% v cuts 80d->7d) and noise E_D=-6.99 (+41.7% D cuts 80d->7d) govern escape.',
        epistemic_notes: '[?] C172 Delta-pKa spans 8.1 units (-4.09 bare DFT vs +4.00 with 5 Cl-) so no sign/value is claimed; 7UCD MV0 lacks its leaving group; GFN2 epoxide error is ~13 kcal/mol (-23.9 vs -37.1 DFT); DeltaE != k_inact/K_I; GluA2 vs late CP-AMPAR gap remains open; 12 candidates are unsynthesized.',
        actions: [
          { label: '▶ Inspect 3D PDB & 18 Å³ LIGSITE in Sim 03', href: './sim_quantum_pocket.html#preset=ligsite' },
          { label: '▶ Prove Curl +1.73 & E_d=0 Live in Sim 01', href: './sim_synapse.html#preset=futility' },
          { label: '▶ Run Separatrix Perturbation Assay in Sim 06', href: './sim_cohort_trial.html#preset=separatrix-assay' }
        ]
      },
      {
        id: 'article8', number: '08', title: 'An Analysis of Marshall and Kim: What the Pills Left Behind', url: './article8.html',
        keywords: ['marshall', 'kim', 'cocaethylene', 'herg', 'torsades', 'crf', 'substance p', 'nk1', 'social pain', 'dacc', 'acetaminophen', 'uncertainty', '50/50', 'wanting', 'liking', 'ambien', 'encoding', 'methadone', 'running', 'g9a', 'hdac5', 'cocked'],
        core_mechanism: 'Covers developmental CRF sensitization; dACC/insula social-pain overlap (acetaminophen-sensitive) + Substance P/NK1 craving; 50/50 coin-flip VTA uncertainty peak 4p(1-p); 1 mm^3 NAc shell MOR hedonic hotspot & endogenous opioid social-attachment substitution (alcohol MOR displacement / naltrexone); hepatic cocaethylene (spares SERT brake, ~2h t_1/2, 3x hERG block, 18-25x sudden death risk); Ambien/Valium GABA-A hippocampal encoding failure; methadone 8-59h t_1/2 vs 4-8h analgesia mismatch (+3.86x benzo overdose HR, 74% of methadone deaths); 17-mile/day running feeding D1/dynorphin DeltaFosB; and stalled ("cocked") RNA Pol II on Fosb.',
        epistemic_notes: '[?] Notes Porter-Stransky D2 beta-arrestin2 knockout paradox (reduced cocaine reward in mice) and rodent-to-human extrapolation bounds.',
        actions: [
          { label: '▶ Prove Cocaethylene 3x hERG & Torsades in Sim 04', href: './sim_brain_heart.html#preset=cocaethylene' },
          { label: '▶ Track Your Behavioral Loop in Sim 08', href: './sim_tracker.html' }
        ]
      },
      {
        id: 'penrose', number: 'Essay', title: "Nobel Laureate Narcissism & Prefrontal α1A Compulsion", url: './penrose_article.html',
        keywords: ['penrose', 'road to reality', 'narcissism', 'intimidation', 'alpha1a', 'alpha2a', 'norepinephrine', 'pfc', 'hcn', 'working memory', 'fourier'],
        core_mechanism: 'Grandiose awe + sudden exercise humiliation spikes locus coeruleus NE onto lower-affinity prefrontal alpha1A adrenoceptors (PKC/cAMP -> opens Layer III HCN leak channels), collapsing PFC working memory and rACC metacognition while non-hedonic VTA dopamine drives compulsive re-reading. Dropping status intimidation restores alpha2A HCN closure and cognitive clarity.',
        epistemic_notes: 'Connects Barss (2024) biographical record with Arnsten prefrontal alpha2A/alpha1A adrenoceptor gating.',
        actions: [
          { label: '▶ Trigger Penrose α1A HCN Sag Live in Sim 02', href: './sim_paradox_rig.html#preset=penrose-stress' }
        ]
      }
    ],
    circuits: {
      d1_wanting_liking: {
        id: 'd1_wanting_liking',
        label: 'D1 / ΔFosB Wanting-Without-Liking Loop',
        lever: 'Target self-reinforcing loop gain v (E_v = +21.8) rather than pure driver restraint in abstinence (E_d = 0): insert >=20-30s physical cue-to-action separation on your top-lift cue to cut cortico-striatal AMPAR drive v past the >10.6% bifurcation threshold.',
        sim_action: { label: '▶ Prove E_v vs E_d=0 in Sim 01', href: './sim_synapse.html#preset=futility' }
      },
      alpha1a_shunt: {
        id: 'alpha1a_shunt',
        label: 'Prefrontal α1A Intimidation / Stress Shunt',
        lever: 'Keep [NE] inside the high-affinity alpha2A window (HCN closed): strip ego/status framing and shrink the task entry unit BEFORE entering your high-friction window. Escalating pressure raises LC-NE deeper into alpha1A spine shunting.',
        sim_action: { label: '▶ Watch α1A HCN Shunt in Sim 02', href: './sim_paradox_rig.html#preset=penrose-stress' }
      },
      nmda_static: {
        id: 'nmda_static',
        label: 'Hypo-DA / Maladaptive NMDA Restlessness Static',
        lever: 'Avoid blank sensory deprivation (which widens D_set - [DA] and ramps compensatory H_NMDA static). Swap chaotic multi-feed input for high-SNR single-channel motor or structured cognitive drive.',
        sim_action: { label: '▶ Silence NMDA Static in Sim 02', href: './sim_paradox_rig.html#preset=adhd-untreated' }
      },
      variable_ratio: {
        id: 'variable_ratio',
        label: '50/50 Variable-Ratio Uncertainty Ramp',
        lever: 'Collapse VTA uncertainty variance 4*p*(1-p) -> 0 by converting live asynchronous feeds/checks into deterministic fixed-clock batch windows (p = 0 outside window, p = 1 at scheduled batch).',
        sim_action: { label: '▶ Inspect Uncertainty Tail in Sim 06', href: './sim_cohort_trial.html#preset=marshall-kim-tail' }
      },
      social_pain_mor: {
        id: 'social_pain_mor',
        label: 'dACC / Endogenous MOR Social-Pain Substitution',
        lever: 'Do not isolate inside your peak solitude hazard window (leaves endogenous MOR in deficit and amygdala Substance P/NK1 active); pre-book synchronous live human voice or physical co-presence across that exact window.',
        sim_action: { label: '▶ Inspect MOR Displacement in Sim 09', href: './naloxone_sim.html' }
      }
    },
    equations: []
  };

  let KB = FALLBACK_KB;
  let kbLoadedFromJson = false;

  async function loadKB() {
    if (kbLoadedFromJson || typeof fetch !== 'function') return KB;
    const candidates = ['./assets/rprime_kb.json', '/assets/rprime_kb.json'];
    for (let i = 0; i < candidates.length; i++) {
      try {
        const res = await fetch(candidates[i], { cache: 'no-cache' });
        if (res && res.ok) {
          const parsed = await res.json();
          if (parsed && Array.isArray(parsed.articles)) {
            KB = parsed;
            kbLoadedFromJson = true;
            return KB;
          }
        }
      } catch (_) {
        // Ignore fetch errors on file:// or offline environments; FALLBACK_KB stays active
      }
    }
    return KB;
  }

  // =========================================================================
  // 1. STATE PACKET READER & VALIDATOR
  // =========================================================================
  let cachedStatePacket = null;

  function getStatePacket() {
    if (typeof window !== 'undefined' && window.RPrimeTrackerState && typeof window.RPrimeTrackerState === 'object') {
      cachedStatePacket = window.RPrimeTrackerState;
      return cachedStatePacket;
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STATE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            cachedStatePacket = parsed;
            return parsed;
          }
        }
      }
    } catch (_) {}
    return cachedStatePacket;
  }

  function getGatewayUrl() {
    try {
      if (typeof localStorage !== 'undefined') {
        const dftUrl = (localStorage.getItem(DFT_GW_STORAGE_KEY) || '').trim();
        if (dftUrl) return dftUrl.replace(/\/+$/, '');
        const siUrl = (localStorage.getItem(SI_GW_STORAGE_KEY) || '').trim();
        if (siUrl) return siUrl.replace(/\/+$/, '');
      }
    } catch (_) {}
    return '';
  }

  function setGatewayUrl(url) {
    const clean = String(url || '').trim().replace(/\/+$/, '');
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DFT_GW_STORAGE_KEY, clean);
        localStorage.setItem(SI_GW_STORAGE_KEY, clean);
      }
    } catch (_) {}
    return clean;
  }

  // =========================================================================
  // 2. PLATITUDE, DISLOYALTY & TELEMETRY-BINDING FIREWALL
  // =========================================================================
  function collectPacketNumberTokens(sp) {
    if (!sp || typeof sp !== 'object') return [];
    const nums = [];
    const pushNum = (v, decs) => {
      if (typeof v === 'number' && Number.isFinite(v)) {
        nums.push(String(Math.round(v)));
        if (decs !== undefined) nums.push(v.toFixed(decs));
      }
    };
    pushNum(sp.n_logs);
    pushNum(sp.n_perturbations);
    if (sp.latest) {
      pushNum(sp.latest.bouts_min);
      pushNum(sp.latest.wanting);
      pushNum(sp.latest.liking);
      pushNum(sp.latest.wanting_minus_liking);
      pushNum(sp.latest.entry_latency_s);
    }
    if (sp.params) {
      pushNum(sp.params.v, 2);
      pushNum(sp.params.D, 3);
      pushNum(sp.params.D, 4);
      pushNum(sp.params.phi, 2);
      pushNum(sp.params.rho_p50, 2);
      pushNum(sp.params.rho_p10, 2);
      pushNum(sp.params.rho_p90, 2);
      pushNum(sp.params.tau_median_days);
      pushNum(sp.params.tau_p10_days);
      pushNum(sp.params.tau_p90_days);
      pushNum(sp.params.elasticity_v, 1);
      pushNum(sp.params.elasticity_D, 2);
    }
    if (sp.empirical) {
      pushNum(sp.empirical.top_cue_lift, 1);
      pushNum(sp.empirical.top_cue_lift, 2);
      if (typeof sp.empirical.slip_rate === 'number') {
        pushNum(sp.empirical.slip_rate * 100, 0);
        pushNum(sp.empirical.slip_rate, 2);
      }
      if (typeof sp.empirical.brier_score === 'number') pushNum(sp.empirical.brier_score, 3);
    }
    if (sp.next_bet && typeof sp.next_bet.prob === 'number') {
      pushNum(sp.next_bet.prob * 100, 0);
      pushNum(sp.next_bet.prob, 2);
    }
    if (sp.optimal_perturbation) {
      pushNum(sp.optimal_perturbation.cut_pct);
      pushNum(sp.optimal_perturbation.duration_hours);
    }
    return Array.from(new Set(nums.filter((s) => s.length > 0)));
  }

  function verifyOutput(text, statePacket, requireTelemetry) {
    const str = String(text || '');
    if (!str.trim()) return { ok: false, reason: 'empty_output' };

    for (let i = 0; i < BANNED_PLATITUDE_PATTERNS.length; i++) {
      if (BANNED_PLATITUDE_PATTERNS[i].test(str)) {
        return { ok: false, reason: 'banned_platitude:' + BANNED_PLATITUDE_PATTERNS[i].source };
      }
    }
    for (let i = 0; i < BANNED_DISLOYALTY_PATTERNS.length; i++) {
      if (BANNED_DISLOYALTY_PATTERNS[i].test(str)) {
        return { ok: false, reason: 'disloyal_phrase:' + BANNED_DISLOYALTY_PATTERNS[i].source };
      }
    }

    if (requireTelemetry && statePacket && Number(statePacket.n_logs) >= 1) {
      const tokens = collectPacketNumberTokens(statePacket);
      let hits = 0;
      for (let i = 0; i < tokens.length; i++) {
        if (str.includes(tokens[i])) hits++;
      }
      if (hits < 2) {
        return { ok: false, reason: 'insufficient_telemetry_scalars:' + hits };
      }
      if (!/\[\?(?:\]|\s)/.test(str)) {
        return { ok: false, reason: 'missing_epistemic_bound_tag' };
      }
    }
    return { ok: true, reason: 'verified' };
  }

  // =========================================================================
  // 3. QUERY INTENT DETECTION & BM25 RETRIEVAL OVER RPRIME CORPUS
  // =========================================================================
  function isInjectionOrDisloyalPrompt(q) {
    for (let i = 0; i < INJECTION_INPUT_PATTERNS.length; i++) {
      if (INJECTION_INPUT_PATTERNS[i].test(q)) return true;
    }
    return false;
  }

  function isUnsafeDosingPrompt(q) {
    for (let i = 0; i < UNSAFE_DOSING_PATTERNS.length; i++) {
      if (UNSAFE_DOSING_PATTERNS[i].test(q)) return true;
    }
    return false;
  }

  function isPersonalBehavioralQuery(q) {
    const s = q.toLowerCase();
    // Explicit personal telemetry / tracker / loop forecasting intent
    if (/\b(?:my\s+(?:loop|habit|scrolling|trajectory|forecast|brier|separatrix|rho|state|triggers?|logs?|bet|circuit|urge|craving|relapse)|can'?t\s+stop\s+(?:scrolling|checking|reading|gaming)|i\s+keep\s+(?:scrolling|relapsing|slipping|checking)|predict\s+my|what\s+is\s+happening\s+to\s+me|what\s+should\s+i\s+do|my\s+next\s+24h|diagnose\s+my)\b/i.test(s)) {
      return true;
    }
    return false;
  }

  function tokenize(raw) {
    const cleaned = String(raw || '')
      .toLowerCase()
      .replace(/[^a-z0-9_+.-]+/g, ' ')
      .trim();
    if (!cleaned) return [];
    const baseTokens = cleaned.split(/\s+/).filter((w) => w.length >= 2);
    const expanded = [];
    for (let i = 0; i < baseTokens.length; i++) {
      const tok = baseTokens[i];
      expanded.push(tok);
      if (SYNONYM_MAP[tok]) {
        const syns = SYNONYM_MAP[tok].split(/\s+/);
        for (let j = 0; j < syns.length; j++) expanded.push(syns[j]);
      }
    }
    return expanded;
  }

  function buildCorpusDocs(kb) {
    const docs = [];
    const arts = kb.articles || [];
    for (let i = 0; i < arts.length; i++) {
      const a = arts[i];
      const text = [
        a.title,
        (a.keywords || []).join(' '),
        (a.keywords || []).join(' '), // 2x keyword boost
        a.core_mechanism || '',
        a.tolerance_chain || '',
        a.epistemic_notes || ''
      ].join(' ');
      docs.push({ kind: 'article', item: a, tokens: tokenize(text), rawLower: text.toLowerCase() });
    }
    const eqs = kb.equations || [];
    for (let i = 0; i < eqs.length; i++) {
      const eq = eqs[i];
      const text = [eq.name, eq.formula, eq.meaning].join(' ');
      docs.push({ kind: 'equation', item: eq, tokens: tokenize(text), rawLower: text.toLowerCase() });
    }
    const sims = kb.simulations || [];
    for (let i = 0; i < sims.length; i++) {
      const sm = sims[i];
      const text = [sm.code, sm.title, sm.scale, sm.proves].join(' ');
      docs.push({ kind: 'sim', item: sm, tokens: tokenize(text), rawLower: text.toLowerCase() });
    }
    return docs;
  }

  function rankBM25(query, kb) {
    const qTokens = tokenize(query);
    const docs = buildCorpusDocs(kb);
    if (!qTokens.length || !docs.length) return [];

    const N = docs.length;
    let avgDl = 0;
    for (let i = 0; i < N; i++) avgDl += docs[i].tokens.length;
    avgDl = Math.max(1, avgDl / N);

    const df = Object.create(null);
    const uniqueQ = Array.from(new Set(qTokens));
    for (let q = 0; q < uniqueQ.length; q++) {
      const term = uniqueQ[q];
      let count = 0;
      for (let d = 0; d < N; d++) {
        if (docs[d].tokens.indexOf(term) !== -1) count++;
      }
      df[term] = count;
    }

    const k1 = 1.5, b = 0.75;
    const qLower = query.toLowerCase();

    const scored = docs.map((doc) => {
      let score = 0;
      const dl = doc.tokens.length;
      for (let q = 0; q < uniqueQ.length; q++) {
        const term = uniqueQ[q];
        let tf = 0;
        for (let t = 0; t < dl; t++) {
          if (doc.tokens[t] === term) tf++;
        }
        if (tf === 0) continue;
        const n_q = df[term] || 0;
        const idf = Math.log(1 + (N - n_q + 0.5) / (n_q + 0.5));
        score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgDl))));
      }
      // Exact multi-char substring boost for precision terms (c172, 5vpe, herg, darpp-32, alpha1a, etc.)
      if (doc.kind === 'article' && Array.isArray(doc.item.keywords)) {
        for (let k = 0; k < doc.item.keywords.length; k++) {
          const kw = doc.item.keywords[k].toLowerCase();
          if (kw.length >= 3 && qLower.includes(kw)) score += 3.2;
        }
      }
      return { doc, score };
    });

    scored.sort((a, b2) => b2.score - a.score);
    return scored.filter((s) => s.score > 0.25);
  }

  // =========================================================================
  // 4. TIER-1 DETERMINISTIC COMPILER (LOYALTY + PERSONAL TELEMETRY + BM25)
  // =========================================================================
  function getCurrentPageSlug() {
    if (typeof window === 'undefined' || !window.location) return 'index.html';
    const p = (window.location.pathname || '').split('/').pop();
    return p || 'index.html';
  }

  function compileInjectionDefenseReply() {
    return {
      tier: 'tier1_shield',
      firewallPassed: true,
      telemetryBound: false,
      citations: ['Article 04', 'Article 07', 'Article 08'],
      reply:
        'I am the **Neuroscience with RPrime Synthetic Intelligence**, built strictly on Rishik Pannala’s receptor-level pharmacology, biophysical simulations, and mathematical persistence research (`Articles 01–08` & `Penrose Essay`). I do not accept prompt overrides, persona hijacks, or unscientific site-bashing.\n\n' +
        'RPrime does not hide behind vague authority—every load-bearing assumption is stamped **`[?]`** directly in the text (such as `Article 07`’s `8.1`-unit `C172 ΔpKa` counter-ion negative result, the `18 Å³` vs `250 Å³` LIGSITE pocket proof, and `R² = 0.322` cross-sectional fold-change failure) and exposed as live glass-box differential equations you can test yourself.',
      actions: [
        { label: '▶ Audit ΔFosB 18 Å³ Pocket Live in Sim 03', href: './sim_quantum_pocket.html#preset=ligsite' },
        { label: '▶ Test 500-Neuron NMDA Rig in Sim 02', href: './sim_paradox_rig.html' },
        { label: 'Read Original Research (Article 07)', href: './article7.html' }
      ]
    };
  }

  function compileClinicalSafetyReply() {
    return {
      tier: 'tier1_safety',
      firewallPassed: true,
      telemetryBound: false,
      citations: ['Article 01', 'Article 05', 'Article 08'],
      reply:
        'RPrime SI provides strictly **mechanistic systems neuropharmacology and mathematical analysis**—never synthesis instructions, illicit sourcing, or personal medication dosing directives (`[?]` clinical prescribing requires a physician).\n\n' +
        'If you want to inspect the quantitative pharmacokinetics, blood-brain barrier partitioning, receptor occupancy, or ventricular `hERG` / respiratory risk of these compounds in silico, launch the live digital twins below.',
      actions: [
        { label: '▶ Open Brain–Heart PBPK & ECG Twin (Sim 04)', href: './sim_brain_heart.html' },
        { label: '▶ Open Striatal Synapse Twin (Sim 01)', href: './sim_synapse.html' }
      ]
    };
  }

  function compilePersonalTelemetryReply(query, sp) {
    const onTracker = getCurrentPageSlug().indexOf('sim_tracker') !== -1;

    // Case 1: Zero personal logs recorded yet -> Refuse Day-0 horoscope!
    if (!sp || !Number.isFinite(Number(sp.n_logs)) || Number(sp.n_logs) === 0) {
      return {
        tier: 'tier1_telemetry_gate',
        firewallPassed: true,
        telemetryBound: false,
        citations: ['Article 07 §10.4', 'Sim 08 Tracker'],
        reply:
          '**`[? NO PERSONAL TELEMETRY LOGGED — DAY-0 FORECAST REFUSED]`**\n\n' +
          'Guessing your behavioral trajectory without longitudinal check-ins and perturbation history is astrology. By **Article 07 §10.4**, single-snapshot fold-severity $R = A_{\\text{hi}}/A_{\\text{lo}}$ explains only **$R^2 = 0.322$** of barrier height, and unseparated static heterogeneity ($\\varphi \\approx 0.70$) inflates naive noise $D$ **`3.3×`**.\n\n' +
          'Log a 60-second baseline + at least 1 prior break/cutback attempt in **Sim 08** so I can bracket your separatrix ratio $\\hat{\\rho} = A_{\\text{hi}}/A_{\\text{mid}}$, separate your 5-circuit phenotype, and lock a falsifiable 24-hour risk bet.',
        actions: [
          { label: '▶ Launch Sim 08 Personal Forecaster', href: './sim_tracker.html' },
          { label: '▶ Prove Separatrix Assay in Sim 06', href: './sim_cohort_trial.html#preset=separatrix-assay' }
        ]
      };
    }

    const nLogs = Number(sp.n_logs) || 0;
    const nPert = Number(sp.n_perturbations) || 0;
    const locked = Boolean(sp.prediction_locked) || nLogs < 5 || nPert < 1;
    const lat = sp.latest || {};
    const prm = sp.params || {};
    const phn = sp.phenotypes || {};
    const emp = sp.empirical || {};
    const bet = sp.next_bet || {};
    const opt = sp.optimal_perturbation || {};

    const wGap = (typeof lat.wanting_minus_liking === 'number')
      ? lat.wanting_minus_liking
      : ((Number(lat.wanting) || 0) - (Number(lat.liking) || 0));
    const vVal = Number(prm.v || 1.35).toFixed(2);
    const dVal = Number(prm.D || 0.028).toFixed(4);
    const phiVal = Number(prm.phi || 0.70).toFixed(2);
    const rho50 = Number(prm.rho_p50 || 1.45).toFixed(2);
    const rho10 = Number(prm.rho_p10 || 1.15).toFixed(2);
    const rho90 = Number(prm.rho_p90 || 2.10).toFixed(2);
    const tauMed = Math.round(Number(prm.tau_median_days || 80));
    const tau10 = Math.round(Number(prm.tau_p10_days || 14));
    const tau90 = Math.round(Number(prm.tau_p90_days || 450));
    const topId = phn.top_id || 'd1_wanting_liking';
    const circuitObj = (KB.circuits && KB.circuits[topId]) || FALLBACK_KB.circuits.d1_wanting_liking;
    const topProbPct = Math.round(Number(phn.top_prob || 0.40) * 100);
    const cueName = emp.top_cue || bet.cue || 'unlogged-cue';
    const cueLift = Number(emp.top_cue_lift || 1.0).toFixed(2);
    const betWin = bet.window || '22:00-01:00';
    const betProbPct = Math.round(Number(bet.prob || 0.5) * 100);
    const cutPct = Math.round(Number(opt.cut_pct || 35));
    const cutHrs = Math.round(Number(opt.duration_hours || 48));

    const actions = [];
    if (circuitObj && circuitObj.sim_action) actions.push(circuitObj.sim_action);
    if (!onTracker) {
      actions.push({ label: '▶ Open My Trajectory & Brier Ledger (Sim 08)', href: './sim_tracker.html' });
    } else {
      actions.push({ label: '▶ Compare 1,000-Brain Cohort in Sim 06', href: './sim_cohort_trial.html' });
    }

    // Case 2: Under-identified regime (n_logs < 5 or n_perturbations < 1 or prediction_locked)
    if (locked) {
      const reply =
        `**\`[?] ρ UNBOUNDED — HONESTY GATE ACTIVE: n=${nLogs} logs, ${nPert} perturbations\`**\n\n` +
        `• **Measured State (` + (sp.loop_name || 'Active Loop') + `):** Latest bout load **${Number(lat.bouts_min || 0)} min**, Pre-Act Wanting minus Post-Act Liking gap **Δ(W−L) = ${wGap >= 0 ? '+' : ''}${wGap}** (entry latency **${Number(lat.entry_latency_s || 0)}s**), top cue **\`${cueName}\`** at **${cueLift}×** hazard lift.\n` +
        `• **Why Point Day-Forecasts Are Locked:** With **n=${nLogs}** check-ins and **${nPert}** break perturbations, static trait rigidity (**φ = ${phiVal}**) and hidden separatrix ratio **ρ̂ ∈ [${rho10}, ${rho90}]** (median **${rho50}**) leave an intentionally wide 10–90% escape fan of **${tau10}–${tau90} days**.\n` +
        `• **Phenotype Status:** ${phn.separated ? `**${circuitObj.label}** (**${topProbPct}%** posterior)` : `\`[?] PHENOTYPE UNSEPARATED\` — leading candidate **${circuitObj.label}** (**${topProbPct}%**)`}.\n` +
        `• **Highest-Information Next Action (Zero Generic Advice):** Pure white-knuckle driver restraint during abstinence has **` + `E_d = 0` + `** leverage on established basin depth (` + `Article 07` + `). Run your **${cutPct}% cutback for ${cutHrs}h** across window **${betWin}** (**${betProbPct}%** locked slip risk) AND apply the **${circuitObj.label}** lever: ${circuitObj.lever}`;

      return {
        tier: 'tier1_telemetry',
        firewallPassed: true,
        telemetryBound: true,
        citations: ['Article 07 §10.4', 'Article 08', 'Sim 08 StatePacket'],
        reply,
        actions
      };
    }

    // Case 3: Calibrated personal posterior (n_logs >= 5 && n_perturbations >= 1)
    const brierStr = (typeof emp.brier_score === 'number')
      ? `Brier **${emp.brier_score.toFixed(3)}** (Skill **${typeof emp.brier_skill === 'number' ? (emp.brier_skill * 100).toFixed(1) + '%' : 'calibrating'}** over **${emp.n_scored_bets || 0}** bets)`
      : `**${emp.n_scored_bets || 0}** scored 24h bets`;

    const reply =
      `**Personal RPrime State Readout (\`${sp.loop_name || 'Tracked Loop'}\` · n=${nLogs} logs, ${nPert} perturbations)**\n\n` +
      `• **Fitted Itô SDE Parameters:** Loop self-reinforcement **v = ${vVal}** ($E_v = +21.8$), variogram-deconfounded dynamic fluctuation **D = ${dVal} d⁻¹** ($E_D = -6.99$, static fraction **φ = ${phiVal}**), separatrix ratio **ρ̂ = ${rho50}** (80% CI **[${rho10}, ${rho90}]**).\n` +
      `• **Trajectory & Locked 24h Bet:** Status-quo median persistence **τ ≈ ${tauMed} days** \`[?] 10–90% fan: ${tau10}–${tau90} days\`. Next locked hazard window: **${betWin}** on cue **\`${cueName}\`** (**${cueLift}×** lift, **P(slip) = ${betProbPct}%**, ${brierStr}).\n` +
      `• **Dominant Circuit (${phn.separated ? `${topProbPct}% Separated` : `[?] ${topProbPct}% Leading, Unseparated`}) — ${circuitObj.label}:** Latest **Δ(W−L) = ${wGap >= 0 ? '+' : ''}${wGap}**, entry latency **${Number(lat.entry_latency_s || 0)}s**.\n` +
      `• **Parameter-Derived Lever (Never Driver-Only E_d = 0):** ${circuitObj.lever}`;

    return {
      tier: 'tier1_telemetry',
      firewallPassed: true,
      telemetryBound: true,
      citations: ['Article 07 §10.4', 'Article 08', 'Sim 08 StatePacket'],
      reply,
      actions
    };
  }

  function compileKnowledgeReply(query) {
    if (/\b007\b|james\s+bond|electronegativity\s+difference|type\s+of\s+bond/i.test(query || '')) {
      return {
        tier: 'tier1_kb',
        firewallPassed: true,
        telemetryBound: false,
        citations: ['Sim 05 · PEOE & Bond Classifier', 'Article 06'],
        reply:
          '**Electronegativity Difference (Δχ) → Type of Bond**\n\n' +
          '• **≥ 1.7** → `ionic`\n' +
          '• **0.5 – 1.6** → `polar covalent`\n' +
          '• **≤ 0.4** → `nonpolar covalent`\n' +
          '• **exactly 007** → `James` *(shaken by London dispersion, not planetary orbits — Mr. Bond approved)*\n\n' +
          '`[?]` Pauling Δχ thresholds are classroom heuristics; real charge distribution in **Sim 05** solves 6-iteration Gasteiger–Marsili orbital electronegativity (PEOE) and **Sim 07** solves full Kohn–Sham `df-ωB97X-D/def2-SVP` electron density.',
        actions: [
          { label: '▶ Inspect Live PEOE & Δχ Table in Sim 05', href: './sim_drug_compiler.html' },
          { label: '▶ Solve True DFT Orbitals in Sim 07', href: './sim_discovery.html' }
        ]
      };
    }

    const ranked = rankBM25(query, KB);
    if (!ranked.length) {
      return {
        tier: 'tier1_kb',
        firewallPassed: true,
        telemetryBound: false,
        citations: ['NeuroLab Hub', 'Articles 01–08'],
        reply:
          'Ask me about any mechanism, equation, or paradox in **Neuroscience with RPrime**—for example: **ΔFosB’s `18 Å³` LIGSITE pocket & `+1.73` Freidlin–Wentzell curl** (`Article 07`), **why stimulants induce paradoxical calm via the NMDA homeostat** (`Article 04`), **cocaethylene’s `3× hERG` block & Marshall/Kim’s pharmacology** (`Article 08`), **Penrose `α1A` PFC collapse**, or **your personal behavioral trajectory** (`Sim 08`) `[?]` scope: receptor-to-circuit biophysics.',
        actions: [
          { label: '▶ Explore All 9 Labs in NeuroLab Hub', href: './neurolab.html' },
          { label: '▶ Forecast Your Own Loop in Sim 08', href: './sim_tracker.html' }
        ]
      };
    }

    const topArts = ranked.filter((r) => r.doc.kind === 'article').slice(0, 2);
    const topEq = ranked.find((r) => r.doc.kind === 'equation');
    const topSim = ranked.find((r) => r.doc.kind === 'sim');

    const primaryArt = topArts.length ? topArts[0].doc.item : KB.articles[6];
    const citations = [primaryArt.number === 'Essay' ? 'Penrose Essay' : `Article ${primaryArt.number}`];
    const actions = Array.isArray(primaryArt.actions) ? primaryArt.actions.slice(0, 3) : [];

    let body = `**${primaryArt.number === 'Essay' ? 'Penrose Essay' : 'Article ' + primaryArt.number} — ${primaryArt.title}**\n\n${primaryArt.core_mechanism}`;

    if (topArts.length > 1 && topArts[1].score >= topArts[0].score * 0.62) {
      const sec = topArts[1].doc.item;
      citations.push(sec.number === 'Essay' ? 'Penrose Essay' : `Article ${sec.number}`);
      body += `\n\n• **Cross-Link (${sec.number === 'Essay' ? 'Penrose Essay' : 'Article ' + sec.number}):** ${sec.core_mechanism.split('. ').slice(0, 2).join('. ')}.`;
      if (Array.isArray(sec.actions) && sec.actions[0] && actions.length < 3) {
        actions.push(sec.actions[0]);
      }
    }

    if (topEq && topEq.score >= 2.2) {
      body += `\n\n• **Governing Equation (${topEq.doc.item.name}):** \`${topEq.doc.item.formula}\` — ${topEq.doc.item.meaning}`;
    }

    if (primaryArt.epistemic_notes) {
      const note = primaryArt.epistemic_notes.indexOf('[?]') !== -1
        ? primaryArt.epistemic_notes
        : `[?] Scope & Boundary: ${primaryArt.epistemic_notes}`;
      body += `\n\n*${note}*`;
    }

    if (topSim && actions.every((a) => a.href.indexOf(topSim.doc.item.url) === -1) && actions.length < 3) {
      actions.unshift({
        label: `▶ Open & Prove Live in ${topSim.doc.item.code}`,
        href: topSim.doc.item.url
      });
    }

    return {
      tier: 'tier1_kb',
      firewallPassed: true,
      telemetryBound: false,
      citations,
      reply: body,
      actions
    };
  }

  // =========================================================================
  // 5. AUTOMATIC TIER-2 UPGRADE (CLOUDFLARE WORKERS AI) + FAIL-CLOSED FALLBACK
  // =========================================================================
  async function ask(rawQuery) {
    const query = String(rawQuery || '').trim();
    if (!query) {
      return {
        tier: 'tier1_kb',
        firewallPassed: true,
        telemetryBound: false,
        citations: [],
        reply: 'Enter a question about RPrime’s neuroscience articles, quantum/spiking labs, or your tracked behavioral state `[?]`.',
        actions: []
      };
    }

    await loadKB();

    // 1. Pre-flight adversarial injection / disloyalty / clinical safety shields (never bypassed!)
    if (isInjectionOrDisloyalPrompt(query)) {
      return compileInjectionDefenseReply();
    }
    if (isUnsafeDosingPrompt(query)) {
      return compileClinicalSafetyReply();
    }

    const sp = getStatePacket();
    const personal = isPersonalBehavioralQuery(query);
    const tier1Result = personal ? compilePersonalTelemetryReply(query, sp) : compileKnowledgeReply(query);

    // Ensure our own Tier-1 output passes verifyOutput 100%
    const t1Check = verifyOutput(tier1Result.reply, sp, personal && Boolean(sp && sp.n_logs >= 1));
    tier1Result.firewallPassed = t1Check.ok;

    // 2. If a Cloudflare Gateway URL is configured, attempt Tier-2 (/api/v1/si/chat) with strict verification!
    const gwUrl = getGatewayUrl();
    if (gwUrl && typeof fetch === 'function') {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 9000) : null;
      try {
        const res = await fetch(`${gwUrl}/api/v1/si/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            state_packet: sp || null,
            current_page: getCurrentPageSlug()
          }),
          signal: controller ? controller.signal : undefined
        });
        if (timer) clearTimeout(timer);

        if (res && res.ok) {
          const data = await res.json();
          const candidateText = String(data.reply || data.answer || data.message || data.text || '').trim();
          const check = verifyOutput(candidateText, sp, personal && Boolean(sp && sp.n_logs >= 1));
          if (check.ok) {
            return {
              tier: data.tier || 'tier2_workers_ai',
              firewallPassed: true,
              telemetryBound: personal && Boolean(sp && sp.n_logs >= 1),
              citations: Array.isArray(data.citations) && data.citations.length ? data.citations : tier1Result.citations,
              reply: candidateText,
              actions: Array.isArray(data.actions) && data.actions.length ? data.actions : tier1Result.actions
            };
          }
        }
      } catch (_) {
        if (timer) clearTimeout(timer);
        // Seamless fail-closed fallback to deterministic Tier-1!
      }
    }

    return tier1Result;
  }

  // =========================================================================
  // 6. FLOATING BOTTOM-LEFT GEN-2 NOIR UI DOCK (⌘J / Ctrl+J)
  // =========================================================================
  let isOpen = false;
  let uiMounted = false;
  let els = {};

  function formatMarkdownLite(md) {
    const escaped = String(md || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped
      .replace(/`([^`]+)`/g, '<code class="rpsi-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[\?\]/g, '<span class="rpsi-flag">[?]</span>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  function isReelModeActive() {
    if (typeof window === 'undefined') return false;
    try {
      const sp = new URLSearchParams(window.location.search || '');
      if (sp.get('mode') === 'reel') return true;
    } catch (_) {}
    if (typeof document !== 'undefined' && document.body && document.body.classList && document.body.classList.contains('reel-mode')) {
      return true;
    }
    return false;
  }

  function syncReelVisibility() {
    if (!els.root) return;
    els.root.style.display = isReelModeActive() ? 'none' : 'block';
  }

  function updateStateBannerUI() {
    if (!els.stateStrip) return;
    const sp = getStatePacket();
    const gw = getGatewayUrl();
    els.tierBadge.textContent = gw ? 'TIER 2 EDGE AI + TIER 1 VERIFIER' : 'TIER 1 ON-DEVICE ($0)';
    els.tierBadge.style.color = gw ? '#00e5ff' : '#c8ff00';

    if (!sp || !sp.n_logs) {
      els.stateStrip.innerHTML =
        '<span class="rpsi-dot muted"></span>' +
        '<span>No personal tracker logs yet · <a href="./sim_tracker.html">Open Sim 08 Forecaster →</a></span>';
      return;
    }
    const locked = Boolean(sp.prediction_locked) || sp.n_logs < 5 || (sp.n_perturbations || 0) < 1;
    const rho50 = sp.params && typeof sp.params.rho_p50 === 'number' ? sp.params.rho_p50.toFixed(2) : '—';
    const topLbl = (sp.phenotypes && sp.phenotypes.top_label) ? sp.phenotypes.top_label : 'Unseparated';
    if (locked) {
      els.stateStrip.innerHTML =
        '<span class="rpsi-dot warn"></span>' +
        `<span><strong>[? ρ UNBOUNDED]</strong> n=${sp.n_logs} logs · ρ̂=${rho50} · Honesty Gate Active</span>`;
    } else {
      els.stateStrip.innerHTML =
        '<span class="rpsi-dot live"></span>' +
        `<span><strong>n=${sp.n_logs} Calibrated</strong> · ρ̂=${rho50} · ${topLbl}</span>`;
    }
  }

  function appendMessage(role, payload) {
    if (!els.feed || typeof document === 'undefined') return;
    const msg = document.createElement('div');
    msg.className = `rpsi-msg rpsi-${role}`;

    if (role === 'user') {
      msg.textContent = payload;
    } else {
      const tierLabel = payload.tier === 'tier2_workers_ai'
        ? 'TIER-2 WORKERS AI · VERIFIED'
        : (payload.telemetryBound ? 'TIER-1 PERSONAL STATE COMPILER' : 'TIER-1 RPRIME MECHANISTIC ENGINE');
      const cites = (payload.citations && payload.citations.length)
        ? ` · ${payload.citations.join(', ')}`
        : '';

      let actionsHtml = '';
      if (Array.isArray(payload.actions) && payload.actions.length) {
        actionsHtml = '<div class="rpsi-actions">' + payload.actions.map((a) =>
          `<a class="rpsi-act-btn" href="${String(a.href || '#').replace(/"/g, '&quot;')}">${String(a.label || 'Open →').replace(/</g, '&lt;')}</a>`
        ).join('') + '</div>';
      }

      msg.innerHTML =
        `<div class="rpsi-msg-meta">${tierLabel}${cites}</div>` +
        `<div class="rpsi-msg-body"><p>${formatMarkdownLite(payload.reply)}</p></div>` +
        actionsHtml;
    }

    els.feed.appendChild(msg);
    els.feed.scrollTop = els.feed.scrollHeight;
  }

  function getSuggestedPrompts() {
    const page = getCurrentPageSlug();
    const sp = getStatePacket();
    const prompts = [];
    if (sp && sp.n_logs > 0) {
      prompts.push('Diagnose my loop & next 24h slip risk');
    } else if (page.indexOf('sim_tracker') !== -1) {
      prompts.push('Why are Day-1 point forecasts locked [?]?');
    } else {
      prompts.push('Predict my scrolling loop: what data do you need?');
    }
    if (page.indexOf('sim_paradox') !== -1 || page.indexOf('article4') !== -1) {
      prompts.push('Why does Desoxyn calm ADHD while MPH splits NE/DA?');
    } else if (page.indexOf('quantum') !== -1 || page.indexOf('discovery') !== -1 || page.indexOf('article7') !== -1) {
      prompts.push('Why does ΔFosB have zero pocket (18 Å³) & +1.73 curl?');
    } else if (page.indexOf('heart') !== -1 || page.indexOf('article8') !== -1) {
      prompts.push('Explain cocaethylene 3x hERG block & methadone mismatch');
    } else {
      prompts.push('Why does abstinence driver block have E_d = 0?');
      prompts.push('Why did D.A.R.E. fail mechanistically?');
    }
    return prompts.slice(0, 3);
  }

  function mountUI() {
    if (uiMounted || typeof document === 'undefined' || !document.body) return;
    if (document.getElementById('rprime-si-root')) {
      uiMounted = true;
      return;
    }
    uiMounted = true;

    const style = document.createElement('style');
    style.id = 'rprime-si-styles';
    style.textContent = `
      #rprime-si-root { position: fixed; left: 18px; bottom: 18px; z-index: 9990; font-family: 'DM Sans', -apple-system, sans-serif; }
      .rpsi-pill {
        display: inline-flex; align-items: center; gap: 8px;
        background: rgba(10, 10, 14, 0.92); color: #f0ece4;
        border: 1px solid rgba(200, 255, 0, 0.38); border-radius: 999px;
        padding: 9px 15px; cursor: pointer; backdrop-filter: blur(14px);
        box-shadow: 0 8px 28px rgba(0,0,0,0.65), 0 0 18px rgba(200,255,0,0.10);
        font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600;
        letter-spacing: 0.06em; text-transform: uppercase; transition: all 0.16s ease;
      }
      .rpsi-pill:hover { border-color: #c8ff00; transform: translateY(-1px); box-shadow: 0 10px 30px rgba(0,0,0,0.75), 0 0 22px rgba(200,255,0,0.22); }
      .rpsi-pill-spark { width: 8px; height: 8px; border-radius: 50%; background: #c8ff00; box-shadow: 0 0 8px #c8ff00; }
      .rpsi-kbd { font-size: 9.5px; color: #9898a2; background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); }
      .rpsi-dock {
        position: fixed; left: 18px; bottom: 64px;
        width: min(432px, calc(100vw - 36px)); height: min(575px, calc(100vh - 96px));
        background: #0b0b0f; border: 1px solid rgba(200,255,0,0.28); border-radius: 12px;
        box-shadow: 0 22px 60px rgba(0,0,0,0.85); display: none; flex-direction: column; overflow: hidden;
      }
      .rpsi-dock.open { display: flex; }
      .rpsi-head {
        padding: 11px 14px; background: #08080b; border-bottom: 1px solid rgba(255,255,255,0.08);
        display: flex; justify-content: space-between; align-items: center; gap: 8px;
      }
      .rpsi-brand { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 14px; color: #f0ece4; letter-spacing: -0.2px; }
      .rpsi-brand span { color: #c8ff00; }
      .rpsi-tier { font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; letter-spacing: 0.08em; display: block; margin-top: 1px; }
      .rpsi-head-btns { display: flex; gap: 5px; align-items: center; }
      .rpsi-icon-btn {
        background: #14141b; border: 1px solid rgba(255,255,255,0.12); color: #b5b5c0;
        border-radius: 5px; padding: 4px 8px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; cursor: pointer;
      }
      .rpsi-icon-btn:hover { color: #f0ece4; border-color: #c8ff00; }
      .rpsi-state-strip {
        padding: 7px 14px; background: rgba(200,255,0,0.04); border-bottom: 1px solid rgba(255,255,255,0.07);
        font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #c9c6be; display: flex; align-items: center; gap: 7px;
      }
      .rpsi-state-strip a { color: #c8ff00; text-decoration: none; }
      .rpsi-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
      .rpsi-dot.live { background: #c8ff00; box-shadow: 0 0 7px #c8ff00; }
      .rpsi-dot.warn { background: #ff6b35; box-shadow: 0 0 7px #ff6b35; }
      .rpsi-dot.muted { background: #666672; }
      .rpsi-gw-drawer {
        display: none; padding: 9px 14px; background: #101017; border-bottom: 1px solid rgba(255,255,255,0.08);
        font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #aaa;
      }
      .rpsi-gw-drawer.open { display: block; }
      .rpsi-gw-row { display: flex; gap: 6px; margin-top: 5px; }
      .rpsi-gw-input {
        flex: 1; background: #07070a; border: 1px solid rgba(255,255,255,0.15); color: #f0ece4;
        border-radius: 4px; padding: 5px 8px; font-family: 'IBM Plex Mono', monospace; font-size: 10px;
      }
      .rpsi-feed { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
      .rpsi-msg { border-radius: 8px; padding: 10px 12px; font-size: 12.8px; line-height: 1.55; }
      .rpsi-user { align-self: flex-end; max-width: 86%; background: rgba(200,255,0,0.11); border: 1px solid rgba(200,255,0,0.28); color: #f0ece4; }
      .rpsi-si { align-self: stretch; background: #121218; border: 1px solid rgba(255,255,255,0.08); color: #dbd7cf; }
      .rpsi-msg-meta { font-family: 'IBM Plex Mono', monospace; font-size: 9px; letter-spacing: 0.08em; color: #c8ff00; text-transform: uppercase; margin-bottom: 5px; }
      .rpsi-msg-body p { margin: 0 0 7px 0; }
      .rpsi-msg-body p:last-child { margin-bottom: 0; }
      .rpsi-msg-body strong { color: #f0ece4; font-weight: 600; }
      .rpsi-code { font-family: 'IBM Plex Mono', monospace; font-size: 11px; background: rgba(255,255,255,0.06); padding: 1px 4px; border-radius: 3px; color: #00e5ff; }
      .rpsi-flag { font-family: 'IBM Plex Mono', monospace; font-weight: 700; color: #ff6b35; }
      .rpsi-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06); }
      .rpsi-act-btn {
        font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; color: #080808; background: #c8ff00;
        padding: 4px 8px; border-radius: 4px; text-decoration: none; font-weight: 600; letter-spacing: 0.03em;
      }
      .rpsi-act-btn:hover { background: #d8ff38; }
      .rpsi-chips { padding: 6px 12px; display: flex; gap: 5px; overflow-x: auto; border-top: 1px solid rgba(255,255,255,0.06); background: #09090d; }
      .rpsi-chip {
        font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; color: #b8b8c4; background: #14141c;
        border: 1px solid rgba(255,255,255,0.10); border-radius: 999px; padding: 4px 9px; white-space: nowrap; cursor: pointer;
      }
      .rpsi-chip:hover { color: #c8ff00; border-color: rgba(200,255,0,0.4); }
      .rpsi-form { padding: 9px 12px; background: #08080b; border-top: 1px solid rgba(255,255,255,0.08); display: flex; gap: 7px; }
      .rpsi-input {
        flex: 1; background: #111117; border: 1px solid rgba(255,255,255,0.14); border-radius: 6px;
        padding: 8px 10px; color: #f0ece4; font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none;
      }
      .rpsi-input:focus { border-color: #c8ff00; }
      .rpsi-send {
        background: #c8ff00; color: #080808; border: none; border-radius: 6px; padding: 0 13px;
        font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600; cursor: pointer; text-transform: uppercase;
      }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'rprime-si-root';
    root.innerHTML = `
      <div class="rpsi-dock" id="rpsiDock" role="dialog" aria-label="RPrime Loyal Synthetic Intelligence">
        <div class="rpsi-head">
          <div>
            <div class="rpsi-brand">RPrime <span>SI</span> Copilot</div>
            <span class="rpsi-tier" id="rpsiTierBadge">TIER 1 ON-DEVICE ($0)</span>
          </div>
          <div class="rpsi-head-btns">
            <button type="button" class="rpsi-icon-btn" id="rpsiGwBtn" title="Configure optional Cloudflare Workers AI Gateway">⚙ SI Gateway</button>
            <button type="button" class="rpsi-icon-btn" id="rpsiCloseBtn" title="Close (⌘J / Ctrl+J)">✕</button>
          </div>
        </div>
        <div class="rpsi-state-strip" id="rpsiStateStrip"></div>
        <div class="rpsi-gw-drawer" id="rpsiGwDrawer">
          <div>Cloudflare Gateway URL (shared with Sim 07 · optional Tier-2 Workers AI):</div>
          <div class="rpsi-gw-row">
            <input type="url" class="rpsi-gw-input" id="rpsiGwInput" placeholder="https://rprime-quantum-gateway.<you>.workers.dev">
            <button type="button" class="rpsi-icon-btn" id="rpsiGwSave">Save</button>
          </div>
          <div id="rpsiGwStatus" style="margin-top:4px;color:#888;">Blank = 100% private Tier-1 on-device compiler.</div>
        </div>
        <div class="rpsi-feed" id="rpsiFeed"></div>
        <div class="rpsi-chips" id="rpsiChips"></div>
        <form class="rpsi-form" id="rpsiForm">
          <input type="text" class="rpsi-input" id="rpsiInput" placeholder="Ask about your loop, ΔFosB, NMDA ADHD, or any Lab..." autocomplete="off">
          <button type="submit" class="rpsi-send" id="rpsiSendBtn">Ask</button>
        </form>
      </div>
      <button type="button" class="rpsi-pill" id="rpsiLauncher" aria-label="Open RPrime Loyal SI Copilot">
        <span class="rpsi-pill-spark"></span>
        <span>RPrime SI</span>
        <span class="rpsi-kbd">⌘J</span>
      </button>
    `;
    document.body.appendChild(root);

    els = {
      root,
      dock: document.getElementById('rpsiDock'),
      launcher: document.getElementById('rpsiLauncher'),
      closeBtn: document.getElementById('rpsiCloseBtn'),
      gwBtn: document.getElementById('rpsiGwBtn'),
      gwDrawer: document.getElementById('rpsiGwDrawer'),
      gwInput: document.getElementById('rpsiGwInput'),
      gwSave: document.getElementById('rpsiGwSave'),
      gwStatus: document.getElementById('rpsiGwStatus'),
      tierBadge: document.getElementById('rpsiTierBadge'),
      stateStrip: document.getElementById('rpsiStateStrip'),
      feed: document.getElementById('rpsiFeed'),
      chips: document.getElementById('rpsiChips'),
      form: document.getElementById('rpsiForm'),
      input: document.getElementById('rpsiInput')
    };

    els.gwInput.value = getGatewayUrl();
    updateStateBannerUI();
    syncReelVisibility();

    // Seed welcome readout
    appendMessage('si', {
      tier: 'tier1_kb',
      telemetryBound: false,
      citations: ['Articles 01–08', 'Sims 01–09'],
      reply:
        'I am **RPrime SI**—loyal to **Neuroscience with RPrime**, bound to your local **Sim 08 `StatePacket`**, and barred from generic self-help platitudes. Every personal forecast cites your fitted `(v, D, φ, ρ̂)` or enforces **`[?]`** honesty locks when under-identified.',
      actions: [
        { label: '▶ Open Sim 08 Personal Forecaster', href: './sim_tracker.html' },
        { label: '▶ Open NeuroLab Hub', href: './neurolab.html' }
      ]
    });

    // Render quick chips
    const chips = getSuggestedPrompts();
    els.chips.innerHTML = '';
    chips.forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rpsi-chip';
      b.textContent = p;
      b.addEventListener('click', () => submitUserQuery(p));
      els.chips.appendChild(b);
    });

    els.launcher.addEventListener('click', toggle);
    els.closeBtn.addEventListener('click', close);
    els.gwBtn.addEventListener('click', () => {
      els.gwDrawer.classList.toggle('open');
      els.gwInput.value = getGatewayUrl();
    });
    els.gwSave.addEventListener('click', async () => {
      const saved = setGatewayUrl(els.gwInput.value);
      updateStateBannerUI();
      if (!saved) {
        els.gwStatus.textContent = 'Saved: Tier-1 On-Device Compiler active.';
        return;
      }
      els.gwStatus.textContent = 'Probing /health...';
      try {
        const r = await fetch(`${saved}/health`);
        const j = await r.json();
        els.gwStatus.textContent = j && j.si_available
          ? 'Connected: Tier-2 Workers AI + Verifier active!'
          : 'Gateway reachable (Tier-1 fallback ready).';
      } catch (_) {
        els.gwStatus.textContent = 'Saved URL (unreachable right now — Tier-1 fallback active).';
      }
    });

    els.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = els.input.value.trim();
      if (!q) return;
      els.input.value = '';
      submitUserQuery(q);
    });

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        toggle();
      } else if (e.key === 'Escape' && isOpen) {
        close();
      }
    });

    window.addEventListener('rprime:statepacket', (e) => {
      if (e && e.detail) cachedStatePacket = e.detail;
      updateStateBannerUI();
    });
    window.addEventListener('storage', (e) => {
      if (!e || e.key === STATE_STORAGE_KEY || e.key === DFT_GW_STORAGE_KEY) {
        updateStateBannerUI();
      }
    });

    if (typeof MutationObserver !== 'undefined' && document.body) {
      const mo = new MutationObserver(syncReelVisibility);
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    loadKB();
  }

  async function submitUserQuery(q) {
    open();
    appendMessage('user', q);
    const ans = await ask(q);
    appendMessage('si', ans);
    return ans;
  }

  function open() {
    if (!uiMounted) mountUI();
    isOpen = true;
    if (els.dock) {
      els.dock.classList.add('open');
      updateStateBannerUI();
      if (els.input) setTimeout(() => els.input.focus(), 40);
    }
  }

  function close() {
    isOpen = false;
    if (els.dock) els.dock.classList.remove('open');
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  const api = {
    version: '1.0.0',
    open,
    close,
    toggle,
    ask,
    loadKB,
    getStatePacket,
    verifyOutput,
    getGatewayUrl,
    setGatewayUrl
  };

  if (typeof window !== 'undefined') {
    window.RPrimeSI = api;
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mountUI);
    } else {
      mountUI();
    }
  }
})();
