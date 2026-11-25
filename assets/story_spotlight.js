(() => {
  'use strict';

  // =========================================================================
  // RPRIME STORY-TO-MECHANISM SPOTLIGHT ENGINE
  // Maps intense clinical/historical stories & facts from ALL 9 articles
  // directly to the live biophysical components inside Simulations 01-07.
  // Zero modifications to any article HTML files.
  // =========================================================================

  const ARTICLES = [
    { id: 'art01', num: '01', short: 'Art. 01 · Methamphetamine', title: 'Article 01 — Methamphetamine', href: '/article1.html', accent: '#c8ff00' },
    { id: 'art02', num: '02', short: 'Art. 02 · CV Paradox', title: 'Article 02 — Why Meth Is Safer Than Adderall (CV)', href: '/article2.html', accent: '#00e5ff' },
    { id: 'art03', num: '03', short: 'Art. 03 · Dopamine Trap', title: 'Article 03 — Dopamine & Permanent Tolerance', href: '/article3.html', accent: '#c8ff00' },
    { id: 'art04', num: '04', short: 'Art. 04 · ADHD NMDA Model', title: 'Article 04 — The Standard ADHD Model Is Incomplete', href: '/article4.html', accent: '#00e5ff' },
    { id: 'art05', num: '05', short: 'Art. 05 · Four Good Days', title: 'Article 05 — Four Good Days (Molly)', href: '/article5.html', accent: '#ff6b35' },
    { id: 'art06', num: '06', short: 'Art. 06 · Quantum Pharm', title: 'Article 06 — Why We Need Quantum Neuropharmacology', href: '/article6.html', accent: '#9b88ff' },
    { id: 'art07', num: '07', short: 'Art. 07 · ΔFosB Rent', title: 'Article 07 — ΔFosB Does Not Save Energy. It Charges Rent.', href: '/article7.html', accent: '#9b88ff' },
    { id: 'art08', num: '08', short: 'Art. 08 · Marshall & Kim', title: 'Article 08 — Marshall & Kim: What the Pills Left Behind', href: '/article8.html', accent: '#ff6b35' },
    { id: 'penrose', num: 'P', short: 'Essay · Penrose Addiction', title: 'Essay — Nobel Laureate Narcissism & Compulsion', href: '/penrose_article.html', accent: '#f59e0b' }
  ];

  const SIM_LABELS = {
    'sim_synapse.html': 'Sim 01 · Synapse → Genome',
    'sim_paradox_rig.html': 'Sim 02 · Paradox Patch-Clamp',
    'sim_quantum_pocket.html': 'Sim 03 · Quantum Pocket Lab',
    'sim_brain_heart.html': 'Sim 04 · Brain-Heart Telemetry',
    'sim_drug_compiler.html': 'Sim 05 · De Novo Drug Compiler',
    'sim_cohort_trial.html': 'Sim 06 · 1,000-Brain Trial',
    'sim_discovery.html': 'Sim 07 · Discovery OS (230k PDB)'
  };

  function clickSel(sel) {
    const el = document.querySelector(sel);
    if (el) { el.click(); return true; }
    return false;
  }

  function clickOnclick(substr) {
    const els = document.querySelectorAll('button[onclick]');
    for (let i = 0; i < els.length; i++) {
      const oc = els[i].getAttribute('onclick') || '';
      if (oc.includes(substr)) {
        els[i].click();
        return true;
      }
    }
    return false;
  }

  function clickByText(tag, substr) {
    const els = document.querySelectorAll(tag);
    for (let i = 0; i < els.length; i++) {
      if ((els[i].textContent || '').toLowerCase().includes(substr.toLowerCase())) {
        els[i].click();
        return true;
      }
    }
    return false;
  }

  function setSlider(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = String(val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const STORIES = [
    // ================= ARTICLE 01: METHAMPHETAMINE =================
    {
      id: 'a01-vmat2-smoking',
      articleId: 'art01',
      sim: 'sim_synapse.html',
      title: 'Smoking Crystal Meth vs. Oral Desoxyn: Why Rapid High Doses Destroy Terminals',
      fact: 'Article 01 distinguishes oral therapeutic Desoxyn (smooth DAT reversal) from smoked/injected crystal meth, which collapses vesicular storage and damages dopaminergic terminals.',
      pinTag: 'VMAT2 H+ collapse & cytosolic ROS',
      reasonHeadline: 'This part was the reason rapid smoking/injection causes dopaminergic neurotoxicity while low oral doses do not.',
      reasonPoint: 'Look at the presynaptic vesicle (VMAT2 ΔpH) and cytosolic ROS surge inside the live Striatal Synapse canvas.',
      mechanism: 'At rapid high concentrations, lipophilic methamphetamine alkalizes the vesicular proton (H+) gradient across VMAT2, dumping vesicular dopamine straight into the cytosol without a Ca2+ signal. Unprotected cytosolic dopamine auto-oxidizes into reactive oxygen species (ROS) while reversed DAT floods the cleft—an abuse-only cascade absent at therapeutic oral doses.',
      targetSelector: '#synapseCanvas',
      trigger: () => { clickSel('[data-preset="vmat2"]'); }
    },
    {
      id: 'a01-hitler-tolerance',
      articleId: 'art01',
      sim: 'sim_synapse.html',
      title: '1960s Methedrine Tolerance & Historical Amphetamine Collapse (Thr75 Switch)',
      fact: 'Article 01 traces amphetamine from Benzedrine and Hitler\'s final-years parkinsonian tremors to 1960s Methedrine tolerance—showing how chronic D1 bombardment systematically shuts itself off.',
      pinTag: 'CDK5 → Thr75 DARPP-32 brake',
      reasonHeadline: 'This part was the reason chronic stimulant exposure progressively blunts D1 signaling even when dopamine is still present.',
      reasonPoint: 'Look at the DARPP-32 Thr34 vs. Thr75 / ΔFosB transcriptional clock plot as Thr75 climbs over Thr34.',
      mechanism: 'Repeated D1 activation drives PKA → phospho-CREB → FosB transcription. Truncated ΔFosB accumulates and binds the CDK5 promoter. CDK5 phosphorylates DARPP-32 at Threonine-75, flipping DARPP-32 from a PKA amplifier into a PKA inhibitor so Thr34 falls and PP1 runs unchecked—while GRK2/β-arrestin internalizes surface D1 receptors.',
      targetSelector: '#clockCanvas',
      trigger: () => { clickSel('[data-preset="holiday"]'); }
    },
    {
      id: 'a01-nmethyl-bbb',
      articleId: 'art01',
      sim: 'sim_drug_compiler.html',
      title: 'One N-Methyl Group (-NHCH₃): Why Methamphetamine Crosses the BBB 5× Cleaner',
      fact: 'Article 01 explains that adding a single CH₃ group to amphetamine\'s amine backbone increases lipophilicity, drives ~5× stronger central dopamine release, and lowers peripheral side effects.',
      pinTag: 'N-methyl swap boosts CNS Kp,uu',
      reasonHeadline: 'This part was the reason one extra carbon atom shifts the drug out of the periphery and into the brain.',
      reasonPoint: 'Inspect the 2D Kekulé atom editor and the live BBB / CNS Kp,uu badge comparing D-Amphetamine (-NH₂) vs. Desoxyn (-NHCH₃).',
      mechanism: 'Methylating the primary amine removes one hydrogen-bond donor, lowers Ertl TPSA, and increases Crippen cLogP into the optimal passive-diffusion window. More dose partitions across the blood-brain barrier into central DAT terminals instead of lingering in peripheral sympathetic vasculature.',
      targetSelector: '#molCanvas',
      trigger: () => { clickSel('button[onclick*="amphetamine-vs-desoxyn"]'); }
    },
    {
      id: 'a01-adderall-levo',
      articleId: 'art01',
      sim: 'sim_brain_heart.html',
      title: 'Why Adderall (3:1 D:L Salts) Hits Harder Peripherally Than Dexedrine or Desoxyn',
      fact: 'Article 01 notes Adderall\'s 25% levoamphetamine drives stronger peripheral norepinephrine release, explaining why patients report sharper cardiovascular jitters and rougher wear-off than pure d-amphetamine or Desoxyn.',
      pinTag: 'Peripheral NE & cardiac β1 drive',
      reasonHeadline: 'This part was the reason Adderall produces stronger tachycardia, muscle strain, and vasoconstriction at equivalent central focus.',
      reasonPoint: 'Watch the Brain vs. Heart autonomic organ gauge and Heart Rate card climb under Adderall\'s peripheral NET bias.',
      mechanism: 'Lower lipophilicity keeps more amphetamine outside the BBB, and levoamphetamine preferentially triggers peripheral norepinephrine efflux via NET. Circulating NE directly activates cardiac β1-adrenoceptors (tachycardia) and vascular α1-receptors (vasoconstriction & blood pressure spikes).',
      targetSelector: '#organCanvas',
      trigger: () => { clickSel('button[onclick="loadPreset(2)"]'); }
    },

    // ================= ARTICLE 02: WHY METH IS SAFER CV =================
    {
      id: 'a02-cv-paradox',
      articleId: 'art02',
      sim: 'sim_brain_heart.html',
      title: 'The Schedule II Cardiovascular Paradox: Therapeutic Desoxyn vs. Adderall',
      fact: 'Article 02 argues that setting addiction aside, therapeutic methamphetamine (FDA-approved for severe ADHD in children >6) has a cleaner cardiovascular profile than Adderall.',
      pinTag: 'Lower SNS & cleaner ECG load',
      reasonHeadline: 'This part was the reason therapeutic methamphetamine causes less cardiac strain than equivalent Adderall.',
      reasonPoint: 'Compare the live 18-cell transmural ECG waveform and Heart Rate / BP telemetry when toggling Adderall vs. Desoxyn.',
      mechanism: 'Methamphetamine\'s N-methyl group shifts distribution centrally across the BBB with higher relative DAT/DA selectivity, whereas amphetamine stays more peripheral and releases far more norepinephrine—directly driving sympathetic heart rate, hyperthermia, and vasoconstriction.',
      targetSelector: '#ecgCanvas',
      trigger: () => { clickSel('button[onclick="loadPreset(2)"]'); }
    },
    {
      id: 'a02-hour6-metabolite',
      articleId: 'art02',
      sim: 'sim_brain_heart.html',
      title: 'The Hour-6 Heart-Rate Surge ("Not Withdrawal — It\'s the 15–30% Amphetamine Metabolite")',
      fact: 'Article 02 highlights a hidden metabolic twist: 15–30% of methamphetamine is metabolized into amphetamine, causing delayed cardiovascular stimulation hours after the clean peak fades.',
      pinTag: 'CYP2D6 T+6h amphetamine surge',
      reasonHeadline: 'This part was the reason patients suddenly feel wired and tachycardic 6 hours after taking methamphetamine.',
      reasonPoint: 'Look at the two-compartment PK curve crossing T+6.0h as the CYP2D6 amphetamine metabolite curve rises past the parent peak.',
      mechanism: 'Hepatic CYP2D6 N-demethylates 15–30% of circulating methamphetamine into amphetamine. As parent meth clears, the accumulating amphetamine metabolite shifts the ratio toward peripheral norepinephrine release and sympathetic β1/α1 cardiac stimulation—mimicking a late "crash" or anxiety wave.',
      targetSelector: '#pkCanvas',
      trigger: () => {
        clickSel('button[onclick="loadPreset(3)"]');
        setTimeout(() => clickSel('button[onclick="onScrubTime(360)"]'), 80);
      }
    },
    {
      id: 'a02-crawl-out-skin',
      articleId: 'art02',
      sim: 'sim_paradox_rig.html',
      title: '"Crawl Out of Your Own Skin": Why Severe ADHD Causes Agonizing Agitation & Collapse Sleep',
      fact: 'Article 02 quotes the terror of severe treatment-resistant ADHD: "A stress so horrifying you want to crawl out of your own skin... before you collapse mentally."',
      pinTag: 'Maladaptive NMDA firing storm',
      reasonHeadline: 'This part was the reason severely dopamine-deficient brains feel hyper-agitated rather than simply sleepy.',
      reasonPoint: 'Watch the live 50 µs Hodgkin–Huxley patch-clamp membrane trace and Akathisia/Agitation bar erupt into erratic bursting.',
      mechanism: 'When prefrontal/NAc catecholamine release is severely impaired (η_rel = 18%), excitatory glutamate (NMDA) ramps up maladaptively to force dopamine output. Without intact DA release, that excess glutamate only floods Layer III pyramidal neurons with chaotic excitatory noise—pushing the patient toward excitotoxic exhaustion and protective collapse sleep.',
      targetSelector: '#patchCanvas',
      trigger: () => { clickSel('[data-preset="adhd"]'); }
    },
    {
      id: 'a02-paradox-calm',
      articleId: 'art02',
      sim: 'sim_paradox_rig.html',
      title: 'Why a Stimulant Calms Severe ADHD Instead of Exciting It',
      fact: 'Article 02 explains the clinical paradox: in severe NMDA-compensated ADHD, releasing stimulants quiet agitation, restore sleep, and bring calm clarity with minimal euphoria.',
      pinTag: 'DA restore shuts off Glu noise',
      reasonHeadline: 'This part was the reason giving a powerful stimulant slows the patient down and restores sharp executive focus.',
      reasonPoint: 'Watch the 200-neuron Layer III PFC spike raster lock into a crisp, quiet memory stripe as SNR jumps.',
      mechanism: 'DAT reversal restores tonic synaptic dopamine and moderate NE. Because the underlying catecholamine deficit is finally satisfied, compensatory NMDA glutamate overdrive switches off—collapsing background PFC noise while moderate NE locks high-affinity α2A receptors to close HCN leak channels.',
      targetSelector: '#rasterCanvas',
      trigger: () => { clickSel('[data-preset="desoxyn"]'); }
    },

    // ================= ARTICLE 03: DOPAMINE =================
    {
      id: 'a03-b6-ldopa-bbb',
      articleId: 'art03',
      sim: 'sim_drug_compiler.html',
      title: 'Tyrosine → L-DOPA → (AADC + Vitamin B6) → Dopamine: Why Pure Dopamine Hits a Wall',
      fact: 'Article 03 explains why Vitamin B6 is clinically given for antipsychotic akathisia and why Parkinson\'s requires L-DOPA rather than dopamine itself.',
      pinTag: 'Catechol BBB block vs LAT1 rescue',
      reasonHeadline: 'This part was the reason dopamine cannot enter the brain from blood—and why L-DOPA uses a molecular Trojan horse.',
      reasonPoint: 'Look at the BBB Kp,uu badge and Pfizer CNS MPO radar on Dopamine vs. L-DOPA (click Flip Pair to watch LAT1 unlock).',
      mechanism: 'Dopamine\'s two polar catechol hydroxyls and protonated amine give it poor passive BBB permeability (-98% blocked). Adding the α-carboxyl group turns it into L-DOPA, which the endothelial LAT1 neutral amino-acid transporter actively shuttles into the brain—where AADC + Vitamin B6 (PLP) decarboxylate it into active dopamine.',
      targetSelector: '#hudBbbBadge',
      trigger: () => { clickSel('button[onclick*="ldopa-lat1-rescue"]'); }
    },
    {
      id: 'a03-2600-percent',
      articleId: 'art03',
      sim: 'sim_synapse.html',
      title: 'Orgasm (200%) vs. Cocaine (300–500%) vs. Meth (2,600%): Breaking Every Natural Brake',
      fact: 'Article 03 contrasts natural rewards (200%) and cocaine reuptake blockade (300–500%) with methamphetamine\'s 2,600% surge that triggers the VTA→NAc to dorsal-striatum shift.',
      pinTag: '2,600% cleft flood bypasses D2 brake',
      reasonHeadline: 'This part was the reason methamphetamine hijacks the reward-to-habit circuit far beyond any natural stimulus.',
      reasonPoint: 'Watch synaptic [DA] spike off-scale inside the live Synapse Cleft while D2 autoreceptor Ca2+ braking becomes helpless.',
      mechanism: 'Normally D2 autoreceptors sense extracellular dopamine and clamp presynaptic Ca2+ influx to cap vesicular fusion. By collapsing VMAT2 storage and running DAT in reverse, high-dose methamphetamine pumps dopamine out completely independent of action potentials or D2 braking—driving NMDA-dependent plasticity from NAc reward into compulsive dorsal-striatal habit.',
      targetSelector: '#phaseBadge',
      trigger: () => { clickSel('[data-preset="vmat2"]'); }
    },
    {
      id: 'a03-thr34-mice',
      articleId: 'art03',
      sim: 'sim_synapse.html',
      title: 'Why Health Class "Just Quit" Fails: The Thr34/Thr75 Switch Proven in Knockout Mice',
      fact: 'Article 03 cites mice with compromised DARPP-32 Thr34 phosphorylation losing their amphetamine response—proving the brain dismantles the machinery that made the drug work.',
      pinTag: 'Thr34 suppressed → PP1 unchecked',
      reasonHeadline: 'This part was the reason the drug stops working—not from "willpower," but because your neuron rewired its kinase/phosphatase balance.',
      reasonPoint: 'Inspect the Thr34/Thr75 conversion readout and watch PP1 activity climb as ΔFosB and CDK5 lock in.',
      mechanism: 'PKA normally phosphorylates DARPP-32 at Thr34 to inhibit Protein Phosphatase-1 (PP1), keeping D1 signaling loud. Chronic ΔFosB elevates CDK5, which phosphorylates Thr75 instead—inhibiting PKA, shutting down Thr34, and unleashing PP1 to strip phosphates off synaptic receptors and ion channels.',
      targetSelector: '#conversionBadge',
      trigger: () => { clickSel('[data-preset="holiday"]'); }
    },
    {
      id: 'a03-akathisia-ssri',
      articleId: 'art03',
      sim: 'sim_paradox_rig.html',
      title: 'Antipsychotic Akathisia & Why SSRIs (Zoloft) Take Weeks to Work',
      fact: 'Article 03 shows how D2 blockade triggers severe inner restlessness (akathisia), and why SSRIs use the exact same GRK2/β-arrestin downregulation machinery—in reverse—over weeks.',
      pinTag: 'D2 block & GPCR autoreceptor lag',
      reasonHeadline: 'This part was the reason D2 antagonists trigger agonizing restlessness and why Zoloft stalls until 5-HT1A autoreceptors internalize.',
      reasonPoint: 'Watch the FSCV monoamine telemetry and diagnostic readout under iatrogenic D2 blockade / autoreceptor feedback.',
      mechanism: 'Antipsychotics antagonize D2 receptors, starving dopaminergic signaling and driving restless psychomotor distress (which Vitamin B6 helps by supporting AADC dopamine synthesis). Likewise, acutely blocking SERT with an SSRI triggers presynaptic 5-HT1A autoreceptors that brake serotonin release—until weeks of GRK2/β-arrestin endocytosis internalize those brakes.',
      targetSelector: '#fscvCanvas',
      trigger: () => { clickSel('[data-preset="akathisia"]'); }
    },

    // ================= ARTICLE 04: ADHD NMDA MODEL =================
    {
      id: 'a04-mph-split',
      articleId: 'art04',
      sim: 'sim_paradox_rig.html',
      title: 'The Documented Case: Why Methylphenidate Caused Physical Calm Yet Anger & Agitation',
      fact: 'Article 04 documents a patient who became physically calm on methylphenidate yet simultaneously more agitated, angry, and depressed—while amphetamines brought profound relief.',
      pinTag: 'NDRI split: high NE, starved DA',
      reasonHeadline: 'This part was the reason methylphenidate can physically sedate a severe ADHD patient while worsening rage and mental agitation.',
      reasonPoint: 'Inspect the Diagnosis Box and watch the Agitation bar stay elevated even as motor drive slows under Methylphenidate.',
      mechanism: 'Methylphenidate is an NDRI—it only blocks reuptake and has stronger NET affinity than DAT releasing power. If a neuron cannot release enough dopamine in the first place (low η_rel), blocking reuptake cannot build enough DA to silence compensatory NMDA glutamate, while excess NE fuels irritability and emotional dysregulation.',
      targetSelector: '#diagBox',
      trigger: () => { clickSel('[data-preset="mph"]'); }
    },
    {
      id: 'a04-benzo-trap',
      articleId: 'art04',
      sim: 'sim_paradox_rig.html',
      title: 'Why Not Benzodiazepines? Silencing Protective NMDA Crashes BP & Executive Function',
      fact: 'Article 04 explains why GABAergic sedatives fail severe ADHD: NMDA overdrive is the only thing preventing severe lethargy and hypotension in a catecholamine-starved brain.',
      pinTag: 'GABA clamp kills BP & cognition',
      reasonHeadline: 'This part was the reason benzodiazepines leave these patients calm yet nonfunctional, hypotensive, and severely hypersomnolent.',
      reasonPoint: 'Watch the Blood Pressure (BP) and Executive Function bars collapse as GABA-A potentiation clamps the network.',
      mechanism: 'Maladaptive NMDA hyperactivity is a crude defense against catastrophic catecholamine deficit. Potentiating GABA-A chloride influx globally suppresses that compensatory arousal without restoring dopamine or norepinephrine—eliminating agitation only by crashing blood pressure, wakefulness, and prefrontal execution.',
      targetSelector: '#bpBar',
      trigger: () => { clickSel('[data-preset="benzo"]'); }
    },
    {
      id: 'a04-amantadine-dual',
      articleId: 'art04',
      sim: 'sim_paradox_rig.html',
      title: 'Amantadine + Stimulant: Why Mild NMDA Blockade Alone Isn\'t Enough',
      fact: 'Article 04 explains why amantadine avoids benzo-style sedation and fights tolerance, yet still needs a releasing stimulant to restore motivation and cognition.',
      pinTag: 'Dual-arm Glu quiet + DA restore',
      reasonHeadline: 'This part was the reason pairing gentle NMDA open-channel blockade with a stimulant solves both halves of the pathology.',
      reasonPoint: 'Look at the PFC/NAc Connectome flow and SNR meter stabilizing cleanly under Amantadine + Stimulant.',
      mechanism: 'Unlike ketamine or benzodiazepines, amantadine mildly antagonizes pathological NMDA hyperactivation without collapsing global inhibitory tone—quieting glutamate noise and blunting NMDA-driven tolerance—while the stimulant supplies the missing vesicular/DAT catecholamine signal required for executive function.',
      targetSelector: '#connectomeCanvas',
      trigger: () => { clickSel('[data-preset="amantadine"]'); }
    },
    {
      id: 'a04-rct-illusion',
      articleId: 'art04',
      sim: 'sim_cohort_trial.html',
      title: 'Why Most Diagnosed "ADHD" Responds Opposite: The Unstratified Clinical Trial Illusion',
      fact: 'Article 04 argues that pooling true NMDA-compensated ADHD (calmed by stimulants) with misdiagnosed/neurotypical brains (energized by stimulants) hides two opposite populations.',
      pinTag: 'Bimodal truth hidden by group mean',
      reasonHeadline: 'This part was the reason standard ADHD trials miss the paradoxical calming signature of true NMDA-compensated pathology.',
      reasonPoint: 'Look at the Stratified vs. Unstratified RCT distribution plot separating the calming subtype from energized responders.',
      mechanism: 'When an unstratified cohort mixes low-release NMDA-hypercompensated patients (where stimulants lower arousal and noise) with standard/neurotypical brains (where stimulants boost arousal), the pooled average washes out both tails into a misleading moderate effect—obscuring the diagnostic calming signature.',
      targetSelector: '#rctDistCanvas',
      trigger: () => { clickSel('[data-preset="adhd-rct-illusion"]'); }
    },
    {
      id: 'a04-mdd-distinction',
      articleId: 'art04',
      sim: 'sim_cohort_trial.html',
      title: 'The MDD Comparison: Low Dopamine Without NMDA Overdrive Causes Fatigue, Not Hyperactivity',
      fact: 'Article 04 distinguishes Major Depressive Disorder (low DA without glutamate compensation, energized by bupropion) from true ADHD (calmed by stimulants across every class).',
      pinTag: 'No Glu compensation = MDD apathy',
      reasonHeadline: 'This part was the reason low dopamine by itself produces apathy and fatigue—and why stimulants energize MDD instead of calming it.',
      reasonPoint: 'Inspect individual patient response profiles across psychiatric subtypes in the 1,000-Brain Cohort Inspector.',
      mechanism: 'Without compensatory NMDA hyperexcitability, a dopamine deficit manifests as anhedonia, low energy, and low blood pressure; raising catecholamines restores energy. Only when maladaptive glutamate noise drives baseline psychomotor agitation does restoring DA/NE produce paradoxical calm.',
      targetSelector: '#patientInspectorPanel',
      trigger: () => { clickSel('[data-preset="ssri-bipolar-trap"]'); }
    },

    // ================= ARTICLE 05: FOUR GOOD DAYS (MOLLY) =================
    {
      id: 'a05-molly-75-oxy',
      articleId: 'art05',
      sim: 'sim_quantum_pocket.html',
      title: '75 OxyContin Pills at Age 17: How MOR Silences Pain & Anxiety While Flooding Reward',
      fact: 'Article 05 opens with Molly—given 75 OxyContin pills for a waterskiing knee sprain at 17—showing how MOR simultaneously kills pain, silences Locus Coeruleus fear, and disinhibits VTA dopamine.',
      pinTag: 'MOR Gi activation & GABA disinhibition',
      reasonHeadline: 'This part was the reason a teenage knee injury prescription hijacked Molly\'s pain, anxiety, and reward circuitry all at once.',
      reasonPoint: 'Inspect the 3D Mu-Opioid Receptor (5C1M active vs. 4DKL inactive) and the Cheng–Prusoff occupancy / TM6 activation plot.',
      mechanism: 'OxyContin binds MOR (no MOR sits directly on VTA dopamine neurons—only on inhibitory GABA interneurons and LC norepinephrine terminals). Gi signaling suppresses cAMP/PKA nociceptor sensitization and Substance P, silences LC norepinephrine anxiety, and opens GIRK K+ channels on GABA interneurons to release a massive flood of NAc dopamine.',
      targetSelector: '#molCanvas',
      trigger: () => { clickOnclick("applyPreset('mor_quantum')"); }
    },
    {
      id: 'a05-detox-hell',
      articleId: 'art05',
      sim: 'sim_synapse.html',
      title: 'Shivering Outside Mom\'s Door & The 3-Day Detox Ward: cAMP Rebound + KOR "The Devil"',
      fact: 'Article 05 details Molly shaking in hot/cold flashes outside her mother\'s kitchen and raging in detox—explaining "her brain damage is not because of heroin; it\'s her brain\'s adaptation to heroin."',
      pinTag: 'Unmasked cAMP + Thr75 + KOR crash',
      reasonHeadline: 'This part was the reason stopping heroin plunges the brain into agonizing pain, severe insomnia, and black dysphoria.',
      reasonPoint: 'Look at the electrophysiology crash and live diagnostic banner showing downregulated receptor gain and unchecked phosphatase braking.',
      mechanism: 'Chronic MOR inhibition causes GRK2/β-arrestin-2 receptor internalization and compensatory cAMP superactivation. When heroin leaves, hyperactive cAMP/PKA explodes unopposed, suppressing GIRK, driving CREB → CDK5 → DARPP-32 Thr75 dopamine suppression, and upregulating prodynorphin to fire lateral habenula KOR ("the devil" anti-reward circuit).',
      targetSelector: '#ephysCanvas',
      trigger: () => { clickSel('[data-preset="holiday"]'); }
    },
    {
      id: 'a05-naltrexone-lie',
      articleId: 'art05',
      sim: 'sim_drug_compiler.html',
      title: 'Why Molly Faked a Phone Call to Dodge the 30-Day Naltrexone Shot (TM6 Allyl Jam)',
      fact: 'Article 05 describes Molly lying to her mother to postpone the long-acting naltrexone injection—terrified of precipitated withdrawal if any opioid remained on her receptors.',
      pinTag: 'N-allyl sterically jams MOR Trp293',
      reasonHeadline: 'This part was the reason naltrexone/naloxone strips even fentanyl off MOR without activating it—causing instant violent withdrawal if taken too early.',
      reasonPoint: 'Compare Morphine vs. Naloxone/Naltrexone in the 2D Compiler (click Flip Pair) and watch the Brain MOR signaling readout drop to zero.',
      mechanism: 'Replacing the N-methyl group with a bulky N-allyl (or cyclopropylmethyl on naltrexone) creates a steric wedge against MOR Trp293 and Transmembrane Helix 6. It binds with higher affinity than heroin or fentanyl while locking the receptor inactive—instantly unmasking cAMP/KOR withdrawal if the patient isn\'t 7+ days opioid-free.',
      targetSelector: '#brainCanvas',
      trigger: () => { clickSel('button[onclick*="morphine-vs-naloxone"]'); }
    },
    {
      id: 'a05-methadone-fentanyl-pk',
      articleId: 'art05',
      sim: 'sim_brain_heart.html',
      title: 'Why Lipophilic Methadone Traps Patients Longer & Why Naloxone Wears Off Too Fast',
      fact: 'Article 05 critiques methadone\'s 24–36h fat-tissue accumulation on already-downregulated MORs, creating more unpredictable, prolonged withdrawal than heroin itself.',
      pinTag: 'PK mismatch & renarcotization window',
      reasonHeadline: 'This part was the reason lipophilic opioids outlast short-acting blockers and linger in fat stores far past the subjective high.',
      reasonPoint: 'Watch the PK concentration overlay and Respiratory Drive card show fast antagonist decay against slow lipophilic opioid clearance.',
      mechanism: 'Highly lipophilic MOR agonists partition deeply into adipose and lipid compartments, creating multi-day terminal elimination tails. When a short-acting blocker clears—or when methadone is stopped—the prolonged receptor exposure leaves deep MOR downregulation and unpredictable withdrawal/renarcotization windows.',
      targetSelector: '#cardResp',
      trigger: () => { clickSel('button[onclick="loadPreset(6)"]'); }
    },
    {
      id: 'a05-15-relapses-racc',
      articleId: 'art05',
      sim: 'sim_cohort_trial.html',
      title: '15 Relapses, rACC Anosognosia ("I Won\'t Break") & Why GRK2 Blockers Only Last Days',
      fact: 'Article 05 shows why <30% stay sober at 10–30 years, why Molly relapsed 15 times, why rat GRK2 inhibitors failed by day 20, and why "unbreakable confidence" signals rACC gray-matter damage.',
      pinTag: 'Single-arm block fails (E_d ≡ 0)',
      reasonHeadline: 'This part was the reason blocking just one upstream arm—or counting clean days alone—cannot collapse a multi-arm adapted loop.',
      reasonPoint: 'Compare the Kaplan–Meier abstinence survival curve (grey, E_d ≡ 0) against directly weakening the maintenance loop v (-10.6%).',
      mechanism: 'Chronic heroin shrinks rACC gray matter (breaking the error-detection alarm into anosognosia) and strips 31–35% of striatal DAT while shifting glutamatergic control from NAc to dorsal-striatal autopilot. Because tolerance runs across layered transcriptional and synaptic loops, blocking a single upstream arm (GRK2 or receptor blockade) leaves the core attractor intact.',
      targetSelector: '#kmCanvas',
      trigger: () => { clickSel('[data-preset="abstinence-vs-loopv"]'); }
    },

    // ================= ARTICLE 06: QUANTUM NEUROPHARMACOLOGY =================
    {
      id: 'a06-bohr-dispersion',
      articleId: 'art06',
      sim: 'sim_quantum_pocket.html',
      title: 'Why Classical Chemistry Cannot Exist: 10⁻¹¹ s Collapse & Quantum London Dispersion',
      fact: 'Article 06 demolishes the textbook octet/planetary-orbit model: classical electrons would spiral into the nucleus in 10⁻¹¹ s, and without quantum electron clouds, cell membranes and vesicles could never form.',
      pinTag: 'Quantum clouds drive dispersion & binding',
      reasonHeadline: 'This part was the reason "lock-and-key" geometry alone fails to explain how Desoxyn, opioids, or even your lipid membranes work.',
      reasonPoint: 'Inspect the 3D quantum orbital clouds and steric-electronic receptor interface inside the Quantum Pocket viewport.',
      mechanism: 'Phospholipid bilayers and synaptic vesicles depend on London dispersion forces born from instantaneous quantum fluctuations of electron probability clouds—impossible in fixed planetary orbits. Likewise, high-affinity receptor recognition depends on quantum electrostatics and frontier orbital overlap, not rigid billiard-ball shapes.',
      targetSelector: '#canvasHudTl',
      trigger: () => { clickOnclick("applyPreset('mor_quantum')"); }
    },
    {
      id: 'a06-backwards-bike-pkmz',
      articleId: 'art06',
      sim: 'sim_synapse.html',
      title: 'Mr. Bond\'s Backwards Bike & PKMζ: The Neuroscience of Why Unlearning Is So Hard',
      fact: 'Article 06 recalls Mr. Bond\'s backwards bike to explain why unlearning school-taught planetary atoms is a biological battle against consolidated synaptic geometry.',
      pinTag: 'Ca2+ LTP + PKMζ locks prior schemas',
      reasonHeadline: 'This part was the reason wrong models learned early feel effortless while true quantum mechanics feels mentally resisted.',
      reasonPoint: 'Watch the naive phasic Ca2+ / AMPA dendritic spine potentiation mechanism in the live Striatal/Synaptic Spine canvas.',
      mechanism: 'Repeated firing drives Ca2+ influx through synaptic channels, physically embedding additional glutamatergic AMPA receptors into the postsynaptic spine membrane (Long-Term Potentiation). The persistently active kinase PKMζ then maintains that enlarged spine geometry, making overwriting a consolidated misconception physically expensive.',
      targetSelector: '#synapseCanvas',
      trigger: () => { clickSel('[data-preset="naive"]'); }
    },
    {
      id: 'a06-fmo-discovery',
      articleId: 'art06',
      sim: 'sim_discovery.html',
      title: 'Frontier Molecular Orbitals (HOMO/LUMO & Fukui f+): Rational Drug Design Before Synthesis',
      fact: 'Article 06 promises the shift from trial-and-error to predicting exact electron density and reactive centers before ever synthesizing a molecule.',
      pinTag: 'True df-ωB97X-D HOMO/LUMO orbitals',
      reasonHeadline: 'This part was the reason quantum neuropharmacology can predict which exact atom reacts with a target protein before a chemist touches a flask.',
      reasonPoint: 'View the volumetric HOMO/LUMO isosurface clouds and Fukui f+ / ΔE_cov readout inside RPrime Discovery OS.',
      mechanism: 'Kohn–Sham DFT (df-ωB97X-D/def2-SVP + ddCOSMO water) solves the electron density directly, mapping the LUMO acceptor lobes, Parr electrophilicity ω = μ²/2η, and atom-condensed electrophilic Fukui index f_A+ to pinpoint exact nucleophilic attack sites on covalent CNS warheads.',
      targetSelector: '#canvas3d',
      trigger: () => {
        clickOnclick("loadPDB('5VPE')");
        setTimeout(() => {
          clickOnclick("selectLigandPreset('phenacyl')");
          clickSel('#vmOrbital');
        }, 120);
      }
    },

    // ================= ARTICLE 07: ΔFOSB CHARGES RENT =================
    {
      id: 'a07-no-pocket-18a3',
      articleId: 'art07',
      sim: 'sim_quantum_pocket.html',
      title: 'There Is No Pocket (18 Å³ vs. 368 Å³): The Verdict That Kills Classical ΔFosB Docking',
      fact: 'Article 07 ran Hendlich LIGSITE across every frame of a 10 ns MD trajectory: HIV-1 protease (1HSG) recovered 368 Å³, while ΔFosB/JunD stayed at 18 Å³ static and peaked at only 173 Å³ (6.64 ns)—never crossing the 250 Å³ druggability line.',
      pinTag: '18 Å³ static · 0/40 frames reach 250 Å³',
      reasonHeadline: 'This part was the reason conventional non-covalent drug discovery fails on ΔFosB—and why the leucine zipper is a dead end.',
      reasonPoint: 'Inspect the 10 ns LIGSITE cavity trajectory chart comparing ΔFosB\'s 18 Å³ / 173 Å³ peak against the 250 Å³ threshold and 368 Å³ 1HSG control.',
      mechanism: 'The ΔFosB/JunD DNA interface is a 1,524 Å² flat protein–protein-interaction surface with zero enclosed pocket, and the rigid leucine zipper makes zero DNA contacts. The sole transient 173 Å³ cavity at 6.64 ns opens right over the C172/C285 redox switch—proving ΔFosB is a covalent-only target.',
      targetSelector: '#plotCanvas',
      trigger: () => { clickOnclick("applyPreset('ligsite')"); }
    },
    {
      id: 'a07-c172-surprise',
      articleId: 'art07',
      sim: 'sim_quantum_pocket.html',
      title: 'C172 Exposed, Not Activated: The 11.59 Å Closure & 8.1-Unit pKa Counter-Ion Trap',
      fact: 'Article 07 disproved the textbook prediction: despite 6 cations within 8 Å of C172 (and 0 acids), closest approach is 4.29 Å, SASA is 47.6 Å², and solvated pKa swings 8.1 units depending solely on Cl⁻ counter-ions.',
      pinTag: 'S-S 13.62→2.03 Å · normal exposed thiol',
      reasonHeadline: 'This part was the reason C172 offers accessibility rather than depressed-pKa super-nucleophilicity—forcing selectivity onto the ligand.',
      reasonPoint: 'Inspect the C172 +5 cationic cage geometry and sulfur-sulfur distance morph (13.62 Å 5VPE → 9.03 Å 7UCC → 2.03 Å 5VPB).',
      mechanism: 'Disulfide formation (1.44 kcal/mol unstrained bond) demands 11.59 Å of backbone closure, making DNA binding and oxidation geometrically mutually exclusive. Because C172 is an ordinary open-air thiol (47.6 Å² SASA) with no H-bond donor within 4 Å, warhead selectivity must be tuned down so it doesn\'t react indiscriminately across the proteome.',
      targetSelector: '#molCanvas',
      trigger: () => { clickOnclick("applyPreset('c172cage')"); }
    },
    {
      id: 'a07-mv0-trap-epoxide',
      articleId: 'art07',
      sim: 'sim_quantum_pocket.html',
      title: 'The 7UCD MV0 Crystallographic Trap & The 13 kcal/mol GFN2 Epoxide Error',
      fact: 'Article 07 caught two major traps: deposited PDB 7UCD ligand MV0 is non-electrophilic (missing its original leaving group), and GFN2-xTB underestimates epoxide ring-opening by 13 kcal/mol (-23.9 vs. -37.1 DFT).',
      pinTag: 'MV0 missing leaving group · -10 kcal/mol window',
      reasonHeadline: 'This part was the reason copying 7UCD builds inert molecules, while hot maleimides (-34.2) and epoxides (-37.1 DFT) splatter the proteome.',
      reasonPoint: 'Look at the GFN2-xTB vs. ωB97X-D/def2-SVP warhead comparison plot and the Epoxide DFT discrepancy badge.',
      mechanism: 'Because C172 is electronically unactivated, aggressive Michael acceptors (-29 to -34 kcal/mol) alkylate off-target cysteines everywhere. Mild α-haloketone phenacyls (-8 to -10 kcal/mol) sit in the goldilocks window—and require restoring the α-leaving group stripped from the crystallized 7UCD MV0 adduct.',
      targetSelector: '#epoxMetric',
      trigger: () => {
        clickOnclick("applyPreset('warhead')");
        setTimeout(() => clickOnclick("selectWarhead('mv0trap')"), 80);
      }
    },
    {
      id: 'a07-9oc3-cns-conflict',
      articleId: 'art07',
      sim: 'sim_drug_compiler.html',
      title: 'The 9OC3 Anionic Groove Conflict: Why Sulfonates & Carboxylates Fail the Brain',
      fact: 'Article 07 proves a binding-site trap no chemistry can erase: non-covalent ligands engaging the basic K171/R175/R182 groove in 9OC3 require anionic groups (TPSA 105–122 Å², ionized at pH 7.4) that cannot enter the brain.',
      pinTag: 'Covalent 5/5 CNS vs 9OC3 BBB block',
      reasonHeadline: 'This part was the reason the neutral covalent benzofuranone phenacyl beats non-covalent 9OC3 groove binders for brain exposure.',
      reasonPoint: 'Compare the Pfizer CNS MPO radar and BBB permeability when flipping between the covalent phenacyl (5/5 CNS) and the 9OC3 sulfonate.',
      mechanism: 'ΔFosB acts inside striatal neurons behind the blood-brain barrier. Any sulfonate, carboxylate, or tetrazole isostere stays negatively charged at pH 7.4 with TPSA > 105 Å², blocking passive CNS entry regardless of biochemical affinity—leaving the neutral covalent phenacyl hybrid as the surviving route.',
      targetSelector: '#mpoCanvas',
      trigger: () => { clickSel('button[onclick*="fosb-phenacyl-vs-9oc3"]'); }
    },
    {
      id: 'a07-gauss-bonnet-rent',
      articleId: 'art07',
      sim: 'sim_synapse.html',
      title: 'Gauss–Bonnet (χ = 2), Thin-Neck Willmore Energy & The 2–9 Second Metabolic Rent',
      fact: 'Article 07 proves ∫K dA = 4π is mathematically blind to spines, Willmore energy scales with spine neck radius (πL/2r), and total chromatin+spine installation (1.46×10⁹ ATP) is repaid in 2–9 seconds—then charges +2.3–9.9% ATP rent forever.',
      pinTag: '∫K dA = 4π invariant · 2–9 s repayment',
      reasonHeadline: 'This part was the reason the adapted addicted brain did NOT settle into a cheaper energy state—it pays continuous metabolic rent.',
      reasonPoint: 'Inspect the Gauss–Bonnet / Willmore topological badge and scrub Spine Neck Radius to watch bending energy diverge while χ stays pinned at 2.',
      mechanism: 'At spine scale Re ≈ 5×10⁻⁹ eliminates mechanical inertia by 14 orders of magnitude. Adding bump-like spines keeps Euler characteristic χ = 2 (canceling the saddle-splay modulus identically), while postsynaptic ionic cost climbs +1.7–7.2×10⁸ ATP/s—repaying the entire epigenetic installation cost in under 10 seconds.',
      targetSelector: '#gaussBonnetBadge',
      trigger: () => { clickSel('[data-preset="holiday"]'); }
    },
    {
      id: 'a07-curl-ed-zero',
      articleId: 'art07',
      sim: 'sim_synapse.html',
      title: 'The +1.73 Non-Zero Curl Proof: Why There Is No "Energy Well" & Why E_d ≡ 0',
      fact: 'Article 07 computes a +1.73 Freidlin–Wentzell loop residual (960× entry-to-exit asymmetry) proving no scalar potential U exists, and proves drug blockade during abstinence has exact zero elasticity (E_d ≡ 0).',
      pinTag: 'Curl +1.73 ≠ 0 · Abstinence E_d ≡ 0',
      reasonHeadline: 'This part was the reason "blocking the drug" during abstinence does zero to shorten an established state—while cutting loop v by 10.6% collapses 80 days to 1 week.',
      reasonPoint: 'Inspect the 2D Freidlin–Wentzell curl field and try dragging Abstinence Drug Blockade (0 effect) vs. snapping Loop v (-10.6%) or Noise D (+41.7%).',
      mechanism: 'Because drug drive d(t) enters additively and vanishes during abstinence (d ≡ 0), it drops identically out of the Kramers barrier ΔU—forcing E_d ≡ 0. Persistence is instead dominated by autocatalytic AMPA self-reinforcement v (+21.8 elasticity) and synaptic fluctuation noise D (-6.99 elasticity).',
      targetSelector: '#curlCanvas',
      trigger: () => { clickSel('[data-preset="futility"]'); }
    },
    {
      id: 'a07-separatrix-experiment',
      articleId: 'art07',
      sim: 'sim_cohort_trial.html',
      title: 'The Experiment Nobody Has Run: Why Fold-Change R Fails (R²=0.322) & Only Perturbation Finds ρ',
      fact: 'Article 07 shows cross-sectional AMPA fold-change R = A_hi/A_lo spans a 47,000× escape-time ambiguity, whereas separatrix distance ρ = A_hi/A_mid governs τ ∝ ρ^23.3 (R² = 0.845)—measurable only via graded knockdown perturbation.',
      pinTag: 'Graded knockdown flips across separatrix ρ',
      reasonHeadline: 'This part was the reason cross-sectional receptor measurements could never predict how long craving lasts—and how a pulse perturbation solves it.',
      reasonPoint: 'Watch the Perturbation Separatrix Assay curve flip synapses from rebound back to healthy baseline once knockdown crosses ρ.',
      mechanism: 'A synapse population sitting 2× further from its unstable separatrix persists 2^23.3 ≈ 10⁷ times longer. Transiently knocking down CP-AMPA receptors during late withdrawal and observing which brains rebound vs. collapse to control directly locates the unstable threshold A_mid and measures ρ.',
      targetSelector: '#assayCurveCanvas',
      trigger: () => { clickSel('[data-preset="separatrix-assay"]'); }
    },

    // ================= ARTICLE 08: MARSHALL & KIM =================
    {
      id: 'a08-two-hours-methadone',
      articleId: 'art08',
      sim: 'sim_brain_heart.html',
      title: 'December 2007 — "Two Hours From Dying": Methadone ("Just Like Vicodin") + 40–60 Valium',
      fact: 'Article 08 reconstructs Marshall collapsing on his bathroom floor after taking methadone pitched as "just like Vicodin, easier on your liver" atop massive Valium—equivalent to 4 bags of heroin.',
      pinTag: 'MOR pre-Bötzinger + GABA-A + QTc trap',
      reasonHeadline: 'This part was the reason redosing methadone by feel kills silently on days 2–4—and why Valium multiplies fatal overdose risk 3.86×.',
      reasonPoint: 'Look at the Respiratory Drive alarm, QTc interval risk card, and slow-clearance opioid PK curve.',
      mechanism: 'Methadone\'s 8–59 h elimination half-life vastly outlasts its 4–8 h analgesia, so redosing by subjective relief stacks lethal plasma levels over days while prolonging cardiac QTc (Torsades risk). Simultaneously, MOR activation silences brainstem pre-Bötzinger breathing rhythm & CO₂ chemoreflex while diazepam GABA-A sedation blocks hypoxic arousal (present in 74% of Australian methadone deaths).',
      targetSelector: '#cardQTc',
      trigger: () => { clickSel('button[onclick="loadPreset(6)"]'); }
    },
    {
      id: 'a08-cocaethylene-sudden-death',
      articleId: 'art08',
      sim: 'sim_brain_heart.html',
      title: 'The Tether & Cocaethylene: Why Drinking on Cocaine Multiplies Sudden Cardiac Death 18–25×',
      fact: 'Article 08 details the hepatic metabolite cocaethylene formed when cocaine meets alcohol: weaker subjective rush than cocaine alone, yet 18–25× deadlier on the heart.',
      pinTag: '3× hERG block → QTc stretch & TdP',
      reasonHeadline: 'This part was the reason combining cocaine and alcohol silently destabilizes ventricular repolarization into sudden cardiac arrest.',
      reasonPoint: 'Watch the hERG K+ Block card and 18-cell transmural ECG stretch QTc into Early Afterdepolarizations (EADs) / Torsades de Pointes.',
      mechanism: 'Alcohol blocks cocaine\'s hepatic clearance (boosting plasma cocaine) while liver carboxylesterase transesterifies cocaine into cocaethylene. Cocaethylene lasts twice as long (~2h), blocks cardiac Na+ channels harder, and blocks repolarizing hERG (IKr) K+ channels ~3× harder—stretching mid-myocardial M-cell APD90 until transmural dispersion triggers fatal arrhythmia.',
      targetSelector: '#cardHERG',
      trigger: () => { clickSel('button[onclick="loadPreset(4)"]'); }
    },
    {
      id: 'a08-cocaethylene-ester-swap',
      articleId: 'art08',
      sim: 'sim_drug_compiler.html',
      title: 'One Ethyl Ester Swap (-COOCH₃ → -COOCH₂CH₃): Removing the SERT Brake & Tripling hERG Block',
      fact: 'Article 08 notes cocaethylene holds DAT as tightly as cocaine while barely touching SERT (removing serotonin\'s brake) and hitting cardiac hERG 3× harder.',
      pinTag: 'Methyl→Ethyl swap stretches APD90',
      reasonHeadline: 'This part was the reason one tiny liver transesterification creates a molecule that is simultaneously longer-lasting and 3× more cardiotoxic.',
      reasonPoint: 'Inspect the Ventricular Action Potential canvas and Cardiac Safety HUD while flipping Cocaine ↔ Cocaethylene.',
      mechanism: 'Replacing cocaine\'s methyl ester with ethanol\'s ethyl group increases hydrophobic binding inside the cardiac hERG Kv11.1 inner pore cavity while abolishing SERT occupancy—producing a lower peak, longer plasma tail, missing serotonergic brake, and dangerous QT/APD90 prolongation.',
      targetSelector: '#heartCanvas',
      trigger: () => { clickSel('button[onclick*="cocaine-to-cocaethylene"]'); }
    },
    {
      id: 'a08-seventeen-miles-relapse',
      articleId: 'art08',
      sim: 'sim_synapse.html',
      title: '17 Miles a Day & Relapsing 3 Weeks After Nearly Dying: Same ΔFosB Counter & Cocked Pol-II',
      fact: 'Article 08 explains why nearly dying only bought Marshall 3 weeks before relapsing, why 17 miles/day of running replaced pills, and why "wanting without liking" dragged him toward pills that stopped working.',
      pinTag: 'Same ΔFosB ledger + Glu spines',
      reasonHeadline: 'This part was the reason surviving an overdose couldn\'t erase the pull—and why compulsive running logged onto the exact same protein.',
      reasonPoint: 'Inspect the Withdrawal SDE trajectory & ρ vs. R readout showing the self-sustaining CP-AMPA receptor loop after drug drive drops to zero.',
      mechanism: 'ΔFosB in D1 dynorphin striatal MSNs accumulates identically from opioids or compulsive wheel-running, represses G9a/HDAC5 to keep chromatin open, leaves RNA Pol II stalled/cocked on the Fosb promoter, and builds new glutamate-receiving dendritic spines—amplifying the urge to act while dismantling dopamine valuation.',
      targetSelector: '#sdeCanvas',
      trigger: () => { clickSel('[data-preset="futility"]'); }
    },
    {
      id: 'a08-marshall-vs-kim-tail',
      articleId: 'art08',
      sim: 'sim_cohort_trial.html',
      title: 'Same City, Heavier Load on His Side — 18 Years Sober vs. 22 Years in Courtrooms (The ρ²³ Tail)',
      fact: 'Article 08 confronts its hardest asymmetry: Marshall (40–60 Valium, 20–30 Vicodin, overdose) hit 18 years sober, while Kim (197 consecutive clean SoberLink tests in 2017!) stayed trapped 17 years past the 5-year cocaine remission median.',
      pinTag: '1% ρ shift → decades vs years',
      reasonHeadline: 'This part was the reason two people with the exact same molecular machinery—and heavier exposure on his side—landed decades apart in recovery.',
      reasonPoint: 'Watch the 1,000-Brain Cohort Kaplan–Meier tail & survival scatter showing how invisible sub-percent shifts in ρ stretch remission from 5 years to 22+ years.',
      mechanism: 'Opioid polygenic scores explain just 3.81% of variance, and drug dose during abstinence has zero elasticity (E_d ≡ 0). Because escape time follows τ ∝ ρ^23.3, an unmeasurable ~1–5% difference in an individual\'s separatrix distance ρ separates the 5-year median escape from the extreme multi-decade tail—even when a person fights hard enough to pass 197 clean tests.',
      targetSelector: '#cohortGridCanvas',
      trigger: () => { clickSel('[data-preset="marshall-kim-tail"]'); }
    },
    {
      id: 'a08-herg-7cn1-atomic',
      articleId: 'art08',
      sim: 'sim_discovery.html',
      title: 'Atomic Proof in the Protein Data Bank: Why hERG (7CN1) Traps Cocaethylene & Methadone',
      fact: 'Article 08 links both Kim\'s cocaethylene risk and Marshall\'s methadone overdose to cardiac hERG potassium-channel blockade and QTc prolongation.',
      pinTag: '7CN1 >500 Å³ druggable central pore',
      reasonHeadline: 'This part was the reason structurally unrelated CNS drugs (cocaethylene, methadone) both lodge inside the heart\'s repolarizing potassium pore.',
      reasonPoint: 'Inspect the live LIGSITE pocket scan on Cryo-EM hERG (7CN1) showing a wide, promiscuous hydrophobic inner cavity (>500 Å³) vs. ΔFosB\'s flat 18 Å³ surface.',
      mechanism: 'Unlike pocketless ΔFosB (5VPE), the human hERG Kv11.1 channel (PDB 7CN1) forms a spacious central inner cavity lined with aromatic Phe/Tyr side chains that readily trap lipophilic basic amines like cocaethylene and methadone—blocking outward IKr current and delaying ventricular repolarization.',
      targetSelector: '#pocketGateBanner',
      trigger: () => {
        clickOnclick("loadPDB('7CN1')");
        setTimeout(() => clickOnclick("selectLigandPreset('cocaethylene')"), 120);
      }
    },

    // ================= PENROSE ESSAY: NARCISSISM & ADDICTION =================
    {
      id: 'pen-alpha1a-pfc',
      articleId: 'penrose',
      sim: 'sim_paradox_rig.html',
      title: 'The Fourier Chapter Intimidation Collapse: NE Overdrive on α1A Shutting Down the PFC',
      fact: 'In the Penrose essay, Rishik describes feeling paralyzed by grandiose "beginner vs. advanced" framing in Road to Reality—then discovering basic precalc ideas the moment intimidation vanished.',
      pinTag: 'Stress NE → α1A opens KCNQ/HCN leak',
      reasonHeadline: 'This part was the reason intimidation made a basic periodic-function chapter feel completely unreadable until respect/fear disappeared.',
      reasonPoint: 'Watch the Layer III Working Memory bar crash while Stress NE pushes low-affinity α1A receptors past the inverted-U peak.',
      mechanism: 'High-stakes intimidation triggers acute norepinephrine surges that spill off high-affinity α2A receptors onto lower-affinity α1A adrenoceptors in the prefrontal cortex. α1A Gq/PKC signaling opens KCNQ/HCN leak channels, shattering persistent Layer III recurrent firing and collapsing cognitive flexibility.',
      targetSelector: '#wmBar',
      trigger: () => { clickSel('[data-preset="penrose"]'); }
    },
    {
      id: 'pen-compulsion-no-liking',
      articleId: 'penrose',
      sim: 'sim_synapse.html',
      title: 'Craving the Book Even After Learning the Truth: Pure Dopamine Wanting & rACC Failure',
      fact: 'The Penrose essay captures the shock of intermittent awe/shame conditioning: "I do not care about math and physics — yet I am deeply craving Penrose\'s book right now."',
      pinTag: 'Wanting without liking · rACC hijack',
      reasonHeadline: 'This part was the reason knowing someone is manipulative does not immediately extinguish the compulsive pull toward their intermittent validation.',
      reasonPoint: 'Look at the Striatal Synapse & transcriptional loop showing how unpredictable dopamine surges lock compulsive drive independently of conscious liking.',
      mechanism: 'Grandiose awe spikes followed by abrupt humiliation ("fail this advanced exercise") deliver peak reward-prediction uncertainty—driving pure striatal dopamine wanting without opioid hedonic-hotspot liking. As rostral ACC (rACC) metacognitive control weakens under stress, the conditioned pull persists even after intellectual disgust sets in.',
      targetSelector: '#sdeCanvas',
      trigger: () => { clickSel('[data-preset="holiday"]'); }
    }
  ];

  // Detect current page
  const pathName = (window.location.pathname || '').split('/').pop() || 'index.html';
  const currentSim = SIM_LABELS[pathName] ? pathName : null;
  const isHub = (pathName === 'neurolab.html');

  if (!currentSim && !isHub) return;

  // Inject scoped CSS (Gen-2 Noir aesthetic matching all RPrime sims)
  const css = `
    .rps-hidden-reel { display: none !important; }
    #rps-fab {
      position: fixed; right: 18px; bottom: 18px; z-index: 9990;
      display: flex; align-items: center; gap: 9px;
      background: linear-gradient(135deg, rgba(16,18,12,0.96), rgba(10,16,20,0.96));
      color: #f0eee6; border: 1.5px solid rgba(200,255,0,0.65);
      border-radius: 999px; padding: 10px 16px; cursor: pointer;
      font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 12px; font-weight: 600;
      box-shadow: 0 10px 32px rgba(0,0,0,0.65), 0 0 22px rgba(200,255,0,0.18);
      transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
    }
    #rps-fab:hover { transform: translateY(-2px); border-color: #c8ff00; box-shadow: 0 14px 36px rgba(0,0,0,0.75), 0 0 28px rgba(200,255,0,0.32); }
    #rps-fab .rps-dot { width: 8px; height: 8px; border-radius: 50%; background: #c8ff00; box-shadow: 0 0 10px #c8ff00; animation: rpsPulseDot 1.8s infinite; }
    #rps-fab .rps-count { background: rgba(200,255,0,0.16); color: #c8ff00; padding: 2px 7px; border-radius: 999px; font-size: 10.5px; border: 1px solid rgba(200,255,0,0.35); }
    @keyframes rpsPulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.45;transform:scale(0.8)} }

    #rps-drawer {
      position: fixed; right: 18px; bottom: 68px; z-index: 9991;
      width: min(460px, calc(100vw - 24px)); max-height: min(78vh, 690px);
      display: none; flex-direction: column;
      background: rgba(11,11,13,0.97); backdrop-filter: blur(14px);
      border: 1.5px solid rgba(200,255,0,0.42); border-radius: 14px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.85), 0 0 36px rgba(0,229,255,0.12);
      color: #f0eee6; font-family: 'DM Sans', system-ui, sans-serif; overflow: hidden;
    }
    #rps-drawer.open { display: flex; }

    .rps-head {
      padding: 12px 14px 10px; border-bottom: 1px solid rgba(255,255,255,0.09);
      background: linear-gradient(90deg, rgba(200,255,0,0.08), rgba(0,229,255,0.05));
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
    }
    .rps-head-title { font-family: 'Syne', sans-serif; font-size: 14.5px; font-weight: 800; letter-spacing: -0.01em; color: #f4f2ea; }
    .rps-head-sub { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #9c988e; margin-top: 2px; }
    .rps-close {
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #ccc8be;
      border-radius: 7px; width: 28px; height: 28px; cursor: pointer; font-size: 14px; flex-shrink: 0;
    }
    .rps-close:hover { background: rgba(255,107,53,0.2); border-color: #ff6b35; color: #fff; }

    .rps-tabs {
      display: flex; gap: 6px; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.07);
      background: rgba(255,255,255,0.02); overflow-x: auto; flex-shrink: 0;
    }
    .rps-tab {
      font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; padding: 5px 9px;
      border-radius: 6px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.03);
      color: #b8b3a8; cursor: pointer; white-space: nowrap; transition: all .15s;
    }
    .rps-tab.active { background: rgba(200,255,0,0.15); border-color: #c8ff00; color: #c8ff00; font-weight: 600; }
    .rps-tab:hover:not(.active) { border-color: rgba(255,255,255,0.28); color: #fff; }

    .rps-art-strip {
      display: flex; gap: 5px; padding: 7px 12px; border-bottom: 1px solid rgba(255,255,255,0.06);
      overflow-x: auto; flex-shrink: 0; background: #0d0d10;
    }
    .rps-art-pill {
      font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; padding: 3px 7px; border-radius: 5px;
      border: 1px solid rgba(255,255,255,0.11); background: transparent; color: #9c988e;
      cursor: pointer; white-space: nowrap;
    }
    .rps-art-pill.active { background: rgba(0,229,255,0.14); border-color: #00e5ff; color: #00e5ff; font-weight: 600; }

    .rps-body { overflow-y: auto; padding: 10px 12px 12px; flex: 1; display: flex; flex-direction: column; gap: 10px; }

    .rps-spotlight-card {
      background: linear-gradient(180deg, rgba(200,255,0,0.07), rgba(16,18,22,0.95));
      border: 1.5px solid rgba(200,255,0,0.55); border-radius: 11px; padding: 12px 13px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .rps-sc-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .rps-sc-badge {
      font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 700;
      padding: 2px 7px; border-radius: 4px; background: rgba(200,255,0,0.16); color: #c8ff00;
      border: 1px solid rgba(200,255,0,0.4); text-transform: uppercase;
    }
    .rps-sc-link { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: #00e5ff; text-decoration: none; }
    .rps-sc-link:hover { text-decoration: underline; }
    .rps-sc-title { font-family: 'Syne', sans-serif; font-size: 14.5px; font-weight: 700; color: #fff; line-height: 1.28; }
    .rps-sc-fact { font-size: 12.2px; color: #c5c1b7; line-height: 1.48; }
    .rps-sc-reason {
      background: rgba(200,255,0,0.11); border-left: 3px solid #c8ff00; border-radius: 6px;
      padding: 8px 10px; font-size: 12.2px; line-height: 1.48; color: #f6f9ec;
    }
    .rps-sc-reason strong { color: #c8ff00; display: block; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: 0.03em; margin-bottom: 3px; text-transform: uppercase; }
    .rps-sc-mech {
      background: rgba(0,229,255,0.06); border: 1px solid rgba(0,229,255,0.22); border-radius: 7px;
      padding: 8px 10px; font-size: 11.8px; color: #d6e4ea; line-height: 1.5;
    }
    .rps-sc-mech strong { color: #00e5ff; font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-transform: uppercase; display: block; margin-bottom: 3px; }
    .rps-sc-nav { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 2px; }
    .rps-btn {
      font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; font-weight: 600;
      padding: 6px 10px; border-radius: 6px; cursor: pointer;
      border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.06); color: #eee;
    }
    .rps-btn:hover { border-color: #c8ff00; color: #c8ff00; }
    .rps-btn-lime { background: #c8ff00; color: #080808; border-color: #c8ff00; }
    .rps-btn-lime:hover { background: #d9ff4d; color: #080808; }

    .rps-list { display: flex; flex-direction: column; gap: 6px; }
    .rps-item {
      text-align: left; width: 100%; background: rgba(255,255,255,0.025);
      border: 1px solid rgba(255,255,255,0.09); border-radius: 8px; padding: 8px 10px;
      cursor: pointer; color: #e8e5dd; transition: all .15s; display: flex; flex-direction: column; gap: 3px;
    }
    .rps-item:hover { border-color: rgba(200,255,0,0.45); background: rgba(200,255,0,0.05); }
    .rps-item.active { border-color: #c8ff00; background: rgba(200,255,0,0.1); }
    .rps-item-meta { display: flex; justify-content: space-between; gap: 6px; font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; color: #9a968c; }
    .rps-item-meta .rps-sim-chip { color: #00e5ff; }
    .rps-item-title { font-size: 12.2px; font-weight: 600; line-height: 1.32; color: #f2f0e8; }
    .rps-item-pin { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #c8ff00; }

    /* Live DOM Spotlight Ring & Floating Pointer Pin */
    .rps-spotlight-target {
      outline: 2.5px solid #c8ff00 !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 0 6px rgba(200,255,0,0.16), 0 0 32px rgba(200,255,0,0.38) !important;
      border-radius: 8px !important;
      animation: rpsGlowRing 1.9s ease-in-out infinite !important;
      position: relative;
    }
    @keyframes rpsGlowRing {
      0%, 100% { box-shadow: 0 0 0 5px rgba(200,255,0,0.18), 0 0 28px rgba(200,255,0,0.35); }
      50% { box-shadow: 0 0 0 9px rgba(0,229,255,0.22), 0 0 42px rgba(200,255,0,0.58); }
    }
    #rps-pin-badge {
      position: absolute; z-index: 9985; pointer-events: none;
      background: linear-gradient(135deg, #c8ff00, #8fffa8); color: #070907;
      font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 700;
      padding: 6px 11px; border-radius: 8px; max-width: 340px;
      box-shadow: 0 10px 28px rgba(0,0,0,0.72), 0 0 18px rgba(200,255,0,0.5);
      border: 1.5px solid #080808; line-height: 1.3;
      transition: top .22s ease, left .22s ease, opacity .2s ease;
    }
    #rps-pin-badge::after {
      content: ''; position: absolute; left: 16px; bottom: -7px;
      width: 12px; height: 12px; background: #c8ff00; transform: rotate(45deg);
      border-right: 1.5px solid #080808; border-bottom: 1.5px solid #080808;
    }

    /* Hub Atlas Section inside neurolab.html */
    #rps-hub-atlas {
      max-width: 1320px; margin: 28px auto 36px; padding: 22px 24px;
      background: linear-gradient(180deg, rgba(200,255,0,0.045), rgba(14,14,17,0.96));
      border: 1px solid rgba(200,255,0,0.28); border-radius: 16px;
      font-family: 'DM Sans', system-ui, sans-serif; color: #f0eee6;
    }
    .rps-hub-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
    .rps-hub-kicker { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #c8ff00; text-transform: uppercase; letter-spacing: 0.08em; }
    .rps-hub-h2 { font-family: 'Syne', sans-serif; font-size: clamp(20px, 2.5vw, 28px); font-weight: 800; margin: 4px 0 4px; color: #fff; }
    .rps-hub-desc { font-size: 13.5px; color: #aaa69c; max-width: 780px; margin: 0; line-height: 1.5; }
    .rps-hub-filters { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
    .rps-hub-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 12px; }
    .rps-hub-card {
      background: rgba(18,18,22,0.92); border: 1px solid rgba(255,255,255,0.1); border-radius: 11px;
      padding: 13px 14px; display: flex; flex-direction: column; gap: 7px;
      transition: border-color .16s, transform .16s;
    }
    .rps-hub-card:hover { border-color: rgba(200,255,0,0.55); transform: translateY(-2px); }
    .rps-hub-cta {
      margin-top: auto; display: inline-flex; align-items: center; justify-content: space-between;
      font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600;
      padding: 7px 10px; border-radius: 7px; text-decoration: none;
      background: rgba(200,255,0,0.12); color: #c8ff00; border: 1px solid rgba(200,255,0,0.38);
    }
    .rps-hub-cta:hover { background: #c8ff00; color: #080808; }
  `;

  const styleEl = document.createElement('style');
  styleEl.id = 'rps-spotlight-styles';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  const localStories = currentSim ? STORIES.filter((s) => s.sim === currentSim) : STORIES;
  let activeTab = currentSim ? 'local' : 'all';
  let activeArtFilter = 'all';
  let activeStoryId = null;
  let highlightedEl = null;
  let pinBadgeEl = null;

  function getArticle(artId) {
    return ARTICLES.find((a) => a.id === artId) || ARTICLES[0];
  }

  function clearSpotlightHighlight() {
    if (highlightedEl) {
      highlightedEl.classList.remove('rps-spotlight-target');
      highlightedEl = null;
    }
    if (pinBadgeEl && pinBadgeEl.parentNode) {
      pinBadgeEl.parentNode.removeChild(pinBadgeEl);
      pinBadgeEl = null;
    }
  }

  function positionPinBadge(targetEl, story) {
    if (!targetEl) return;
    if (!pinBadgeEl) {
      pinBadgeEl = document.createElement('div');
      pinBadgeEl.id = 'rps-pin-badge';
      document.body.appendChild(pinBadgeEl);
    }
    const art = getArticle(story.articleId);
    pinBadgeEl.textContent = `🎯 THIS PART CAUSED IT (${art.num === 'P' ? 'PENROSE' : 'ART ' + art.num}): ${story.pinTag}`;
    const rect = targetEl.getBoundingClientRect();
    const top = Math.max(12, window.scrollY + rect.top - 42);
    const left = Math.min(Math.max(12, window.scrollX + rect.left + 8), Math.max(12, document.documentElement.scrollWidth - 360));
    pinBadgeEl.style.top = top + 'px';
    pinBadgeEl.style.left = left + 'px';
  }

  function applySpotlight(story) {
    if (!story) return;
    if (currentSim && story.sim !== currentSim) {
      window.location.href = './' + story.sim + '#story=' + encodeURIComponent(story.id);
      return;
    }
    if (!currentSim) {
      window.location.href = './' + story.sim + '#story=' + encodeURIComponent(story.id);
      return;
    }

    activeStoryId = story.id;
    clearSpotlightHighlight();

    try {
      if (typeof story.trigger === 'function') story.trigger();
    } catch (_) {}

    try {
      history.replaceState(null, '', '#story=' + encodeURIComponent(story.id));
    } catch (_) {}

    setTimeout(() => {
      const targetEl = document.querySelector(story.targetSelector);
      if (targetEl) {
        highlightedEl = targetEl;
        targetEl.classList.add('rps-spotlight-target');
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        positionPinBadge(targetEl, story);
        setTimeout(() => positionPinBadge(targetEl, story), 420);
      }
    }, 180);

    renderDrawer();
  }

  function getFilteredStories() {
    let base = (activeTab === 'local' && currentSim) ? localStories : STORIES;
    if (activeArtFilter !== 'all') {
      base = base.filter((s) => s.articleId === activeArtFilter);
    }
    return base;
  }

  // Build Floating Action Button & Drawer
  const fab = document.createElement('button');
  fab.id = 'rps-fab';
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Open Article Story-to-Mechanism Spotlight');
  fab.innerHTML = `<span class="rps-dot"></span><span>Why X Happened · Story Guide</span><span class="rps-count">${localStories.length} ${currentSim ? 'in lab' : 'stories'}</span>`;

  const drawer = document.createElement('aside');
  drawer.id = 'rps-drawer';
  drawer.setAttribute('aria-label', 'Article Story-to-Mechanism Spotlight');

  document.body.appendChild(fab);
  document.body.appendChild(drawer);

  function toggleDrawer(force) {
    const willOpen = typeof force === 'boolean' ? force : !drawer.classList.contains('open');
    drawer.classList.toggle('open', willOpen);
    if (willOpen) renderDrawer();
  }

  fab.addEventListener('click', () => {
    const opening = !drawer.classList.contains('open');
    toggleDrawer(opening);
    if (opening && currentSim && !activeStoryId && localStories.length) {
      applySpotlight(localStories[0]);
    }
  });

  function renderDrawer() {
    const list = getFilteredStories();
    const activeStory = STORIES.find((s) => s.id === activeStoryId) || null;
    const localIdx = activeStory ? localStories.findIndex((s) => s.id === activeStory.id) : -1;

    const artButtons = [`<button type="button" class="rps-art-pill ${activeArtFilter === 'all' ? 'active' : ''}" data-art="all">All Articles</button>`]
      .concat(ARTICLES.map((a) => {
        const count = ((activeTab === 'local' && currentSim) ? localStories : STORIES).filter((s) => s.articleId === a.id).length;
        if (activeTab === 'local' && currentSim && count === 0) return '';
        return `<button type="button" class="rps-art-pill ${activeArtFilter === a.id ? 'active' : ''}" data-art="${a.id}">${a.num === 'P' ? 'Penrose' : 'Art ' + a.num} (${count})</button>`;
      })).join('');

    let spotlightHtml = '';
    if (activeStory && currentSim && activeStory.sim === currentSim) {
      const art = getArticle(activeStory.articleId);
      spotlightHtml = `
        <div class="rps-spotlight-card">
          <div class="rps-sc-top">
            <span class="rps-sc-badge">${art.short}</span>
            <a class="rps-sc-link" href="${art.href}" target="_blank" rel="noopener">Read source article ↗</a>
          </div>
          <div class="rps-sc-title">${activeStory.title}</div>
          <div class="rps-sc-fact">${activeStory.fact}</div>
          <div class="rps-sc-reason">
            <strong>🎯 This part was the reason it happened</strong>
            ${activeStory.reasonHeadline} <span style="color:#c8ff00;">${activeStory.reasonPoint}</span>
          </div>
          <div class="rps-sc-mech">
            <strong>🧬 Exact Biophysical / Molecular Mechanism</strong>
            ${activeStory.mechanism}
          </div>
          <div class="rps-sc-nav">
            <button type="button" class="rps-btn" id="rpsPrevBtn">← Prev Beat</button>
            <button type="button" class="rps-btn rps-btn-lime" id="rpsReplayBtn">▶ Re-Spotlight</button>
            <button type="button" class="rps-btn" id="rpsNextBtn">Next Beat →</button>
            <button type="button" class="rps-btn" id="rpsClearBtn" style="margin-left:auto;">Clear Pin</button>
          </div>
        </div>
      `;
    }

    const listHtml = list.map((s) => {
      const art = getArticle(s.articleId);
      const isHere = s.sim === currentSim;
      const isActive = s.id === activeStoryId;
      return `
        <button type="button" class="rps-item ${isActive ? 'active' : ''}" data-story-id="${s.id}">
          <div class="rps-item-meta">
            <span>${art.short}</span>
            <span class="rps-sim-chip">${isHere ? '● Spotlight here' : '↗ ' + (SIM_LABELS[s.sim] || s.sim)}</span>
          </div>
          <div class="rps-item-title">${s.title}</div>
          <div class="rps-item-pin">🎯 ${s.pinTag}</div>
        </button>
      `;
    }).join('');

    drawer.innerHTML = `
      <div class="rps-head">
        <div>
          <div class="rps-head-title">📖 Story → Mechanism Spotlight</div>
          <div class="rps-head-sub">Click any article story to drive the live physics &amp; pinpoint why X happened</div>
        </div>
        <button type="button" class="rps-close" id="rpsCloseBtn" title="Close">✕</button>
      </div>
      <div class="rps-tabs">
        ${currentSim ? `<button type="button" class="rps-tab ${activeTab === 'local' ? 'active' : ''}" data-tab="local">This Lab (${localStories.length})</button>` : ''}
        <button type="button" class="rps-tab ${activeTab === 'all' ? 'active' : ''}" data-tab="all">All 9 Articles (${STORIES.length})</button>
      </div>
      <div class="rps-art-strip">${artButtons}</div>
      <div class="rps-body">
        ${spotlightHtml}
        <div class="rps-list">${listHtml || '<div style="font-size:12px;color:#8a867c;padding:8px;">No beats match this filter.</div>'}</div>
      </div>
    `;

    drawer.querySelector('#rpsCloseBtn')?.addEventListener('click', () => toggleDrawer(false));
    drawer.querySelectorAll('.rps-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        activeArtFilter = 'all';
        renderDrawer();
      });
    });
    drawer.querySelectorAll('.rps-art-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeArtFilter = btn.dataset.art;
        renderDrawer();
      });
    });
    drawer.querySelectorAll('.rps-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const st = STORIES.find((x) => x.id === btn.dataset.storyId);
        if (st) applySpotlight(st);
      });
    });
    drawer.querySelector('#rpsReplayBtn')?.addEventListener('click', () => {
      if (activeStory) applySpotlight(activeStory);
    });
    drawer.querySelector('#rpsClearBtn')?.addEventListener('click', () => {
      activeStoryId = null;
      clearSpotlightHighlight();
      renderDrawer();
    });
    drawer.querySelector('#rpsPrevBtn')?.addEventListener('click', () => {
      if (!localStories.length) return;
      const prev = localStories[(localIdx - 1 + localStories.length) % localStories.length];
      applySpotlight(prev);
    });
    drawer.querySelector('#rpsNextBtn')?.addEventListener('click', () => {
      if (!localStories.length) return;
      const next = localStories[(localIdx + 1) % localStories.length];
      applySpotlight(next);
    });
  }

  // Inject interactive Story-to-Mechanism Atlas section into neurolab.html
  function mountHubAtlas() {
    if (!isHub) return;
    const footer = document.querySelector('footer');
    const sec = document.createElement('section');
    sec.id = 'rps-hub-atlas';
    let hubFilter = 'all';

    function renderHub() {
      const items = hubFilter === 'all' ? STORIES : STORIES.filter((s) => s.articleId === hubFilter);
      const filterBtns = [`<button type="button" class="rps-art-pill ${hubFilter === 'all' ? 'active' : ''}" data-hf="all">All 9 Articles (${STORIES.length} Stories)</button>`]
        .concat(ARTICLES.map((a) => {
          const n = STORIES.filter((s) => s.articleId === a.id).length;
          return `<button type="button" class="rps-art-pill ${hubFilter === a.id ? 'active' : ''}" data-hf="${a.id}">${a.short} (${n})</button>`;
        })).join('');

      const cards = items.map((s) => {
        const art = getArticle(s.articleId);
        return `
          <div class="rps-hub-card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;font-family:'IBM Plex Mono',monospace;font-size:10px;">
              <span style="color:${art.accent};font-weight:700;">${art.short}</span>
              <span style="color:#00e5ff;">${SIM_LABELS[s.sim] || s.sim}</span>
            </div>
            <div style="font-family:'Syne',sans-serif;font-size:14.5px;font-weight:700;color:#fff;line-height:1.3;">${s.title}</div>
            <div style="font-size:12px;color:#b4b0a6;line-height:1.46;">${s.fact}</div>
            <div style="font-size:11.8px;color:#e4f5c6;background:rgba(200,255,0,0.08);border-left:2.5px solid #c8ff00;padding:6px 8px;border-radius:5px;line-height:1.42;">
              <strong style="color:#c8ff00;font-family:'IBM Plex Mono',monospace;font-size:9.5px;display:block;margin-bottom:2px;">THIS PART CAUSED IT: ${s.pinTag.toUpperCase()}</strong>
              ${s.reasonHeadline}
            </div>
            <a class="rps-hub-cta" href="./${s.sim}#story=${encodeURIComponent(s.id)}">
              <span>🎯 Open Lab &amp; Spotlight Mechanism</span><span>→</span>
            </a>
          </div>
        `;
      }).join('');

      sec.innerHTML = `
        <div class="rps-hub-head">
          <div>
            <div class="rps-hub-kicker">Interactive Story → Mechanism Index · All 9 Articles × 7 Live Labs</div>
            <h2 class="rps-hub-h2">"This Part Was The Reason X Happened"</h2>
            <p class="rps-hub-desc">Pick any intense real-world story, historical case, or paradox from Articles 01–08 and the Penrose essay. Each button opens the exact live simulation, loads its physiological parameters, and spotlights the exact gauge, curve, channel, or orbital that caused it.</p>
          </div>
        </div>
        <div class="rps-hub-filters">${filterBtns}</div>
        <div class="rps-hub-grid">${cards}</div>
      `;

      sec.querySelectorAll('[data-hf]').forEach((b) => {
        b.addEventListener('click', () => {
          hubFilter = b.dataset.hf;
          renderHub();
        });
      });
    }

    renderHub();
    if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(sec, footer);
    } else {
      document.body.appendChild(sec);
    }
  }

  // Respect ?mode=reel and Escape key and window resize
  function syncReelVisibility() {
    const isReel = document.body.classList.contains('reel-mode') || new URLSearchParams(window.location.search).get('mode') === 'reel';
    fab.classList.toggle('rps-hidden-reel', isReel);
    if (isReel) {
      drawer.classList.remove('open');
      clearSpotlightHighlight();
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      drawer.classList.remove('open');
      clearSpotlightHighlight();
    }
  });

  window.addEventListener('resize', () => {
    if (highlightedEl && activeStoryId) {
      const st = STORIES.find((x) => x.id === activeStoryId);
      if (st) positionPinBadge(highlightedEl, st);
    }
  });

  function checkStoryHash() {
    const m = (window.location.hash || '').match(/story=([a-zA-Z0-9_-]+)/);
    if (!m) return;
    const st = STORIES.find((x) => x.id === m[1]);
    if (st && st.sim === currentSim) {
      toggleDrawer(true);
      setTimeout(() => applySpotlight(st), 320);
    }
  }

  window.addEventListener('hashchange', checkStoryHash);

  // Boot after DOM & sim init settle
  const boot = () => {
    mountHubAtlas();
    syncReelVisibility();
    checkStoryHash();
  };
  if (document.readyState === 'complete') {
    setTimeout(boot, 120);
  } else {
    window.addEventListener('load', () => setTimeout(boot, 120));
  }

  window.RPrimeStorySpotlight = {
    ARTICLES,
    STORIES,
    open: () => toggleDrawer(true),
    close: () => { toggleDrawer(false); clearSpotlightHighlight(); },
    spotlight: (id) => {
      const st = STORIES.find((x) => x.id === id);
      if (st) { toggleDrawer(true); applySpotlight(st); }
    }
  };
})();
