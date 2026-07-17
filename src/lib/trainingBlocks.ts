// @ts-nocheck
// Every training block Jarrod has run, in one place. Each block owns its own
// calendar window, phases, and week-by-week program — TrainingPlan.tsx and
// Dashboard.tsx read whichever block's window contains "now" via
// selectBlockAt(). Adding a new block (the next one, and the one after that)
// means appending a new entry here — nothing else in the app needs to change.
//
// Storage is namespaced per block (see api.ts's training_plan doc shape:
// { blocks: { [blockId]: {...} } }) specifically so that positional keys
// like "0-0-0" (week/day/exercise index) never collide between blocks that
// both happen to have a Monday as their first day. MAXES merges logged sets
// across every block a lift appears in, so 1RMs carry forward automatically
// — a new block's %-based targets are correctly informed by the last block's
// numbers from the moment it goes live, no manual re-entry needed.

export const S = "strength", PW = "power", Z = "zone2", R = "rest";
const ex = (n, p, s, note) => ({ n, p, s, note });

// ═══════════════════════════════════════════════════
// SHARED LIFT-TRACKING HELPERS (block-agnostic)
// ═══════════════════════════════════════════════════
export function canonical(name) {
  const n = name.toLowerCase();
  if (n.includes("skip") || n.includes("core") || n.includes("upper power")) return null;
  if (n.includes("romanian") || n.startsWith("rdl")) return "Romanian DL";
  if (n.includes("deadlift")) return "Deadlift";
  if (n.includes("squat")) return "Back Squat";
  if (n.includes("push press")) return "Push Press";
  if (n.includes("bench") || n === "speed bench") return "Bench Press";
  if (n.includes("overhead press") || (n.includes("press") && !n.includes("push"))) return "Overhead Press";
  if (n.includes("row") || n.includes("pull")) return "Row / Pull-Ups";
  return null;
}

export function parseReps(p) {
  let m = p.match(/×\s*(\d+)/);
  if (m) return parseInt(m[1]);
  m = p.match(/(\d+)[–\-]?\d*\s*RM/i);
  if (m) return parseInt(m[1]);
  return 1;
}

export function parsePct(p) {
  const m = p.match(/@\s*(\d+)%/);
  return m ? parseInt(m[1]) : null;
}

// Some prescriptions reference a percentage of a DIFFERENT lift's 1RM
// (e.g. Push Press "@ 63% OHP" is 63% of Overhead Press 1RM, not Push Press's own;
// DB press bridge work in Block 2 is likewise dosed off the OHP 1RM).
export function getPctLiftName(exr) {
  if (/OHP/i.test(exr.p)) return "Overhead Press";
  return canonical(exr.n);
}

export function calcTargetWeight(pct, oneRM) {
  if (!oneRM || !pct) return null;
  return Math.round((oneRM * pct / 100) / 5) * 5;
}

// Lift display config for the consolidated load progression chart/table.
// Shared across all blocks — a lift a given block doesn't program (e.g.
// Push Press in Block 2) just stops getting new data points; its card and
// chart line keep showing whatever the last block established.
export const LIFT_CONFIG = [
  { key: "sq", label: "Squat", shortLabel: "SQ", name: "Back Squat", color: "#3B82F6" },
  { key: "dl", label: "Deadlift", shortLabel: "DL", name: "Deadlift", color: "#F97316" },
  { key: "bp", label: "Bench", shortLabel: "BP", name: "Bench Press", color: "#22C55E" },
  { key: "ohp", label: "OHP", shortLabel: "OHP", name: "Overhead Press", color: "#A855F7" },
  { key: "pp", label: "Push Press", shortLabel: "PP", name: "Overhead Press", color: "#EC4899" },
  { key: "row", label: "Row/Pull-Ups", shortLabel: "ROW", name: "Row / Pull-Ups", color: "#06B6D4", noPercent: true },
  { key: "rdl", label: "Romanian DL", shortLabel: "RDL", name: "Romanian DL", color: "#FACC15", noPercent: true },
];

function computeMaxesForWeeks(weeks, weights, completedSets, into) {
  weeks.forEach((wk, wIdx) => {
    wk.days.forEach((day, dIdx) => {
      day.exs.forEach((exr, exIdx) => {
        const cName = canonical(exr.n);
        if (!cName || exr.s === 0) return;
        const setsCompleted = completedSets[`${wIdx}-${dIdx}-${exIdx}`] || 0;
        if (setsCompleted === 0) return;
        const reps = parseReps(exr.p);
        let bestW = 0;
        for (let s = 0; s < setsCompleted; s++) {
          const w = parseFloat(weights[`${wIdx}-${dIdx}-${exIdx}-${s}`] || "0");
          if (w > bestW) bestW = w;
        }
        if (bestW === 0) return;
        const est1RM = reps === 1 ? bestW : Math.round(bestW * (1 + reps / 30));
        if (!into[cName]) into[cName] = { maxWeight: 0, maxReps: 1, max1RM: 0, maxDate: "", maxWeek: 0, history: [] };
        const entry = { week: wk.w, date: day.dt, weight: bestW, reps, est1RM };
        const hi = into[cName].history.findIndex((h) => h.week === wk.w && h.date === day.dt);
        if (hi >= 0) { if (est1RM > into[cName].history[hi].est1RM) into[cName].history[hi] = entry; }
        else into[cName].history.push(entry);
        if (est1RM > into[cName].max1RM) {
          Object.assign(into[cName], { maxWeight: bestW, maxReps: reps, max1RM: est1RM, maxDate: day.dt, maxWeek: wk.w });
        }
      });
    });
  });
}

// Merges lift history across every block so a new block's %-based targets
// are informed by maxes set in prior blocks from day one. `activeWeeks` +
// `activeWeights`/`activeCompletedSets` get live (in-progress) state;
// `otherBlocksData` is frozen historical data from blocks that aren't the
// one currently being edited.
export function computeMaxes(activeWeeks, activeWeights, activeCompletedSets, otherBlocksData = []) {
  const result = {};
  otherBlocksData.forEach(({ weeks, weights, completedSets }) => {
    computeMaxesForWeeks(weeks, weights || {}, completedSets || {}, result);
  });
  computeMaxesForWeeks(activeWeeks, activeWeights, activeCompletedSets, result);
  return result;
}

const MONTH_NUM = { June: 6, July: 7, Aug: 8, August: 8, Sep: 9, September: 9, Oct: 10, October: 10 };
export function fmtDate(dt) {
  // dt is like "June 1" or "Aug 3" or "June 29 – July 5" (range, take first)
  const first = dt.split(/[–-]/)[0].trim();
  const [mon, day] = first.split(/\s+/);
  const m = MONTH_NUM[mon];
  return m ? `${m}/${parseInt(day)}` : dt;
}

// ═══════════════════════════════════════════════════
// BLOCK 1 — SUMMER TRAINING PLAN (Jun 1 – Aug 23, 2026)
// ═══════════════════════════════════════════════════
const BLOCK1_PH = {
  1: { name: "FOUNDATION", icon: "🔵", c: "#3B82F6", r: "59,130,246", goal: "Establish movement patterns, build baseline conditioning, and prepare the body for the heavier loading ahead. Challenging but never grinding — finish every session feeling capable, not wrecked." },
  2: { name: "BUILD", icon: "🟡", c: "#F59E0B", r: "245,158,11", goal: "Increase loading and reduce reps on primary lifts. Add power volume on Fridays. The last 1–2 reps of heavy sets should feel genuinely hard but controlled." },
  3: { name: "INTENSIFY", icon: "🔴", c: "#EF4444", r: "239,68,68", goal: "Peak loading on primary lifts. Reps drop, intensity climbs. The hardest phase of the block — recovery becomes just as important as training." },
  4: { name: "PEAK", icon: "⚡", c: "#A855F7", r: "168,85,247", goal: "Express the strength you've built over 9 weeks. Push primary lifts to near-maximum, then true maximum. Warm-up sets matter more here than at any other point." },
  5: { name: "DELOAD", icon: "🟢", c: "#22C55E", r: "34,197,94", goal: "Full, deliberate recovery. Volume drops ~35–40%, intensity stays moderate. Sessions should feel almost too easy — that's exactly the point." },
};

const BLOCK1_WEEK_FOCUS = {
  1: "Build baseline conditioning and establish clean movement patterns on every lift.",
  2: "Add 2.5–5 lb where Week 1 was clean. Same patterns, incrementally heavier.",
  3: "Heaviest week of Foundation — hit phase-high loads on every primary lift before the reset.",
  4: "Reps drop, load climbs. First taste of Build-phase intensity — stay composed.",
  5: "Heaviest Build-phase loading — the week before the planned mid-block reset.",
  6: "Mandatory reset week. Load and volume drop on purpose — do not push through it.",
  7: "Intensify begins. Reps drop to 2–3, loads climb into the high-80% range.",
  8: "Highest total Monday load of the block so far — stay disciplined on recovery days.",
  9: "Final Intensify week — near-single deadlift efforts. Arrive at Peak phase fresh.",
  10: "Near-max effort week. Work to a heavy 2–3RM on squat/bench and a heavy 2RM on deadlift.",
  11: "True max week — attempt new 1RM PRs on squat, bench, and deadlift. Log every number.",
  12: "Deload. Full recovery — reduce volume ~35–40%, keep loads light. Consolidate 11 weeks of work.",
};

const BLOCK1_WEEKS = [
  {w:1,ph:1,range:"June 1–7",days:[
    {dn:"Monday",dt:"June 1",type:S,title:"Strength: Squat & Bench",restNote:"2–3 min / 90 sec rows",exs:[
      ex("Back Squat","4 × 5 @ 73%",4,"Control descent, drive through the floor, stay tall"),
      ex("Bench Press","4 × 6 @ 70%",4,"Retract shoulder blades, controlled lower, press in a straight line"),
      ex("Barbell Row","3 × 8 — moderate",3,"Pull to lower chest, control the return, no jerking"),
      ex("Core (Optional)","2–3 sets",3,"Planks or bodyweight split squats — keep it easy"),
    ]},
    {dn:"Tuesday",dt:"June 2",type:Z,title:"Zone 2 — Recovery",dur:"60 min",intensity:"Conversational pace — full sentences possible",opts:["Incline walking","Easy cycling","Light rowing"],note:"Flush soreness from Monday. Recovery, not training — do not push.",exs:[]},
    {dn:"Wednesday",dt:"June 3",type:S,title:"Strength: Deadlift & Upper",restNote:"3 min DL / 2 min others",exs:[
      ex("Conv. Deadlift","4 × 4 @ 76%",4,"Big breath, brace hard, push the floor away — think push, not pull"),
      ex("Overhead Press","4 × 6 @ 66%",4,"Squeeze glutes at top, keep ribs down, vertical bar path"),
      ex("Pull-Ups / Row","3 × 6",3,"Full range — dead hang to chin over bar"),
      ex("Upper Power","SKIP — Week 1",0,"Focus on primary lifts only this week"),
    ]},
    {dn:"Thursday",dt:"June 4",type:Z,title:"Neighborhood Loop Intervals",dur:"3 × 1 mi loops",intensity:"Steady, conversational pace on each loop — nasal breathing. Accessory finisher stays light.",opts:["Loop 1 (1 mi)","Loop 2 (1 mi)","Loop 3 (1 mi)","Accessory: Core/Mobility (5–10 min)"],note:"Run 3 one-mile loops around the neighborhood. After the final loop, do a 5–10 min accessory/mobility finisher — keep it easy, this is establishing the new Thursday structure.",exs:[]},
    {dn:"Friday",dt:"June 5",type:PW,title:"Power + Strength Blend",restNote:"60–90 sec speed / 2 min RDL & rows",exs:[
      ex("Speed Squat","5 × 2 @ 54%",5,"Controlled descent, explode out of the hole — max intent every rep"),
      ex("Bench Press","5 × 3 @ 54%",5,"Lower controlled, press with absolute maximum speed and intention"),
      ex("Romanian DL","3 × 8",3,"Hinge at hip, feel hamstring stretch, keep back flat"),
      ex("Row Variation","3 × 10 — light",3,"Hypertrophy focus — full stretch and contraction each rep"),
    ]},
    {dn:"Saturday",dt:"June 6",type:Z,title:"Zone 2 — Long",dur:"60 min",intensity:"Easy, fully uninterrupted aerobic work",opts:["Outdoor walk","Bike ride","Rucking","Jog/walk hybrid"],note:"If fatigued from the week: cap at 35 min and walk only",exs:[]},
    {dn:"Sunday",dt:"June 7",type:R,title:"Rest / Sabbath",note:"Full rest, light stretching, or easy walk under 20 min. No structured training.",exs:[]},
  ]},
  {w:2,ph:1,range:"June 8–14",days:[
    {dn:"Monday",dt:"June 8",type:S,title:"Strength: Squat & Bench",restNote:"2–3 min / 90 sec rows",exs:[
      ex("Back Squat","4 × 5 @ 76%",4,"Add 2.5–5 lb from Week 1 if all reps were clean"),
      ex("Bench Press","4 × 6 @ 73%",4,"Same cues as Week 1 — consistency builds the foundation"),
      ex("Barbell Row","3 × 8 — add 5 lb",3,"Pull to lower chest, control the return"),
      ex("Core (Optional)","2–3 sets",3,"Planks or split squats — same as Week 1"),
    ]},
    {dn:"Tuesday",dt:"June 9",type:Z,title:"Zone 2 — Recovery",dur:"60 min",intensity:"Conversational pace",opts:["Incline walking","Easy cycling","Light rowing"],note:"Same format as Week 1 — easy recovery effort only",exs:[]},
    {dn:"Wednesday",dt:"June 10",type:S,title:"Strength: Deadlift & Upper",restNote:"3 min DL / 2 min others",exs:[
      ex("Conv. Deadlift","4 × 4 @ 78%",4,"Incremental load increase — same cues, more weight"),
      ex("Push Press","3 × 4 @ 58% OHP",3,"Dip at knee, drive with legs, press overhead — use momentum intentionally"),
      ex("Overhead Press","4 × 6 @ 68%",4,"Press in a perfectly vertical line — no forward lean. Done right after push press — same pressing block."),
      ex("Pull-Ups / Row","3 × 7",3,"One more rep than Week 1 — control the full range"),
    ]},
    {dn:"Thursday",dt:"June 11",type:Z,title:"Neighborhood Loop Intervals",dur:"3 × 1 mi loops",intensity:"Steady, conversational pace on each loop — nasal breathing. Accessory finisher stays light.",opts:["Loop 1 (1 mi)","Loop 2 (1 mi)","Loop 3 (1 mi)","Accessory: Core/Mobility (5–10 min)"],note:"Same structure as Week 1 — build consistency with the loop + accessory routine.",exs:[]},
    {dn:"Friday",dt:"June 12",type:PW,title:"Power + Strength Blend",restNote:"60–90 sec speed / 2 min RDL & rows",exs:[
      ex("Speed Squat","6 × 2 @ 56%",6,"One more set than Week 1 — speed must stay sharp every rep"),
      ex("Bench Press","6 × 3 @ 56%",6,"Bar velocity is priority — if bar slows, weight is too heavy"),
      ex("Romanian DL","3 × 8 — add 5 lb",3,"Slow eccentric, feel the stretch — don't rush"),
      ex("Row Variation","3 × 10 — add 5 lb",3,"Hypertrophy focus — controlled tempo throughout"),
    ]},
    {dn:"Saturday",dt:"June 13",type:Z,title:"Zone 2 — Long",dur:"60 min",intensity:"Easy, fully uninterrupted aerobic work",opts:["Outdoor walk","Bike ride","Rucking","Jog/walk hybrid"],note:"Options: outdoor walk, bike, ruck, jog/walk hybrid",exs:[]},
    {dn:"Sunday",dt:"June 14",type:R,title:"Rest / Sabbath",note:"Full rest, light stretching, or easy walk under 20 min.",exs:[]},
  ]},
  {w:3,ph:1,range:"June 15–21",days:[
    {dn:"Monday",dt:"June 15",type:S,title:"Strength: Squat & Bench",restNote:"2–3 min / 90 sec rows",exs:[
      ex("Back Squat","4 × 5 @ 79%",4,"Heaviest Monday of Phase 1 — clean execution above all else"),
      ex("Bench Press","4 × 6 @ 76%",4,"Highest load of phase — chest tight, shoulder blades locked"),
      ex("Barbell Row","4 × 8 — add 5 lb",4,"One more set than Week 2 — volume building week over week"),
      ex("Core (Optional)","2–3 sets",3,"Same movements — consistency over novelty"),
    ]},
    {dn:"Tuesday",dt:"June 16",type:Z,title:"Zone 2 — Recovery",dur:"60 min",intensity:"Conversational pace",opts:["Incline walking","Easy cycling","Light rowing"],note:"Final recovery Zone 2 of Phase 1 — stay easy",exs:[]},
    {dn:"Wednesday",dt:"June 17",type:S,title:"Strength: Deadlift & Upper",restNote:"3 min DL / 2 min others",exs:[
      ex("Conv. Deadlift","4 × 4 @ 80%",4,"Heaviest deadlift of Phase 1 — treat each set with full focus"),
      ex("Push Press","3 × 4 @ 61% OHP",3,"Slightly heavier than Week 2 — drive must still come from the legs"),
      ex("Overhead Press","4 × 6 @ 70%",4,"Highest load of phase — stay strict, no excessive layback. Same pressing block as push press."),
      ex("Pull-Ups / Row","3 × 8",3,"Two more reps than Week 1 — strength is building"),
    ]},
    {dn:"Thursday",dt:"June 18",type:Z,title:"Neighborhood Loop Intervals",dur:"3 × 1 mi loops",intensity:"Steady, conversational pace on each loop — nasal breathing. Accessory finisher stays light.",opts:["Loop 1 (1 mi)","Loop 2 (1 mi)","Loop 3 (1 mi)","Accessory: Core/Mobility (5–10 min)"],note:"Final Foundation Thursday at this loop count — Build phase adds a 4th loop next week.",exs:[]},
    {dn:"Friday",dt:"June 19",type:PW,title:"Power + Strength Blend",restNote:"60–90 sec speed / 2 min RDL & rows",exs:[
      ex("Speed Squat","6 × 2 @ 58%",6,"Heaviest speed work of Phase 1 — explosive intent every rep"),
      ex("Bench Press","6 × 3 @ 58%",6,"Speed and intent — not grinding, not slow"),
      ex("Romanian DL","3 × 8 — add 5 lb",3,"Highest load of Phase 1 — controlled eccentric, full hip hinge"),
      ex("Row Variation","3 × 10 — add 5 lb",3,"Phase 1 volume cap — finishing strong"),
    ]},
    {dn:"Saturday",dt:"June 20",type:Z,title:"Zone 2 — Long",dur:"60 min",intensity:"Easy, fully uninterrupted aerobic work",opts:["Outdoor walk","Bike ride","Rucking","Jog/walk hybrid"],note:"Final long Zone 2 of Phase 1 — keep it easy and enjoy it",exs:[]},
    {dn:"Sunday",dt:"June 21",type:R,title:"Rest / Sabbath",note:"Full rest. Phase 1 complete — foundation is built. Phase 2 starts Monday.",exs:[]},
  ]},
  {w:4,ph:2,range:"June 22–28",days:[
    {dn:"Monday",dt:"June 22",type:S,title:"Strength: Squat & Bench",restNote:"2–3 min / 90 sec rows",exs:[
      ex("Back Squat","4 × 4 @ 82%",4,"Reps drop to 4, load goes up — intentional. Stay composed."),
      ex("Bench Press","4 × 5 @ 79%",4,"One fewer rep than Phase 1 — higher intensity per set"),
      ex("Barbell Row","4 × 6 — heavier",4,"Load increases from Phase 1 — pull with intention"),
      ex("Core (Optional)","3 sets",3,"Add small weight to split squats if bodyweight became easy"),
    ]},
    {dn:"Tuesday",dt:"June 23",type:Z,title:"Zone 2 — Recovery",dur:"60 min",intensity:"Conversational pace — critical after heavier Monday",opts:["Incline walking","Easy cycling","Light rowing"],note:"Do not let Zone 2 creep up in intensity during Build phase.",exs:[]},
    {dn:"Wednesday",dt:"June 24",type:S,title:"Strength: Deadlift & Upper",restNote:"3 min DL / 2 min others",exs:[
      ex("Conv. Deadlift","4 × 3 @ 83%",4,"Reps drop, load climbs — treat every set as a near top-set effort"),
      ex("Push Press","4 × 3 @ 63% OHP",4,"Four sets this week — explosiveness must stay sharp"),
      ex("Overhead Press","4 × 5 @ 73%",4,"One fewer rep than Phase 1 — heavier and more intentional. Same pressing block as push press."),
      ex("Pull-Ups / Row","4 × 6 — add load",4,"Add load from Phase 1 — more challenging every week"),
    ]},
    {dn:"Thursday",dt:"June 25",type:Z,title:"Neighborhood Loop Intervals",dur:"4 × 1 mi loops",intensity:"Steady, conversational pace on each loop — nasal breathing. Accessory finisher stays light.",opts:["Loop 1 (1 mi)","Loop 2 (1 mi)","Loop 3 (1 mi)","Loop 4 (1 mi)","Accessory: Core/Mobility (5–10 min)"],note:"One more loop than Phase 1 Thursdays — Build phase ramp begins.",exs:[]},
    {dn:"Friday",dt:"June 26",type:PW,title:"Power + Strength Blend",restNote:"60–90 sec speed / 2 min RDL & rows",exs:[
      ex("Speed Squat","6 × 2 @ 60%",6,"Bar speed is the metric — if speed drops, rest longer"),
      ex("Bench Press — Volume","3 × 8 @ 70%",3,"Switching to volume work — controlled tempo, full range"),
      ex("Romanian DL","3 × 8 — heavier",3,"Heavier than Phase 1 — controlled eccentric, feel the hamstring load"),
      ex("Row Variation","3 × 10",3,"Maintain load from end of Phase 1"),
    ]},
    {dn:"Saturday",dt:"June 27",type:Z,title:"Zone 2 — Long",dur:"60 min",intensity:"Easy, fully uninterrupted aerobic work",opts:["Outdoor walk","Bike ride","Rucking","Jog/walk hybrid"],note:"Zone 2 building alongside strength",exs:[]},
    {dn:"Sunday",dt:"June 28",type:R,title:"Rest / Sabbath",note:"Full rest, light stretching, or easy walk under 20 min.",exs:[]},
  ]},
  {w:5,ph:2,range:"June 29 – July 5",days:[
    {dn:"Monday",dt:"June 29",type:S,title:"Strength: Squat & Bench",restNote:"2–3 min / 90 sec rows",exs:[
      ex("Back Squat","5 × 4 @ 84%",5,"One more set than Week 4 — highest Monday volume of block so far"),
      ex("Bench Press","4 × 5 @ 81%",4,"Incrementally heavier — last 1–2 reps should feel genuinely hard"),
      ex("Barbell Row","4 × 6 — add 5 lb",4,"Progressive load — maintain form at heavier weight"),
      ex("Core (Optional)","3 sets",3,"Continue adding weight if movements allow"),
    ]},
    {dn:"Tuesday",dt:"June 30",type:Z,title:"Zone 2 — Recovery",dur:"60 min",intensity:"Conversational pace",opts:["Incline walking","Easy cycling","Light rowing"],note:"Recovery is critical — heaviest Build phase loading mid-week.",exs:[]},
    {dn:"Wednesday",dt:"July 1",type:S,title:"Strength: Deadlift & Upper",restNote:"3 min DL / 2 min others",exs:[
      ex("Conv. Deadlift","4 × 3 @ 85%",4,"These will feel heavy — full focus, full brace, no rushing between sets"),
      ex("Push Press","4 × 3 @ 66% OHP",4,"Heaviest push press so far — leg drive must lead the movement"),
      ex("Overhead Press","4 × 5 @ 75%",4,"Highest OHP load of Phase 2 — stay strict. Same pressing block as push press."),
      ex("Pull-Ups / Row","4 × 7",4,"One more rep than Week 4 — strength is building"),
    ]},
    {dn:"Thursday",dt:"July 2",type:Z,title:"Neighborhood Loop Intervals",dur:"4 × 1 mi loops",intensity:"Steady, conversational pace on each loop — nasal breathing. Accessory finisher stays light.",opts:["Loop 1 (1 mi)","Loop 2 (1 mi)","Loop 3 (1 mi)","Loop 4 (1 mi)","Accessory: Core/Mobility (5–10 min)"],note:"Same loop count as Week 4 — heaviest Build-phase loading week, keep the run truly easy.",exs:[]},
    {dn:"Friday",dt:"July 3",type:PW,title:"Power + Strength Blend",restNote:"60–90 sec speed / 2 min RDL & rows",exs:[
      ex("Speed Squat","7 × 2 @ 61%",7,"One more set than Week 4 — bar speed must stay explosive all 7 sets"),
      ex("Bench Press — Volume","4 × 8 @ 70%",4,"One more set than Week 4 — highest bench volume day of Phase 2"),
      ex("Romanian DL","4 × 8",4,"One more set than Week 4 — maintain controlled tempo"),
      ex("Row Variation","4 × 10",4,"One more set than Week 4 — full range of motion every rep"),
    ]},
    {dn:"Saturday",dt:"July 4",type:Z,title:"Zone 2 — Long",dur:"60 min",intensity:"Easy, fully uninterrupted aerobic work",opts:["Outdoor walk","Bike ride","Rucking","Jog/walk hybrid"],note:"Happy 4th of July — get outside. Long walk, bike ride, anything easy.",exs:[]},
    {dn:"Sunday",dt:"July 5",type:R,title:"Rest / Sabbath",note:"Full rest, light stretching, or easy walk under 20 min.",exs:[]},
  ]},
  {w:6,ph:2,range:"July 6–12",isReset:true,days:[
    {dn:"Monday",dt:"July 6",type:S,title:"Strength: Squat & Bench (Reset)",restNote:"2–3 min / 90 sec rows",exs:[
      ex("Back Squat","3 × 5 @ 76%",3,"Noticeably easier than last week — correct and intentional"),
      ex("Bench Press","3 × 6 @ 73%",3,"Reduced sets, lighter load — quality movement is the goal"),
      ex("Barbell Row","3 × 8 — moderate",3,"Back to moderate load — do not push"),
      ex("Core (Optional)","2 sets — easy",2,"Reduce sets and keep effort easy this week"),
    ]},
    {dn:"Tuesday",dt:"July 7",type:Z,title:"Zone 2 — Recovery",dur:"60 min",intensity:"Conversational pace",opts:["Incline walking","Easy cycling","Light rowing"],note:"Easy and relaxed — the reset week is working.",exs:[]},
    {dn:"Wednesday",dt:"July 8",type:S,title:"Strength: Deadlift & Upper (Reset)",restNote:"3 min DL / 2 min others",exs:[
      ex("Conv. Deadlift","3 × 4 @ 78%",3,"Down from 85% last week — should feel manageable and crisp"),
      ex("Overhead Press","3 × 6 @ 69%",3,"Lighter load, more reps — quality movement"),
      ex("Pull-Ups / Row","3 × 6 — moderate",3,"Reset to moderate load — smooth, controlled reps"),
      ex("Upper Power","SKIP this week",0,"Full reset — skip power work entirely"),
    ]},
    {dn:"Thursday",dt:"July 9",type:Z,title:"Neighborhood Loop Intervals (Reset)",dur:"2 × 1 mi loops",intensity:"Easy, relaxed pace — reset week, no need to push.",opts:["Loop 1 (1 mi)","Loop 2 (1 mi)","Accessory: Core/Mobility (5–10 min)"],note:"Reset week — loop count cut roughly in half. Keep it easy.",exs:[]},
    {dn:"Friday",dt:"July 10",type:PW,title:"Power + Strength Blend (Reset)",restNote:"60–90 sec speed / 2 min RDL & rows",exs:[
      ex("Speed Squat","5 × 2 @ 55%",5,"Focus purely on bar speed and movement quality — perfect reps"),
      ex("Bench Press — Speed","4 × 3 @ 55%",4,"Back to speed work — lighter and fast"),
      ex("Romanian DL","3 × 8 — light",3,"Light and controlled — don't add load this week"),
      ex("Row Variation","3 × 10 — light",3,"Easy effort — finishing the reset week clean"),
    ]},
    {dn:"Saturday",dt:"July 11",type:Z,title:"Zone 2 — Long",dur:"60 min",intensity:"Easy, fully uninterrupted aerobic work",opts:["Outdoor walk","Bike ride","Rucking","Jog/walk hybrid"],note:"Scaled back — an easy, comfortable long walk or ride",exs:[]},
    {dn:"Sunday",dt:"July 12",type:R,title:"Rest / Sabbath",note:"Full rest. Phase 2 complete. Reset done — fully prepared for Phase 3.",exs:[]},
  ]},
  {w:7,ph:3,range:"July 13–19",days:[
    {dn:"Monday",dt:"July 13",type:S,title:"Strength: Squat & Bench",restNote:"2–3 min / 90 sec rows",exs:[
      ex("Back Squat","4 × 3 @ 86%",4,"Reps drop to 3 — heavy and purposeful. No wasted reps."),
      ex("Bench Press","4 × 4 @ 82%",4,"Highest Monday bench load yet — chest tight, locked in each set"),
      ex("Barbell Row","4 × 5 — heavy",4,"Heaviest rows of block — pull with control and full ROM"),
      ex("Core (Optional)","3 sets",3,"Injury prevention is highest priority in Phase 3 — do not skip"),
    ]},
    {dn:"Tuesday",dt:"July 14",type:Z,title:"Zone 2 — Recovery",dur:"60 min",intensity:"Conversational pace — CRITICAL to keep easy",opts:["Incline walking","Easy cycling","Light rowing"],note:"Zone 2 is your recovery tool in Phase 3. Pushing it costs you on Wednesday.",exs:[]},
    {dn:"Wednesday",dt:"July 15",type:S,title:"Strength: Deadlift & Upper",restNote:"3 min DL / 2 min others",exs:[
      ex("Conv. Deadlift","4 × 2 @ 87%",4,"Near-max double — full setup every rep. Take the full 3+ min rest."),
      ex("Push Press","4 × 3 @ 67% OHP",4,"Heaviest push press so far — powerful drive from the legs"),
      ex("Overhead Press","4 × 4 @ 77%",4,"Heavy and controlled — no excessive layback. Same pressing block as push press."),
      ex("Pull-Ups / Row","4 × 5 — heavy",4,"Heavy pulling work — sets and load climbing every week"),
    ]},
    {dn:"Thursday",dt:"July 16",type:Z,title:"Neighborhood Loop Intervals",dur:"4 × 1 mi loops",intensity:"Steady, easy pace — this is recovery, not training. If very fatigued, drop to 3 loops.",opts:["Loop 1 (1 mi)","Loop 2 (1 mi)","Loop 3 (1 mi)","Loop 4 (1 mi)","Accessory: Core/Mobility (5–10 min)"],note:"Intensify begins — back to 4 loops. Zone 2 stays your recovery tool, not a training stimulus.",exs:[]},
    {dn:"Friday",dt:"July 17",type:PW,title:"Power + Strength Blend",restNote:"60–90 sec speed / 2 min RDL & rows",exs:[
      ex("Speed Squat","7 × 2 @ 63%",7,"7 sets at higher % — speed is still the goal every rep"),
      ex("Bench Press — Speed","6 × 3 @ 63%",6,"6 sets — highest speed bench volume so far. Stay fast."),
      ex("Romanian DL","4 × 6 — heavy",4,"Fewer reps, more load — controlled eccentric throughout"),
      ex("Row Variation","4 × 8",4,"Heavy rowing accessory — full range every rep"),
    ]},
    {dn:"Saturday",dt:"July 18",type:Z,title:"Zone 2 — Long",dur:"60 min",intensity:"Truly easy — do NOT push Zone 2 during Phase 3",opts:["Outdoor walk","Bike ride","Rucking","Jog/walk hybrid"],note:"Longest Zone 2 session of block — stay disciplined about keeping it easy",exs:[]},
    {dn:"Sunday",dt:"July 19",type:R,title:"Rest / Sabbath",note:"Full rest, light stretching, or easy walk under 20 min.",exs:[]},
  ]},
  {w:8,ph:3,range:"July 20–26",days:[
    {dn:"Monday",dt:"July 20",type:S,title:"Strength: Squat & Bench",restNote:"2–3 min / 90 sec rows",exs:[
      ex("Back Squat","5 × 3 @ 87%",5,"One more set than Week 7 — highest total Monday load of block"),
      ex("Bench Press","4 × 4 @ 84%",4,"Incrementally heavier — last rep of each set is a genuine grind"),
      ex("Barbell Row","4 × 5 — add 5 lb",4,"Progressive load — controlled and intentional every set"),
      ex("Core (Optional)","3 sets",3,"Maintain injury prevention through Phase 3"),
    ]},
    {dn:"Tuesday",dt:"July 21",type:Z,title:"Zone 2 — Recovery",dur:"60 min",intensity:"Conversational pace — keep easy",opts:["Incline walking","Easy cycling","Light rowing"],note:"Full recovery after Monday's heaviest session of the block.",exs:[]},
    {dn:"Wednesday",dt:"July 22",type:S,title:"Strength: Deadlift & Upper",restNote:"3 min DL / 2 min others",exs:[
      ex("Conv. Deadlift","4 × 2 @ 89%",4,"Very close to maximum — absolute focus on setup, brace, execution"),
      ex("Push Press","4 × 3 @ 70% OHP",4,"70% is heavy for power — drive must still be explosive"),
      ex("Overhead Press","4 × 4 @ 79%",4,"Heavier than Week 7 — stay strict, no forward lean. Same pressing block as push press."),
      ex("Pull-Ups / Row","4 × 5 — add load",4,"Load increases from Week 7 — maintain form as weight climbs"),
    ]},
    {dn:"Thursday",dt:"July 23",type:Z,title:"Neighborhood Loop Intervals",dur:"4 × 1 mi loops",intensity:"Steady, easy pace — recovery is training in Phase 3.",opts:["Loop 1 (1 mi)","Loop 2 (1 mi)","Loop 3 (1 mi)","Loop 4 (1 mi)","Accessory: Core/Mobility (5–10 min)"],note:"Same as Week 7 — if very fatigued, drop to 3 loops and skip the accessory finisher.",exs:[]},
    {dn:"Friday",dt:"July 24",type:PW,title:"Power + Strength Blend",restNote:"60–90 sec speed / 2 min RDL & rows",exs:[
      ex("Speed Squat","8 × 2 @ 65%",8,"Highest speed squat volume of block — bar speed non-negotiable"),
      ex("Bench Press — Speed","6 × 3 @ 65%",6,"Heavier speed work — if bar slows, reduce weight not sets"),
      ex("Romanian DL","4 × 6 — add 5 lb",4,"Heaviest RDL yet — maintain the controlled eccentric"),
      ex("Row Variation","4 × 8 — add load",4,"Load increases from Week 7 — strong pull, full range"),
    ]},
    {dn:"Saturday",dt:"July 25",type:Z,title:"Zone 2 — Long",dur:"60 min",intensity:"Easy and uninterrupted",opts:["Outdoor walk","Bike ride","Rucking","Jog/walk hybrid"],note:"Keep intensity easy — do not push Zone 2 during Phase 3",exs:[]},
    {dn:"Sunday",dt:"July 26",type:R,title:"Rest / Sabbath",note:"Full rest, light stretching, or easy walk under 20 min.",exs:[]},
  ]},
  {w:9,ph:3,range:"July 27 – Aug 2",days:[
    {dn:"Monday",dt:"July 27",type:S,title:"Strength: Squat & Bench",restNote:"2–3 min / 90 sec rows",exs:[
      ex("Back Squat","5 × 2 @ 89%",5,"Reps drop to 2 — load same as Week 8. More quality, less volume."),
      ex("Bench Press","4 × 3 @ 86%",4,"Reps drop — this is the final approach before Peak"),
      ex("Barbell Row","4 × 5 — add 5 lb",4,"Heaviest rows of block — controlled and strong"),
      ex("Core (Optional)","3 sets",3,"Do not skip — injury prevention most critical final Intensify week"),
    ]},
    {dn:"Tuesday",dt:"July 28",type:Z,title:"Zone 2 — Recovery",dur:"35–40 min",intensity:"Conversational pace",opts:["Incline walking","Easy cycling","Light rowing"],note:"Keep this easy. Peak starts next week — arrive there fresh.",exs:[]},
    {dn:"Wednesday",dt:"July 29",type:S,title:"Strength: Deadlift & Upper",restNote:"3 min DL / 2 min others",exs:[
      ex("Conv. Deadlift","3 × 1 @ 91%",3,"Near-single efforts — treat every rep as a true max. Full reset between lifts."),
      ex("Push Press","4 × 3 @ 72% OHP",4,"Highest push press load — explosive drive must still lead"),
      ex("Overhead Press","4 × 3 @ 81%",4,"Highest OHP load of block — stay strict and deliberate. Same pressing block as push press."),
      ex("Pull-Ups / Row","4 × 5 — add load",4,"Heaviest pulling of block — full range, controlled return"),
    ]},
    {dn:"Thursday",dt:"July 30",type:Z,title:"Neighborhood Loop Intervals",dur:"3 × 1 mi loops",intensity:"Steady, easy pace — tapering into Peak phase.",opts:["Loop 1 (1 mi)","Loop 2 (1 mi)","Loop 3 (1 mi)","Accessory: Core/Mobility (5 min)"],note:"Tapering into Peak — one fewer loop and a shorter accessory finisher to arrive fresh. If fatigue is severe, walk the loops instead.",exs:[]},
    {dn:"Friday",dt:"July 31",type:PW,title:"Power + Strength Blend",restNote:"60–90 sec speed / 2 min RDL & rows",exs:[
      ex("Speed Squat","8 × 2 @ 65%",8,"If very fatigued, drop to 6 sets — speed is priority, not volume"),
      ex("Bench Press — Speed","6 × 3 @ 65%",6,"Same as Week 8 — maintain speed and quality"),
      ex("Romanian DL","4 × 5 — heavier",4,"Fewer reps, more load — final RDL push of Phase 3"),
      ex("Row Variation","4 × 8 — add load",4,"Heaviest row accessory of block"),
    ]},
    {dn:"Saturday",dt:"Aug 1",type:Z,title:"Zone 2 — Long",dur:"55–60 min",intensity:"Truly easy — final long Zone 2 before Peak",opts:["Outdoor walk","Bike ride","Rucking","Jog/walk hybrid"],note:"The last long Zone 2 of the block. Easy effort — you have earned it.",exs:[]},
    {dn:"Sunday",dt:"Aug 2",type:R,title:"Rest / Sabbath",note:"Full rest. Phase 3 complete. Hardest work is done. Phase 4 is the payoff.",exs:[]},
  ]},
  {w:10,ph:4,range:"Aug 3–9",days:[
    {dn:"Monday",dt:"Aug 3",type:S,title:"Squat & Bench — Near-Max Effort",restNote:"3+ min between all top sets",exs:[
      ex("Back Squat","Heavy 2–3RM",1,"Take 4–5 build-up sets. Heaviest 2–3 reps you can complete cleanly. Do not miss."),
      ex("Bench Press","Heavy 3RM",1,"4–5 build-up sets. Heaviest controlled 3-rep set you can complete."),
      ex("Barbell Row","3 × 5 — moderate",3,"Support work only — do not fatigue back before primary lifts"),
    ]},
    {dn:"Tuesday",dt:"Aug 4",type:Z,title:"Zone 2 — Recovery",dur:"30 min easy walk only",intensity:"Conversational — flat and easy",opts:["Easy flat walk only"],note:"Full recovery after Monday near-max. No rucking. No incline. No impact.",exs:[]},
    {dn:"Wednesday",dt:"Aug 5",type:S,title:"Deadlift & Upper — Near-Max Effort",restNote:"3+ min between all top sets",exs:[
      ex("Conv. Deadlift","Heavy 2RM",1,"4–5 build-up sets — methodical and patient. Heaviest double you can pull cleanly."),
      ex("Push Press","3 × 3 @ 70% OHP",3,"Power accessory — keep it crisp and controlled"),
      ex("Overhead Press","Heavy 3RM",1,"4 build-up sets. Heaviest controlled 3-rep press. Same pressing block as push press."),
      ex("Pull-Ups / Row","3 × 5 — moderate",3,"Support work only — don't fatigue pulling before deadlift test"),
    ]},
    {dn:"Thursday",dt:"Aug 6",type:Z,title:"Neighborhood Loop Intervals (Light)",dur:"2 × 1 mi loops",intensity:"Walk pace or easy jog only — no impact, no rucking. This is recovery before next week's max effort.",opts:["Loop 1 (1 mi)","Loop 2 (1 mi)","Accessory: Mobility (5 min, optional)"],note:"Peak phase — loops stay light and short. Walk them if there's any lingering fatigue from Monday's near-max work.",exs:[]},
    {dn:"Friday",dt:"Aug 7",type:PW,title:"Speed Work Only — No Max Effort",restNote:"60–90 sec between speed sets",exs:[
      ex("Speed Squat","6 × 2 @ 58%",6,"Fast and crisp — CNS priming for next week. Not fatigue accumulation."),
      ex("Speed Bench","5 × 3 @ 58%",5,"Explosive intent — light and fast"),
      ex("Romanian DL","3 × 8 — moderate",3,"Movement quality focus — keep it easy"),
      ex("Row","3 × 8 — moderate",3,"Easy accessory — no heavy pulling this week"),
    ]},
    {dn:"Saturday",dt:"Aug 8",type:Z,title:"Zone 2 — Long",dur:"60 min",intensity:"Easy and comfortable",opts:["Outdoor walk","Bike ride","Rucking","Jog/walk hybrid"],note:"Celebrate a strong near-max week. Keep it relaxed and enjoyable.",exs:[]},
    {dn:"Sunday",dt:"Aug 9",type:R,title:"Rest / Sabbath",note:"Full rest, light stretching, or easy walk under 20 min.",exs:[]},
  ]},
  {w:11,ph:4,range:"Aug 10–16",days:[
    {dn:"Monday",dt:"Aug 10",type:S,title:"Squat & Bench — TRUE MAX",restNote:"Full 3–5 min between all sets",exs:[
      ex("Back Squat","True 1–2RM",1,"Take 5 build-up sets. Patient warm-up. Attempt new personal record. LOG IT."),
      ex("Bench Press","True 1–2RM",1,"4–5 build-up sets. True max — if it goes up clean, that is your new 1RM."),
      ex("Barbell Row","3 × 5 — light",3,"Light only — back must be fresh for deadlift max Wednesday"),
    ]},
    {dn:"Tuesday",dt:"Aug 11",type:Z,title:"Zone 2 — Recovery",dur:"30 min easy walk only",intensity:"Conversational — flat and easy",opts:["Easy flat walk only"],note:"Full recovery before Wednesday deadlift max — biggest lift of the block.",exs:[]},
    {dn:"Wednesday",dt:"Aug 12",type:S,title:"Deadlift & Upper — TRUE MAX",restNote:"Full 3–5 min — take all the time you need",exs:[
      ex("Conv. Deadlift","True 1RM",1,"Biggest lift of block. 5 patient build-up sets. Full focus every warm-up rep. NEW MAX."),
      ex("Overhead Press","True 2–3RM",1,"4 build-up sets. Heaviest controlled OHP of the block."),
      ex("Pull-Ups / Row","3 × 5 — light",3,"Light support only after the deadlift max"),
    ]},
    {dn:"Thursday",dt:"Aug 13",type:Z,title:"Neighborhood Loop Intervals (Light)",dur:"2 × 1 mi loops",intensity:"Walk pace or easy jog only — fully restorative after Wednesday's deadlift max.",opts:["Loop 1 (1 mi)","Loop 2 (1 mi)","Accessory: Mobility (5 min, optional)"],note:"Easy and restorative. You have done the work — keep this truly light.",exs:[]},
    {dn:"Friday",dt:"Aug 14",type:PW,title:"Light Speed Work Only",restNote:"60–90 sec between speed sets",exs:[
      ex("Speed Squat","5 × 2 @ 55%",5,"Light, fast, and done. No fatigue accumulation before deload."),
      ex("Speed Bench","4 × 3 @ 55%",4,"Crisp and intentional — movement quality over anything"),
      ex("Romanian DL","2 × 8 — light",2,"Light movement quality work only — do not load this"),
    ]},
    {dn:"Saturday",dt:"Aug 15",type:Z,title:"Zone 2 — Long",dur:"60 min",intensity:"Easy and comfortable",opts:["Outdoor walk","Bike ride","Rucking","Jog/walk hybrid"],note:"You have earned this one. Celebrate what you built over 11 weeks.",exs:[]},
    {dn:"Sunday",dt:"Aug 16",type:R,title:"Rest / Sabbath",note:"Full rest. New maxes are logged. The deload is your reward.",exs:[]},
  ]},
  {w:12,ph:5,range:"Aug 17–23",days:[
    {dn:"Monday",dt:"Aug 17",type:S,title:"Strength: Squat & Bench (Deload)",restNote:"2 min between all sets",exs:[
      ex("Back Squat","3 × 5 @ 65%",3,"Should feel almost too easy. That is the point — absorb 11 weeks of work."),
      ex("Bench Press","3 × 5 @ 65%",3,"Reduced sets, lighter load — quality movement only"),
      ex("Barbell Row","2 × 8 — light",2,"Easy pulling — no pushing for load this week"),
    ]},
    {dn:"Tuesday",dt:"Aug 18",type:Z,title:"Zone 2 — Recovery",dur:"60 min",intensity:"Conversational pace",opts:["Easy flat walking preferred"],note:"Short and easy. You are in full recovery mode.",exs:[]},
    {dn:"Wednesday",dt:"Aug 19",type:S,title:"Strength: Deadlift & Upper (Deload)",restNote:"2 min between all sets",exs:[
      ex("Conv. Deadlift","3 × 3 @ 65%",3,"Light and controlled — movement quality, not loading"),
      ex("Overhead Press","3 × 5 @ 65%",3,"Easy effort — no grinding, no intensity"),
      ex("Pull-Ups / Row","2 × 6 — light",2,"Easy pulling — just moving the body"),
    ]},
    {dn:"Thursday",dt:"Aug 20",type:Z,title:"Neighborhood Loop Intervals (Light)",dur:"2 × 1 mi loops",intensity:"Easy and comfortable — well below steady state. Walk pace is fine.",opts:["Loop 1 (1 mi)","Loop 2 (1 mi)","Accessory: Mobility (5 min, optional)"],note:"Deload week is full recovery — keep these loops short and relaxed, no different from a comfortable walk.",exs:[]},
    {dn:"Friday",dt:"Aug 21",type:PW,title:"Light Movement (Deload)",restNote:"60–90 sec between all sets",exs:[
      ex("Speed Squat","4 × 2 @ 50%",4,"Light, fast, smooth — just moving the body through the pattern"),
      ex("Bench Press","3 × 5 @ 65%",3,"Easy movement — no intensity"),
      ex("Romanian DL","2 × 8 — light",2,"Movement quality focus — no loading"),
    ]},
    {dn:"Saturday",dt:"Aug 22",type:Z,title:"Zone 2 — Long",dur:"60 min",intensity:"Easy — whatever sounds enjoyable",opts:["Outdoor walk","Bike ride","Rucking","Jog/walk hybrid"],note:"Optional outdoor walk or relaxed bike ride. Celebrate completing 12 weeks!",exs:[]},
    {dn:"Sunday",dt:"Aug 23",type:R,title:"Rest / Sabbath",note:"BLOCK COMPLETE — Aug 23, 2026. Take 3–5 days complete rest before follow-on plan.",exs:[]},
  ]},
];

const BLOCK1_PROG = [
  {n:"Wk1",sq:73,dl:76,bp:70,ohp:66,pp:null},{n:"Wk2",sq:76,dl:78,bp:73,ohp:68,pp:58},{n:"Wk3",sq:79,dl:80,bp:76,ohp:70,pp:61},
  {n:"Wk4",sq:82,dl:83,bp:79,ohp:73,pp:63},{n:"Wk5",sq:84,dl:85,bp:81,ohp:75,pp:66},{n:"Wk6↓",sq:76,dl:78,bp:73,ohp:69,pp:null},
  {n:"Wk7",sq:86,dl:87,bp:82,ohp:77,pp:67},{n:"Wk8",sq:87,dl:89,bp:84,ohp:79,pp:70},{n:"Wk9",sq:89,dl:91,bp:86,ohp:81,pp:72},
  {n:"Wk10",sq:93,dl:95,bp:93,ohp:93,pp:70},{n:"Wk11",sq:100,dl:100,bp:100,ohp:100,pp:null},{n:"Wk12↓",sq:65,dl:65,bp:65,ohp:65,pp:null},
];

// ═══════════════════════════════════════════════════
// BLOCK 2 — ACCUMULATION + CONDITIONING (Aug 31 – Oct 25, 2026)
// ═══════════════════════════════════════════════════
// Note on dates: the source plan said "Aug 27 – Oct 18," but Aug 27, 2026 is
// a Thursday (Aug 23 — Block 1's last day — is confirmed Sunday), which
// would open the block mid-week against a Mon/Wed/Fri skeleton. Nudged the
// start to the next Monday (Aug 31) so every week runs Mon–Sun cleanly;
// this stretches the reset from ~3-5 days to Aug 24–30. Say the word if a
// Thursday Aug 27 start is preferred instead and I'll rebuild the calendar.
const BLOCK2_PH = {
  1: { name: "ACCUMULATION A", icon: "🔵", c: "#3B82F6", r: "59,130,246", goal: "Build volume tolerance off your Block 1 maxes. Moderate intensity, higher reps (8–12) — sessions should feel productive, not max-effort." },
  2: { name: "ACCUMULATION B", icon: "🟠", c: "#F97316", r: "249,115,22", goal: "Slight intensity bump with tempo and pause work added for time-under-tension. Still no near-max singles — this builds muscle and tendon resilience, not a new max." },
  3: { name: "TRANSITION", icon: "🟢", c: "#22C55E", r: "34,197,94", goal: "Step back on volume and intensity. Consolidate 7 weeks of accumulation work and set primary lifts up clean for whatever block comes next." },
};

const BLOCK2_WEEK_FOCUS = {
  1: "Establish the new 8–12 rep ranges off your Block 1 maxes. DB press bridges the wrist — no barbell pressing at volume yet.",
  2: "Same structure, nudge load where Week 1 was clean.",
  3: "Volume ramps — add a set on Squat and Row. Transition DB press back to barbell Overhead Press.",
  4: "Heaviest week of Accumulation A — still comfortably sub-max, this is about total work done.",
  5: "Accumulation B begins. Reps drop slightly, tempo/pause work adds time-under-tension, Thursday's Zone 3 tempo work gets a real slot.",
  6: "Same tempo emphasis, incremental load.",
  7: "Heaviest week of the block — still well shy of anything near-max.",
  8: "Transition/step-back. Volume and intensity both pull back — arrive fresh for whatever's next.",
};

const BLOCK2_WEEKS = [
  {w:1,ph:1,range:"Aug 31 – Sep 6",days:[
    {dn:"Monday",dt:"Aug 31",type:S,title:"Squat & Bench",restNote:"90 sec–2 min",exs:[
      ex("Back Squat","4 × 10 @ 68%",4,"Off your Block 1 max — moderate load, full depth, controlled every rep"),
      ex("Bench Press","4 × 10 @ 65%",4,"Higher reps than Block 1 — this is volume work, not a grind"),
      ex("Barbell Row","3 × 12",3,"Moderate load — full stretch and squeeze, this is hypertrophy volume"),
    ]},
    {dn:"Tuesday",dt:"Sep 1",type:Z,title:"Zone 2 — Trail/Run",dur:"45 min",intensity:"Conversational-pace trail run or brisk hike, nasal breathing",opts:["Trail run","Brisk hike","Neighborhood run"],note:"Real terrain, not the treadmill — training what you'll actually do with the family this fall.",exs:[]},
    {dn:"Wednesday",dt:"Sep 2",type:S,title:"Deadlift & Upper",restNote:"2–3 min",exs:[
      ex("Conv. Deadlift","4 × 8 @ 70%",4,"Conventional stance, no near-max singles this block — this is volume, not testing"),
      ex("DB Overhead Press","4 × 10 @ 65% OHP",4,"Bridge exercise while the wrist confirms pain-free at lower loads — neutral or semi-supinated grip"),
      ex("Pull-Ups / Row","4 × 10",4,"Full range every rep — dead hang to chin over bar"),
    ]},
    {dn:"Thursday",dt:"Sep 3",type:Z,title:"Zone 2/3 — Tempo",dur:"35 min",intensity:"10 min Z2 warm-up, 15 min Z3 tempo (comfortably hard, sentence-only speech), 10 min Z2 cooldown",opts:["Outdoor run","Bike intervals","Rowing intervals"],note:"Zone 3 gets a real seat at the table this block — you're not simultaneously chasing max strength, so it won't interfere.",exs:[]},
    {dn:"Friday",dt:"Sep 4",type:PW,title:"Hypertrophy + Conditioning",restNote:"45–60 sec",exs:[
      ex("DB Incline Press","3 × 12",3,"Controlled tempo, full stretch at the bottom"),
      ex("Lateral Raise","3 × 15",3,"Light, strict, no swinging — feel the delt work"),
      ex("Face Pull","3 × 15",3,"Rear delt/upper back — pull to the face, squeeze at the end range"),
      ex("Conditioning Finisher","3 rounds — KB swings/carries",3,"Blend of power and conditioning — keep moving, controlled breathing"),
    ]},
    {dn:"Saturday",dt:"Sep 5",type:Z,title:"Zone 2 — Long Hike/Ruck",dur:"60–75 min",intensity:"Easy pace, hilly terrain if available",opts:["Long hike","Rucking","Trail run"],note:"Building the aerobic base for fall trail season.",exs:[]},
    {dn:"Sunday",dt:"Sep 6",type:R,title:"Rest / Sabbath",note:"Full rest. Week 1 of Block 2 complete — the new rep ranges are a different stimulus, expect some soreness.",exs:[]},
  ]},
  {w:2,ph:1,range:"Sep 7–13",days:[
    {dn:"Monday",dt:"Sep 7",type:S,title:"Squat & Bench",restNote:"90 sec–2 min",exs:[
      ex("Back Squat","4 × 10 @ 70%",4,"Nudge load if Week 1 was clean across all 4 sets"),
      ex("Bench Press","4 × 10 @ 67%",4,"Same rep target — small load increase"),
      ex("Barbell Row","3 × 12 — add load",3,"Progressive load where form stayed clean"),
    ]},
    {dn:"Tuesday",dt:"Sep 8",type:Z,title:"Zone 2 — Trail/Run",dur:"45 min",intensity:"Conversational-pace trail run or brisk hike, nasal breathing",opts:["Trail run","Brisk hike","Neighborhood run"],note:"Same structure as Week 1 — build consistency.",exs:[]},
    {dn:"Wednesday",dt:"Sep 9",type:S,title:"Deadlift & Upper",restNote:"2–3 min",exs:[
      ex("Conv. Deadlift","4 × 8 @ 71%",4,"Small load bump — same conventional stance, no singles"),
      ex("DB Overhead Press","4 × 10 @ 66% OHP",4,"Final week of the DB bridge before transitioning back to barbell"),
      ex("Pull-Ups / Row","4 × 10 — add load",4,"Progressive load — full range every rep"),
    ]},
    {dn:"Thursday",dt:"Sep 10",type:Z,title:"Zone 2/3 — Tempo",dur:"35 min",intensity:"10 min Z2 warm-up, 15 min Z3 tempo (comfortably hard, sentence-only speech), 10 min Z2 cooldown",opts:["Outdoor run","Bike intervals","Rowing intervals"],note:"Same tempo structure as Week 1.",exs:[]},
    {dn:"Friday",dt:"Sep 11",type:PW,title:"Hypertrophy + Conditioning",restNote:"45–60 sec",exs:[
      ex("DB Incline Press","3 × 12 — add load",3,"Where Week 1 was clean, add a small load"),
      ex("Lateral Raise","3 × 15",3,"Same load — priority is clean form, not weight"),
      ex("Face Pull","3 × 15",3,"Same as Week 1 — rear delt/upper back health"),
      ex("Conditioning Finisher","3 rounds — KB swings/carries",3,"Same structure — focus on smooth, controlled reps"),
    ]},
    {dn:"Saturday",dt:"Sep 12",type:Z,title:"Zone 2 — Long Hike/Ruck",dur:"60–75 min",intensity:"Easy pace, hilly terrain if available",opts:["Long hike","Rucking","Trail run"],note:"Same as Week 1.",exs:[]},
    {dn:"Sunday",dt:"Sep 13",type:R,title:"Rest / Sabbath",note:"Full rest. Two weeks of volume banked.",exs:[]},
  ]},
  {w:3,ph:1,range:"Sep 14–20",days:[
    {dn:"Monday",dt:"Sep 14",type:S,title:"Squat & Bench",restNote:"90 sec–2 min",exs:[
      ex("Back Squat","5 × 10 @ 71%",5,"Add a set — volume ramps this week, not just load"),
      ex("Bench Press","4 × 10 @ 68%",4,"Small load increase — reps hold at 10"),
      ex("Barbell Row","4 × 12",4,"Add a set to match the squat volume bump"),
    ]},
    {dn:"Tuesday",dt:"Sep 15",type:Z,title:"Zone 2 — Trail/Run",dur:"45 min",intensity:"Conversational-pace trail run or brisk hike, nasal breathing",opts:["Trail run","Brisk hike","Neighborhood run"],note:"Same structure as Weeks 1–2.",exs:[]},
    {dn:"Wednesday",dt:"Sep 16",type:S,title:"Deadlift & Upper",restNote:"2–3 min",exs:[
      ex("Conv. Deadlift","4 × 10 @ 70%",4,"Reps go up, intensity holds — deadlift accumulates fatigue fast, managing volume deliberately"),
      ex("Overhead Press","4 × 10 @ 66%",4,"Transitioning back to barbell — the wrist has held up clean at lower DB loads for 2 weeks"),
      ex("Pull-Ups / Row","4 × 12",4,"Add reps to match this week's volume bump"),
    ]},
    {dn:"Thursday",dt:"Sep 17",type:Z,title:"Zone 2/3 — Tempo",dur:"35 min",intensity:"10 min Z2 warm-up, 15 min Z3 tempo (comfortably hard, sentence-only speech), 10 min Z2 cooldown",opts:["Outdoor run","Bike intervals","Rowing intervals"],note:"Same tempo structure.",exs:[]},
    {dn:"Friday",dt:"Sep 18",type:PW,title:"Hypertrophy + Conditioning",restNote:"45–60 sec",exs:[
      ex("DB Incline Press","4 × 12",4,"Add a set — volume week carries through Friday too"),
      ex("Lateral Raise","4 × 15",4,"Add a set — keep the load light and strict"),
      ex("Face Pull","3 × 15",3,"Hold steady — this is a maintenance movement, not a progression focus"),
      ex("Conditioning Finisher","3 rounds — KB swings/carries",3,"Same as Weeks 1–2.",),
    ]},
    {dn:"Saturday",dt:"Sep 19",type:Z,title:"Zone 2 — Long Hike/Ruck",dur:"60–75 min",intensity:"Easy pace, hilly terrain if available",opts:["Long hike","Rucking","Trail run"],note:"Same as Weeks 1–2.",exs:[]},
    {dn:"Sunday",dt:"Sep 20",type:R,title:"Rest / Sabbath",note:"Full rest. Highest-volume week of Accumulation A so far — recovery matters.",exs:[]},
  ]},
  {w:4,ph:1,range:"Sep 21–27",days:[
    {dn:"Monday",dt:"Sep 21",type:S,title:"Squat & Bench",restNote:"90 sec–2 min",exs:[
      ex("Back Squat","4 × 8 @ 73%",4,"Reps pull back to 8 as intensity peaks — heaviest week of Accumulation A"),
      ex("Bench Press","5 × 10 @ 69%",5,"Add a set — highest bench volume of Accumulation A"),
      ex("Barbell Row","4 × 10 — heavier",4,"Load up, reps pull back slightly — same pattern as squat"),
    ]},
    {dn:"Tuesday",dt:"Sep 22",type:Z,title:"Zone 2 — Trail/Run",dur:"45 min",intensity:"Conversational-pace trail run or brisk hike, nasal breathing",opts:["Trail run","Brisk hike","Neighborhood run"],note:"Same structure as prior weeks.",exs:[]},
    {dn:"Wednesday",dt:"Sep 23",type:S,title:"Deadlift & Upper",restNote:"2–3 min",exs:[
      ex("Conv. Deadlift","4 × 8 @ 73%",4,"Heaviest deadlift of Accumulation A — still comfortably sub-max"),
      ex("Overhead Press","4 × 8 @ 68%",4,"Second week fully back on barbell — load climbing cleanly"),
      ex("Pull-Ups / Row","4 × 10 — add load",4,"Heaviest pulling of Accumulation A"),
    ]},
    {dn:"Thursday",dt:"Sep 24",type:Z,title:"Zone 2/3 — Tempo",dur:"35 min",intensity:"10 min Z2 warm-up, 15 min Z3 tempo (comfortably hard, sentence-only speech), 10 min Z2 cooldown",opts:["Outdoor run","Bike intervals","Rowing intervals"],note:"Same tempo structure.",exs:[]},
    {dn:"Friday",dt:"Sep 25",type:PW,title:"Hypertrophy + Conditioning",restNote:"45–60 sec",exs:[
      ex("DB Incline Press","3 × 10 — heavier",3,"Reps pull back, load climbs — same pattern as the primary lifts this week"),
      ex("Lateral Raise","3 × 15 — add load",3,"Small load increase, keep it strict"),
      ex("Face Pull","3 × 15",3,"Hold steady.",),
      ex("Conditioning Finisher","4 rounds — KB swings/carries",4,"One more round — Accumulation A peak week."),
    ]},
    {dn:"Saturday",dt:"Sep 26",type:Z,title:"Zone 2 — Long Hike/Ruck",dur:"60–75 min",intensity:"Easy pace, hilly terrain if available",opts:["Long hike","Rucking","Trail run"],note:"Final long hike of Accumulation A.",exs:[]},
    {dn:"Sunday",dt:"Sep 27",type:R,title:"Rest / Sabbath",note:"Full rest. Accumulation A complete — 4 weeks of volume banked. Tempo/pause work begins Week 5.",exs:[]},
  ]},
  {w:5,ph:2,range:"Sep 28 – Oct 4",days:[
    {dn:"Monday",dt:"Sep 28",type:S,title:"Squat & Bench",restNote:"90 sec–2 min",exs:[
      ex("Back Squat","4 × 8 @ 75%",4,"Tempo: 3s controlled eccentric + 1s pause at the bottom — time-under-tension, not just load"),
      ex("Bench Press","4 × 8 @ 71%",4,"Tempo: 3s controlled lower, brief pause off the chest"),
      ex("Barbell Row","4 × 10 — add load",4,"Tempo: 3s controlled lowering on every rep"),
    ]},
    {dn:"Tuesday",dt:"Sep 29",type:Z,title:"Zone 2 — Trail/Run",dur:"50 min",intensity:"Conversational-pace trail run or brisk hike, nasal breathing",opts:["Trail run","Brisk hike","Neighborhood run"],note:"Duration ticks up as Accumulation B begins.",exs:[]},
    {dn:"Wednesday",dt:"Sep 30",type:S,title:"Deadlift & Upper",restNote:"2–3 min",exs:[
      ex("Conv. Deadlift","4 × 6 @ 75%",4,"Reps drop as tempo work starts — still no near-max singles this block"),
      ex("Overhead Press","4 × 8 @ 70%",4,"Tempo: 3s controlled lower on every rep"),
      ex("Pull-Ups / Row","4 × 8 — add load",4,"Reps pull back, load climbs — tempo emphasis on the lowering phase"),
    ]},
    {dn:"Thursday",dt:"Oct 1",type:Z,title:"Zone 2/3 — Tempo",dur:"40 min",intensity:"10 min Z2 warm-up, 20 min Z3 tempo (comfortably hard, sentence-only speech), 10 min Z2 cooldown",opts:["Outdoor run","Bike intervals","Rowing intervals"],note:"Tempo block extends to 20 min — Accumulation B gives Zone 3 more room.",exs:[]},
    {dn:"Friday",dt:"Oct 2",type:PW,title:"Hypertrophy + Conditioning",restNote:"45–60 sec",exs:[
      ex("DB Incline Press","3 × 10 — tempo",3,"3s controlled lower on every rep"),
      ex("Lateral Raise","3 × 12 — heavier",3,"Reps pull back slightly, load climbs"),
      ex("Face Pull","3 × 15",3,"Hold steady.",),
      ex("Conditioning Finisher","4 rounds — KB swings/carries",4,"Same as Week 4.",),
    ]},
    {dn:"Saturday",dt:"Oct 3",type:Z,title:"Zone 2 — Long Hike/Ruck",dur:"75–90 min",intensity:"Easy pace, hilly terrain if available",opts:["Long hike","Rucking","Trail run"],note:"Building endurance further into Accumulation B.",exs:[]},
    {dn:"Sunday",dt:"Oct 4",type:R,title:"Rest / Sabbath",note:"Full rest. First week of tempo work — expect different soreness than pure volume work.",exs:[]},
  ]},
  {w:6,ph:2,range:"Oct 5–11",days:[
    {dn:"Monday",dt:"Oct 5",type:S,title:"Squat & Bench",restNote:"90 sec–2 min",exs:[
      ex("Back Squat","4 × 8 @ 76%",4,"Same tempo — small load increase"),
      ex("Bench Press","4 × 8 @ 72%",4,"Same tempo — small load increase"),
      ex("Barbell Row","4 × 10 — add load",4,"Same tempo emphasis"),
    ]},
    {dn:"Tuesday",dt:"Oct 6",type:Z,title:"Zone 2 — Trail/Run",dur:"50 min",intensity:"Conversational-pace trail run or brisk hike, nasal breathing",opts:["Trail run","Brisk hike","Neighborhood run"],note:"Same as Week 5.",exs:[]},
    {dn:"Wednesday",dt:"Oct 7",type:S,title:"Deadlift & Upper",restNote:"2–3 min",exs:[
      ex("Conv. Deadlift","4 × 6 @ 76%",4,"Small load increase — still no near-max singles"),
      ex("Overhead Press","4 × 8 @ 71%",4,"Same tempo — small load increase"),
      ex("Pull-Ups / Row","4 × 8 — add load",4,"Same tempo emphasis"),
    ]},
    {dn:"Thursday",dt:"Oct 8",type:Z,title:"Zone 2/3 — Tempo",dur:"40 min",intensity:"10 min Z2 warm-up, 20 min Z3 tempo (comfortably hard, sentence-only speech), 10 min Z2 cooldown",opts:["Outdoor run","Bike intervals","Rowing intervals"],note:"Same structure as Week 5.",exs:[]},
    {dn:"Friday",dt:"Oct 9",type:PW,title:"Hypertrophy + Conditioning",restNote:"45–60 sec",exs:[
      ex("DB Incline Press","3 × 10 — add load",3,"Small load increase, tempo holds"),
      ex("Lateral Raise","3 × 12 — add load",3,"Small load increase"),
      ex("Face Pull","3 × 15",3,"Hold steady.",),
      ex("Conditioning Finisher","4 rounds — KB swings/carries",4,"Same as Week 5.",),
    ]},
    {dn:"Saturday",dt:"Oct 10",type:Z,title:"Zone 2 — Long Hike/Ruck",dur:"75–90 min",intensity:"Easy pace, hilly terrain if available",opts:["Long hike","Rucking","Trail run"],note:"Same as Week 5.",exs:[]},
    {dn:"Sunday",dt:"Oct 11",type:R,title:"Rest / Sabbath",note:"Full rest. Two weeks of tempo work banked.",exs:[]},
  ]},
  {w:7,ph:2,range:"Oct 12–18",days:[
    {dn:"Monday",dt:"Oct 12",type:S,title:"Squat & Bench",restNote:"90 sec–2 min",exs:[
      ex("Back Squat","4 × 8 @ 78%",4,"Heaviest week of the block — still well shy of anything near-max"),
      ex("Bench Press","4 × 8 @ 74%",4,"Heaviest bench of Accumulation B"),
      ex("Barbell Row","4 × 8 — heaviest",4,"Reps pull back to 8 as this week's load peaks"),
    ]},
    {dn:"Tuesday",dt:"Oct 13",type:Z,title:"Zone 2 — Trail/Run",dur:"50 min",intensity:"Conversational-pace trail run or brisk hike, nasal breathing",opts:["Trail run","Brisk hike","Neighborhood run"],note:"Same as Weeks 5–6.",exs:[]},
    {dn:"Wednesday",dt:"Oct 14",type:S,title:"Deadlift & Upper",restNote:"2–3 min",exs:[
      ex("Conv. Deadlift","4 × 6 @ 78%",4,"Heaviest deadlift of the block — the rule holds: no near-max singles in accumulation"),
      ex("Overhead Press","4 × 8 @ 73%",4,"Heaviest OHP of the block"),
      ex("Pull-Ups / Row","4 × 8 — heaviest",4,"Heaviest pulling of the block"),
    ]},
    {dn:"Thursday",dt:"Oct 15",type:Z,title:"Zone 2/3 — Tempo",dur:"40 min",intensity:"10 min Z2 warm-up, 20 min Z3 tempo (comfortably hard, sentence-only speech), 10 min Z2 cooldown",opts:["Outdoor run","Bike intervals","Rowing intervals"],note:"Same structure as Weeks 5–6.",exs:[]},
    {dn:"Friday",dt:"Oct 16",type:PW,title:"Hypertrophy + Conditioning",restNote:"45–60 sec",exs:[
      ex("DB Incline Press","3 × 8 — heaviest",3,"Reps pull back to 8 as load peaks"),
      ex("Lateral Raise","3 × 12",3,"Hold steady — this is a maintenance movement.",),
      ex("Face Pull","3 × 15",3,"Hold steady.",),
      ex("Conditioning Finisher","4 rounds — KB swings/carries",4,"Same as Weeks 5–6.",),
    ]},
    {dn:"Saturday",dt:"Oct 17",type:Z,title:"Zone 2 — Long Hike/Ruck",dur:"75–90 min",intensity:"Easy pace, hilly terrain if available",opts:["Long hike","Rucking","Trail run"],note:"Final long hike before the step-back week.",exs:[]},
    {dn:"Sunday",dt:"Oct 18",type:R,title:"Rest / Sabbath",note:"Full rest. Accumulation complete — 7 weeks of volume and tempo work banked. Transition week next.",exs:[]},
  ]},
  {w:8,ph:3,range:"Oct 19–25",days:[
    {dn:"Monday",dt:"Oct 19",type:S,title:"Squat & Bench (Step-Back)",restNote:"90 sec–2 min",exs:[
      ex("Back Squat","3 × 8 @ 68%",3,"Should feel noticeably easier than last week — that's the point"),
      ex("Bench Press","3 × 8 @ 65%",3,"Reduced sets and load — quality movement only"),
      ex("Barbell Row","3 × 10 — moderate",3,"Back to moderate load — do not push"),
    ]},
    {dn:"Tuesday",dt:"Oct 20",type:Z,title:"Zone 2 — Trail/Run (Easy)",dur:"30 min",intensity:"Easy, relaxed pace — taper week",opts:["Trail run","Brisk hike","Neighborhood run"],note:"Scaled back from 50 min — full step-back.",exs:[]},
    {dn:"Wednesday",dt:"Oct 21",type:S,title:"Deadlift & Upper (Step-Back)",restNote:"2–3 min",exs:[
      ex("Conv. Deadlift","3 × 6 @ 70%",3,"Light and controlled — movement quality, not loading"),
      ex("Overhead Press","3 × 8 @ 65%",3,"Easy effort — no grinding"),
      ex("Pull-Ups / Row","3 × 10 — moderate",3,"Easy pulling — just moving the body"),
    ]},
    {dn:"Thursday",dt:"Oct 22",type:Z,title:"Zone 2 — Easy",dur:"25 min",intensity:"Pure Zone 2, no tempo work this week — full step-back",opts:["Outdoor run","Bike easy","Rowing easy"],note:"No Zone 3 this week — the tempo emphasis pauses along with the strength load.",exs:[]},
    {dn:"Friday",dt:"Oct 23",type:PW,title:"Light Movement",restNote:"45–60 sec",exs:[
      ex("DB Incline Press","3 × 12 — light",3,"Easy movement — no intensity"),
      ex("Lateral Raise","2 × 15 — light",2,"Light and easy",),
      ex("Face Pull","2 × 15 — light",2,"Light and easy",),
      ex("Conditioning Finisher","2 rounds — KB swings/carries",2,"Scaled back — easy effort only.",),
    ]},
    {dn:"Saturday",dt:"Oct 24",type:Z,title:"Zone 2 — Easy",dur:"45 min",intensity:"Easy — whatever sounds enjoyable",opts:["Outdoor walk","Bike ride","Trail run"],note:"Optional easy outing. Celebrate completing 8 weeks!",exs:[]},
    {dn:"Sunday",dt:"Oct 25",type:R,title:"Rest / Sabbath",note:"BLOCK COMPLETE — Oct 25, 2026. Consolidate 8 weeks of accumulation work before the next cycle.",exs:[]},
  ]},
];

const BLOCK2_PROG = [
  {n:"Wk1",sq:68,dl:70,bp:65,ohp:65},{n:"Wk2",sq:70,dl:71,bp:67,ohp:66},{n:"Wk3",sq:71,dl:70,bp:68,ohp:66},
  {n:"Wk4",sq:73,dl:73,bp:69,ohp:68},{n:"Wk5",sq:75,dl:75,bp:71,ohp:70},{n:"Wk6",sq:76,dl:76,bp:72,ohp:71},
  {n:"Wk7",sq:78,dl:78,bp:74,ohp:73},{n:"Wk8↓",sq:68,dl:70,bp:65,ohp:65},
];

// ═══════════════════════════════════════════════════
// BLOCKS REGISTRY
// ═══════════════════════════════════════════════════
export const BLOCKS = [
  {
    id: "summer2026",
    label: "JB'S SUMMER TRAINING PLAN",
    dateRangeLabel: "JUN 1 – AUG 23, 2026",
    startDate: "2026-06-01",
    totalDays: 84, // 12 weeks
    PH: BLOCK1_PH,
    WEEKS: BLOCK1_WEEKS,
    WEEK_FOCUS: BLOCK1_WEEK_FOCUS,
    PROG: BLOCK1_PROG,
  },
  {
    id: "accum2026",
    label: "ACCUMULATION + CONDITIONING",
    dateRangeLabel: "AUG 31 – OCT 25, 2026",
    startDate: "2026-08-31",
    totalDays: 56, // 8 weeks
    PH: BLOCK2_PH,
    WEEKS: BLOCK2_WEEKS,
    WEEK_FOCUS: BLOCK2_WEEK_FOCUS,
    PROG: BLOCK2_PROG,
  },
];

// A previously-saved doc predates multi-block storage if it has the old
// flat shape (sets/weights/etc at the top level, no `blocks` key). The only
// block that existed before this migration was Block 1, so that's where its
// data belongs — wrapping it here means the migration is automatic and
// invisible, no export/reset ritual required. Both TrainingPlan.tsx and
// Dashboard.tsx read through this so they never disagree on doc shape.
export function migrateDoc(raw) {
  if (!raw) return { blocks: {} };
  if (raw.blocks) return raw;
  if (raw.sets || raw.weights || raw.cardio || raw.notes) {
    return { blocks: { [BLOCKS[0].id]: raw }, lastSaved: raw.lastSaved || null };
  }
  return { blocks: {} };
}

// Finds whichever block's window contains `at`. If none do (before the
// first block, in a reset gap between blocks, or after the last block
// ends), falls back to the most recently-started block whose start date
// has already passed (or the first block if none has), with active:false
// and a stable default day (Friday of Week 1) so the UI has something
// sensible to show rather than crashing.
export function selectBlockAt(at = new Date()) {
  for (const block of BLOCKS) {
    const start = new Date(block.startDate + "T00:00:00");
    const diff = Math.floor((at - start) / 86400000);
    if (diff >= 0 && diff < block.totalDays) {
      return { block, wIdx: Math.floor(diff / 7), dIdx: diff % 7, active: true };
    }
  }
  let fallback = BLOCKS[0];
  for (const block of BLOCKS) {
    const start = new Date(block.startDate + "T00:00:00");
    if (at >= start) fallback = block;
  }
  return { block: fallback, wIdx: 0, dIdx: 4, active: false };
}
