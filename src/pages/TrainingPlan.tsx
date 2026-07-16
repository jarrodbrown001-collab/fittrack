// @ts-nocheck
// JB's 12-week summer training plan (June 1 – Aug 23, 2026), ported from the
// standalone jbs-training-plan-2026 app. Deliberately untyped: this is a large,
// battle-tested JS component with its own self-contained styling (dark
// military aesthetic), kept as close to the original as possible. Persistence
// goes through FitTrack's storage layer ('training_plan' singleton) so the
// data is included in Settings → Export/Import backups.
import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { getTrainingPlanData, saveTrainingPlanData } from "../lib/api";

// ═══════════════════════════════════════════════════
// PHASE CONFIG
// ═══════════════════════════════════════════════════
export const PH = {
  1:{name:"FOUNDATION",icon:"🔵",c:"#3B82F6",r:"59,130,246",goal:"Establish movement patterns, build baseline conditioning, and prepare the body for the heavier loading ahead. Challenging but never grinding — finish every session feeling capable, not wrecked."},
  2:{name:"BUILD",icon:"🟡",c:"#F59E0B",r:"245,158,11",goal:"Increase loading and reduce reps on primary lifts. Add power volume on Fridays. The last 1–2 reps of heavy sets should feel genuinely hard but controlled."},
  3:{name:"INTENSIFY",icon:"🔴",c:"#EF4444",r:"239,68,68",goal:"Peak loading on primary lifts. Reps drop, intensity climbs. The hardest phase of the block — recovery becomes just as important as training."},
  4:{name:"PEAK",icon:"⚡",c:"#A855F7",r:"168,85,247",goal:"Express the strength you've built over 9 weeks. Push primary lifts to near-maximum, then true maximum. Warm-up sets matter more here than at any other point."},
  5:{name:"DELOAD",icon:"🟢",c:"#22C55E",r:"34,197,94",goal:"Full, deliberate recovery. Volume drops ~35–40%, intensity stays moderate. Sessions should feel almost too easy — that's exactly the point."},
};
export const S="strength",PW="power",Z="zone2",R="rest";
const ex=(n,p,s,note)=>({n,p,s,note});

// Per-week "what you're targeting this week" reminders
const WEEK_FOCUS = {
  1:"Build baseline conditioning and establish clean movement patterns on every lift.",
  2:"Add 2.5–5 lb where Week 1 was clean. Same patterns, incrementally heavier.",
  3:"Heaviest week of Foundation — hit phase-high loads on every primary lift before the reset.",
  4:"Reps drop, load climbs. First taste of Build-phase intensity — stay composed.",
  5:"Heaviest Build-phase loading — the week before the planned mid-block reset.",
  6:"Mandatory reset week. Load and volume drop on purpose — do not push through it.",
  7:"Intensify begins. Reps drop to 2–3, loads climb into the high-80% range.",
  8:"Highest total Monday load of the block so far — stay disciplined on recovery days.",
  9:"Final Intensify week — near-single deadlift efforts. Arrive at Peak phase fresh.",
  10:"Near-max effort week. Work to a heavy 2–3RM on squat/bench and a heavy 2RM on deadlift.",
  11:"True max week — attempt new 1RM PRs on squat, bench, and deadlift. Log every number.",
  12:"Deload. Full recovery — reduce volume ~35–40%, keep loads light. Consolidate 11 weeks of work.",
};

// ═══════════════════════════════════════════════════
// 12-WEEK WORKOUT DATA
// ═══════════════════════════════════════════════════
export const WEEKS=[
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

// ═══════════════════════════════════════════════════
// PROGRESSION DATA
// ═══════════════════════════════════════════════════
const PROG=[
  {n:"Wk1",sq:73,dl:76,bp:70,ohp:66,pp:null},{n:"Wk2",sq:76,dl:78,bp:73,ohp:68,pp:58},{n:"Wk3",sq:79,dl:80,bp:76,ohp:70,pp:61},
  {n:"Wk4",sq:82,dl:83,bp:79,ohp:73,pp:63},{n:"Wk5",sq:84,dl:85,bp:81,ohp:75,pp:66},{n:"Wk6↓",sq:76,dl:78,bp:73,ohp:69,pp:null},
  {n:"Wk7",sq:86,dl:87,bp:82,ohp:77,pp:67},{n:"Wk8",sq:87,dl:89,bp:84,ohp:79,pp:70},{n:"Wk9",sq:89,dl:91,bp:86,ohp:81,pp:72},
  {n:"Wk10",sq:93,dl:95,bp:93,ohp:93,pp:70},{n:"Wk11",sq:100,dl:100,bp:100,ohp:100,pp:null},{n:"Wk12↓",sq:65,dl:65,bp:65,ohp:65,pp:null},
];

// Lift display config for the consolidated load progression chart/table
const LIFT_CONFIG = [
  { key:"sq",  label:"Squat",      shortLabel:"SQ",  name:"Back Squat",      color:"#3B82F6" },
  { key:"dl",  label:"Deadlift",   shortLabel:"DL",  name:"Deadlift",        color:"#F97316" },
  { key:"bp",  label:"Bench",      shortLabel:"BP",  name:"Bench Press",     color:"#22C55E" },
  { key:"ohp", label:"OHP",        shortLabel:"OHP", name:"Overhead Press",  color:"#A855F7" },
  { key:"pp",  label:"Push Press", shortLabel:"PP",  name:"Overhead Press",  color:"#EC4899" }, // % is of OHP 1RM per program
  { key:"row", label:"Row/Pull-Ups", shortLabel:"ROW", name:"Row / Pull-Ups", color:"#06B6D4", noPercent:true }, // no %1RM prescribed — actual lbs logged
  { key:"rdl", label:"Romanian DL",  shortLabel:"RDL", name:"Romanian DL",    color:"#FACC15", noPercent:true }, // no %1RM prescribed — actual lbs logged
];

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
export function getBlockPos() {
  const start = new Date('2026-06-01');
  const now = new Date();
  const diff = Math.floor((now - start) / 86400000);
  if (diff < 0 || diff >= 84) return { wIdx: 0, dIdx: 4, active: false };
  return { wIdx: Math.floor(diff / 7), dIdx: diff % 7, active: true };
}

// ═══════════════════════════════════════════════════
// LIFT TRACKING HELPERS
// ═══════════════════════════════════════════════════
function canonical(name) {
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

function parseReps(p) {
  let m = p.match(/×\s*(\d+)/);
  if (m) return parseInt(m[1]);
  m = p.match(/(\d+)[–\-]?\d*\s*RM/i);
  if (m) return parseInt(m[1]);
  return 1;
}

function parsePct(p) {
  const m = p.match(/@\s*(\d+)%/);
  return m ? parseInt(m[1]) : null;
}

// Some prescriptions reference a percentage of a DIFFERENT lift's 1RM
// (e.g. Push Press "@ 63% OHP" is 63% of Overhead Press 1RM, not Push Press's own).
function getPctLiftName(ex) {
  if (/OHP/i.test(ex.p)) return "Overhead Press";
  return canonical(ex.n);
}

function calcTargetWeight(pct, oneRM) {
  if (!oneRM || !pct) return null;
  return Math.round((oneRM * pct / 100) / 5) * 5;
}

const MONTH_NUM = { June:6, July:7, Aug:8, August:8 };
function fmtDate(dt) {
  // dt is like "June 1" or "Aug 3" or "June 29 – July 5" (range, take first)
  const first = dt.split(/[–-]/)[0].trim();
  const [mon, day] = first.split(/\s+/);
  const m = MONTH_NUM[mon];
  return m ? `${m}/${parseInt(day)}` : dt;
}

function fmtTimeAgo(iso) {
  if (!iso) return null;
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const d = new Date(iso);
  const t = d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return `yesterday ${t}`;
  return `${d.getMonth()+1}/${d.getDate()} ${t}`;
}

function computeMaxes(weights, completedSets) {
  const result = {};
  WEEKS.forEach((wk, wIdx) => {
    wk.days.forEach((day, dIdx) => {
      day.exs.forEach((ex, exIdx) => {
        const cName = canonical(ex.n);
        if (!cName || ex.s === 0) return;
        const setsCompleted = completedSets[`${wIdx}-${dIdx}-${exIdx}`] || 0;
        if (setsCompleted === 0) return;
        const reps = parseReps(ex.p);
        let bestW = 0;
        for (let s = 0; s < setsCompleted; s++) {
          const w = parseFloat(weights[`${wIdx}-${dIdx}-${exIdx}-${s}`] || "0");
          if (w > bestW) bestW = w;
        }
        if (bestW === 0) return;
        const est1RM = reps === 1 ? bestW : Math.round(bestW * (1 + reps / 30));
        if (!result[cName]) result[cName] = { maxWeight:0, maxReps:1, max1RM:0, maxDate:"", maxWeek:0, history:[] };
        const entry = { week:wk.w, date:day.dt, weight:bestW, reps, est1RM };
        const hi = result[cName].history.findIndex(h => h.week===wk.w && h.date===day.dt);
        if (hi >= 0) { if (est1RM > result[cName].history[hi].est1RM) result[cName].history[hi] = entry; }
        else result[cName].history.push(entry);
        if (est1RM > result[cName].max1RM) {
          Object.assign(result[cName], { maxWeight:bestW, maxReps:reps, max1RM:est1RM, maxDate:day.dt, maxWeek:wk.w });
        }
      });
    });
  });
  return result;
}

// ═══════════════════════════════════════════════════
// WORKOUT DAY RENDERER
// ═══════════════════════════════════════════════════
function WorkoutView({ week, day, wIdx, dIdx, completedSets, onToggle, weights, onWeight, cardio, onCardio, activities, onActivity, notes, onNote, setNotes: repNotes, onSetNote, maxes, customExercises, onCustomEx }) {
  const ph = PH[week.ph];

  if (day.type === R) {
    const rKey = `${wIdx}-${dIdx}`;
    const cExs = customExercises[rKey] || [];
    const addEx = () => onCustomEx(rKey, [...cExs, {id:Date.now(), name:"", setsReps:"", weight:"", note:""}]);
    const removeEx = idx => onCustomEx(rKey, cExs.filter((_,i)=>i!==idx));
    const updateEx = (idx, field, val) => { const a=[...cExs]; a[idx]={...a[idx],[field]:val}; onCustomEx(rKey, a); };
    return (
      <div style={{ padding:"20px 16px" }}>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:48 }}>✝️</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:30, color:"#F0F4FF", letterSpacing:3, marginTop:10 }}>
            REST / SABBATH
          </div>
        </div>

        {/* Optional exercises */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:10, color:"#6B7280", fontFamily:"'JetBrains Mono',monospace", letterSpacing:2 }}>OPTIONAL EXERCISES</div>
            <button onClick={addEx} style={{ background:`rgba(${ph.r},0.12)`, border:`1px solid rgba(${ph.r},0.35)`, color:ph.c, borderRadius:6, padding:"5px 12px", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13, letterSpacing:1, cursor:"pointer" }}>
              + ADD EXERCISE
            </button>
          </div>
          {cExs.length === 0 && (
            <div style={{ fontSize:12, color:"#374151", fontStyle:"italic", padding:"10px 0" }}>No exercises added — tap above to add one.</div>
          )}
          {cExs.map((ex, idx) => (
            <div key={ex.id} style={{ background:"rgba(255,255,255,0.03)", borderRadius:10, padding:"12px 14px", marginBottom:10, border:"1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <input
                  type="text" value={ex.name}
                  onChange={e=>updateEx(idx,"name",e.target.value)}
                  placeholder="Exercise name..."
                  style={{ flex:1, height:34, borderRadius:8, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)", color:"#F0F4FF", fontSize:13, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, padding:"0 10px", outline:"none" }}
                />
                <button onClick={()=>removeEx(idx)} style={{ width:34, height:34, borderRadius:8, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", color:"#EF4444", fontSize:14, cursor:"pointer", flexShrink:0 }}>✕</button>
              </div>
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <input
                  type="text" value={ex.setsReps}
                  onChange={e=>updateEx(idx,"setsReps",e.target.value)}
                  placeholder="Sets × Reps (e.g. 3 × 10)"
                  style={{ flex:1, height:34, borderRadius:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#C9D1E0", fontSize:12, fontFamily:"'JetBrains Mono',monospace", padding:"0 10px", outline:"none" }}
                />
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <input
                    type="number" value={ex.weight}
                    onChange={e=>updateEx(idx,"weight",e.target.value)}
                    placeholder="0"
                    style={{ width:70, height:34, borderRadius:8, background:"rgba(255,255,255,0.04)", border:`1px solid ${ex.weight?`rgba(${ph.r},0.35)`:"rgba(255,255,255,0.08)"}`, color:ex.weight?ph.c:"#9CA3AF", fontSize:13, fontFamily:"'JetBrains Mono',monospace", textAlign:"center", padding:"0 6px", outline:"none", WebkitAppearance:"none", MozAppearance:"textfield" }}
                  />
                  <span style={{ fontSize:11, color:"#4B5563" }}>lbs</span>
                </div>
              </div>
              <input
                type="text" value={ex.note}
                onChange={e=>updateEx(idx,"note",e.target.value)}
                placeholder="Note (optional)..."
                style={{ width:"100%", height:32, borderRadius:8, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", color:"#9CA3AF", fontSize:12, fontFamily:"'JetBrains Mono',monospace", padding:"0 10px", outline:"none" }}
              />
            </div>
          ))}
        </div>

        {/* Notes */}
        <div>
          <div style={{ fontSize:10, color:"#6B7280", fontFamily:"'JetBrains Mono',monospace", letterSpacing:2, marginBottom:8 }}>NOTES</div>
          <textarea
            value={notes[rKey] || ""}
            onChange={ev=>onNote(rKey, ev.target.value)}
            placeholder="Thoughts, reflections, anything worth recording..."
            style={{ width:"100%", minHeight:80, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#C9D1E0", fontSize:12, fontFamily:"'JetBrains Mono',monospace", padding:"10px 12px", resize:"vertical", outline:"none", lineHeight:1.6, display:"block" }}
          />
        </div>
      </div>
    );
  }

  if (day.type === Z) {
    const z2Key = `${wIdx}-${dIdx}`;
    const z2Done = cardio[z2Key] || false;
    const baseOpts = day.opts ? [...day.opts] : [];
    if (!baseOpts.includes("Outdoor Run")) baseOpts.push("Outdoor Run");
    if (!baseOpts.includes("Treadmill")) baseOpts.push("Treadmill");
    const opts = baseOpts.concat(["Other", "N/A — Skipped"]);
    return (
      <div style={{ padding:"16px" }}>
        <div style={{ background:`rgba(${ph.r},0.06)`, border:`1px solid rgba(${ph.r},0.25)`, borderRadius:12, padding:"20px" }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:18, color:ph.c, letterSpacing:2, marginBottom:18 }}>
            🏃 AEROBIC / ZONE 2
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:18 }}>
            <div>
              <div style={{ fontSize:10, color:"#6B7280", fontFamily:"'JetBrains Mono',monospace", letterSpacing:2, marginBottom:5 }}>DURATION</div>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:28, color:"#F0F4FF" }}>{day.dur}</div>
            </div>
            <div>
              <div style={{ fontSize:10, color:"#6B7280", fontFamily:"'JetBrains Mono',monospace", letterSpacing:2, marginBottom:5 }}>INTENSITY</div>
              <div style={{ fontSize:12, color:"#C9D1E0", lineHeight:1.5 }}>{day.intensity}</div>
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, color:"#6B7280", fontFamily:"'JetBrains Mono',monospace", letterSpacing:2, marginBottom:8 }}>ACTIVITY — SELECT WHAT YOU DID</div>
            <div>
              {opts.map((o, oi) => {
                const acts = activities[z2Key] || [];
                const checked = acts[oi] || false;
                return (
                  <div key={o} onClick={() => {
                    const cur = activities[z2Key] || Array(opts.length).fill(false);
                    const next = [...cur]; next[oi] = !checked;
                    onActivity(z2Key, next);
                  }} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:8, background:checked?`rgba(${ph.r},0.1)`:"rgba(255,255,255,0.03)", border:`1px solid ${checked?`rgba(${ph.r},0.35)`:"rgba(255,255,255,0.08)"}`, cursor:"pointer", marginBottom:6, transition:"all 0.15s" }}>
                    <div style={{ width:20, height:20, borderRadius:5, border:`2px solid ${checked?ph.c:"rgba(255,255,255,0.2)"}`, background:checked?ph.c:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
                      {checked && <span style={{ color:"#000", fontSize:11, fontWeight:900, lineHeight:1 }}>✓</span>}
                    </div>
                    <span style={{ fontSize:14, color:checked?ph.c:"#9CA3AF", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, letterSpacing:0.5 }}>{o}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {day.note && <div style={{ padding:"10px 14px", background:"rgba(255,255,255,0.03)", borderRadius:8, fontSize:12, color:"#9CA3AF", fontStyle:"italic", lineHeight:1.5, marginBottom:16 }}>{day.note}</div>}

          {/* ── SESSION NOTES ── */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, color:"#6B7280", fontFamily:"'JetBrains Mono',monospace", letterSpacing:2, marginBottom:8 }}>SESSION NOTES</div>
            <textarea
              value={notes[z2Key] || ""}
              onChange={ev => onNote(z2Key, ev.target.value)}
              placeholder="Distance, duration, how you felt, conditions..."
              style={{ width:"100%", minHeight:76, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#C9D1E0", fontSize:12, fontFamily:"'JetBrains Mono',monospace", padding:"10px 12px", resize:"vertical", outline:"none", lineHeight:1.6, display:"block" }}
            />
          </div>

          {/* ── COMPLETION TOGGLE ── */}
          <button
            onClick={() => onCardio(z2Key, !z2Done)}
            style={{ width:"100%", padding:"14px 20px", borderRadius:10, background:z2Done?"rgba(34,197,94,0.1)":"rgba(255,255,255,0.04)", border:z2Done?"1px solid rgba(34,197,94,0.45)":"1px solid rgba(255,255,255,0.12)", color:z2Done?"#22C55E":"#6B7280", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:17, letterSpacing:2, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:12, transition:"all 0.2s" }}>
            <span style={{ width:26, height:26, borderRadius:6, border:z2Done?"2px solid #22C55E":"2px solid rgba(255,255,255,0.2)", background:z2Done?"#22C55E":"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#000", flexShrink:0, transition:"all 0.2s" }}>
              {z2Done?"✓":""}
            </span>
            {z2Done ? "SESSION COMPLETE" : "MARK SESSION COMPLETE"}
          </button>
        </div>
      </div>
    );
  }

  const getKey = i => `${wIdx}-${dIdx}-${i}`;
  const getDone = i => completedSets[getKey(i)] || 0;
  const totalSets = day.exs.reduce((s, e) => s + e.s, 0);
  const doneSets = day.exs.reduce((s, e, i) => s + Math.min(getDone(i), e.s), 0);
  const pct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;

  return (
    <div>
      <div style={{ padding:"12px 16px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
          <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:"#4B5563", letterSpacing:1 }}>
            REST: {day.restNote}
          </div>
          <div style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", color: pct===100?"#22C55E":ph.c, fontWeight:600 }}>
            {pct===100?"✓ DONE":`${pct}%`}
          </div>
        </div>
        <div style={{ height:3, background:"rgba(255,255,255,0.06)", borderRadius:2, marginBottom:14 }}>
          <div style={{ height:"100%", borderRadius:2, background:pct===100?"#22C55E":ph.c, width:`${pct}%`, transition:"width 0.3s ease" }} />
        </div>
      </div>

      {day.exs.map((e, ei) => {
        const done = getDone(ei);
        const isSkip = e.s === 0;
        const allDone = !isSkip && done >= e.s;
        return (
          <div key={ei} style={{ padding:"14px 16px", borderBottom:"1px solid rgba(255,255,255,0.04)", background:allDone?`rgba(${ph.r},0.07)`:"transparent", opacity:isSkip?0.32:1, transition:"background 0.25s" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:isSkip?0:10 }}>
              <div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:16, color:allDone?ph.c:"#F0F4FF", letterSpacing:0.5 }}>
                  {allDone?"✓ ":""}{e.n.toUpperCase()}
                </div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:isSkip?"#6B7280":ph.c, marginTop:3 }}>
                  {e.p}
                  {(() => {
                    const pct = parsePct(e.p);
                    if (!pct) return null;
                    const liftName = getPctLiftName(e);
                    const oneRM = liftName && maxes[liftName] ? maxes[liftName].max1RM : null;
                    const target = calcTargetWeight(pct, oneRM);
                    return target
                      ? <span style={{ color:"#F0F4FF", fontWeight:700 }}> ≈ {target} lbs</span>
                      : <span style={{ color:"#4B5563", fontStyle:"italic" }}> · log a {liftName} max to calculate</span>;
                  })()}
                </div>
              </div>
              {!isSkip && <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:20, fontWeight:600, color:allDone?ph.c:"#374151" }}>{done}/{e.s}</div>}
            </div>

            {/* Coaching note — displayed before set tracking */}
            {e.note && !isSkip && (
              <div style={{ display:"flex", gap:8, alignItems:"flex-start", padding:"8px 10px", borderRadius:8, background:`rgba(${ph.r},0.06)`, border:`1px solid rgba(${ph.r},0.18)`, marginBottom:10 }}>
                <span style={{ fontSize:13, flexShrink:0, marginTop:1 }}>📋</span>
                <div style={{ fontSize:11, color:"#C9D1E0", lineHeight:1.55, fontStyle:"italic" }}>{e.note}</div>
              </div>
            )}

            {!isSkip && e.s > 0 && (
              <div style={{ marginBottom:e.note?10:0 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:5, padding:"0 2px" }}>
                  <div style={{ width:34, fontSize:9, color:"#374151", fontFamily:"'JetBrains Mono',monospace", letterSpacing:1, textAlign:"center" }}>SET</div>
                  <div style={{ width:90, fontSize:9, color:"#374151", fontFamily:"'JetBrains Mono',monospace", letterSpacing:1 }}>WEIGHT</div>
                  <div style={{ flex:1, fontSize:9, color:"#374151", fontFamily:"'JetBrains Mono',monospace", letterSpacing:1 }}>NOTE</div>
                </div>
                {Array.from({length:e.s}).map((_,i) => {
                  const filled = i < done;
                  const wKey = `${wIdx}-${dIdx}-${ei}-${i}`;
                  const wVal = weights[wKey] || "";
                  const snVal = repNotes[wKey] || "";
                  return (
                    <div key={i} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:5, flexWrap:"wrap" }}>
                      <button
                        onClick={() => onToggle(getKey(ei), i<done?i:i+1)}
                        style={{ width:34, height:34, borderRadius:8, background:filled?ph.c:"transparent", border:`2px solid ${filled?ph.c:"rgba(255,255,255,0.14)"}`, cursor:"pointer", padding:0, color:filled?"#000":"#4B5563", fontSize:11, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, transition:"all 0.15s ease", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        {filled?"✓":i+1}
                      </button>
                      <div style={{ display:"flex", alignItems:"center", gap:6, width:90, flexShrink:0 }}>
                        <input
                          type="number"
                          min="0"
                          step="2.5"
                          value={wVal}
                          onChange={ev => onWeight(wKey, ev.target.value)}
                          placeholder="—"
                          style={{ width:62, height:34, borderRadius:8, background:"rgba(255,255,255,0.05)", border:`1px solid ${filled?`rgba(${ph.r},0.35)`:"rgba(255,255,255,0.1)"}`, color:filled?ph.c:"#9CA3AF", fontSize:14, fontFamily:"'JetBrains Mono',monospace", fontWeight:filled?600:400, textAlign:"center", padding:"0 6px", outline:"none", transition:"all 0.15s", WebkitAppearance:"none", MozAppearance:"textfield" }}
                        />
                        <span style={{ fontSize:11, color:"#4B5563", letterSpacing:1 }}>lbs</span>
                      </div>
                      <input
                        type="text"
                        value={snVal}
                        onChange={ev => onSetNote(wKey, ev.target.value)}
                        placeholder="note..."
                        style={{ flex:1, minWidth:100, height:34, borderRadius:8, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", color:"#9CA3AF", fontSize:12, fontFamily:"'JetBrains Mono',monospace", padding:"0 10px", outline:"none", transition:"all 0.15s" }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ── SESSION NOTES ── */}
      <div style={{ padding:"14px 16px 4px" }}>
        <div style={{ fontSize:10, color:"#6B7280", fontFamily:"'JetBrains Mono',monospace", letterSpacing:2, marginBottom:8 }}>SESSION NOTES</div>
        <textarea
          value={notes[`${wIdx}-${dIdx}`] || ""}
          onChange={ev => onNote(`${wIdx}-${dIdx}`, ev.target.value)}
          placeholder="PRs, form cues, how you felt, adjustments made..."
          style={{ width:"100%", minHeight:76, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#C9D1E0", fontSize:12, fontFamily:"'JetBrains Mono',monospace", padding:"10px 12px", resize:"vertical", outline:"none", lineHeight:1.6, display:"block" }}
        />
      </div>

      {/* ── SESSION COMPLETE ── */}
      {(() => {
        const sKey = `${wIdx}-${dIdx}`;
        const sDone = cardio[sKey] || false;
        return (
          <div style={{ padding:"14px 16px 20px" }}>
            <button
              onClick={() => onCardio(sKey, !sDone)}
              style={{ width:"100%", padding:"14px 20px", borderRadius:10, background:sDone?"rgba(34,197,94,0.1)":"rgba(255,255,255,0.04)", border:sDone?"1px solid rgba(34,197,94,0.45)":"1px solid rgba(255,255,255,0.12)", color:sDone?"#22C55E":"#6B7280", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:17, letterSpacing:2, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:12, transition:"all 0.2s" }}>
              <span style={{ width:26, height:26, borderRadius:6, border:sDone?"2px solid #22C55E":"2px solid rgba(255,255,255,0.2)", background:sDone?"#22C55E":"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#000", flexShrink:0, transition:"all 0.2s" }}>
                {sDone ? "✓" : ""}
              </span>
              {sDone ? "SESSION COMPLETE" : "MARK SESSION COMPLETE"}
            </button>
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAXES TAB
// ═══════════════════════════════════════════════════
function MaxesTab({ weights, completedSets, notes, onNote, ph }) {
  const maxes = useMemo(() => computeMaxes(weights, completedSets), [weights, completedSets]);
  const [expanded, setExpanded] = useState({});
  const CARD = "#0F1320", BORDER = "rgba(255,255,255,0.07)";
  const PRIMARY   = ["Back Squat","Bench Press","Deadlift","Overhead Press"];
  const SECONDARY = ["Push Press","Romanian DL","Row / Pull-Ups"];

  const renderCard = (name, isPrimary) => {
    const data  = maxes[name];
    const noteKey = `1rm-${name}`;
    const isExp = expanded[name] || false;
    return (
      <div key={name} style={{ borderRadius:10, padding:"14px 16px", background:CARD, border:`1px solid ${data?`rgba(${ph.r},0.25)`:BORDER}`, marginBottom:12 }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:data?14:10 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:isPrimary?18:15, color:data?ph.c:"#4B5563", letterSpacing:1 }}>
            {name.toUpperCase()}
          </div>
          {!data && <span style={{ fontSize:10, color:"#374151", fontFamily:"'JetBrains Mono',monospace", letterSpacing:1 }}>NO DATA YET — LOG SETS TO POPULATE</span>}
        </div>
        {/* Stats */}
        {data && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:8, padding:"12px 14px" }}>
                <div style={{ fontSize:9, color:"#6B7280", fontFamily:"'JetBrains Mono',monospace", letterSpacing:2, marginBottom:6 }}>MAX WEIGHT</div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:isPrimary?28:22, color:"#F0F4FF", lineHeight:1 }}>
                  {data.maxWeight}<span style={{ fontSize:13, fontWeight:400 }}> lbs</span>
                </div>
                <div style={{ fontSize:10, color:"#6B7280", marginTop:5 }}>{data.maxReps} rep{data.maxReps!==1?"s":""} · Wk{data.maxWeek} · {data.maxDate}</div>
              </div>
              <div style={{ background:`rgba(${ph.r},0.08)`, border:`1px solid rgba(${ph.r},0.2)`, borderRadius:8, padding:"12px 14px" }}>
                <div style={{ fontSize:9, color:"#6B7280", fontFamily:"'JetBrains Mono',monospace", letterSpacing:2, marginBottom:6 }}>EST. 1RM</div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:isPrimary?28:22, color:ph.c, lineHeight:1 }}>
                  {data.max1RM}<span style={{ fontSize:13, fontWeight:400 }}> lbs</span>
                </div>
                <div style={{ fontSize:10, color:"#6B7280", marginTop:5 }}>Epley: w×(1+r÷30)</div>
              </div>
            </div>
            {/* History toggle */}
            <button onClick={() => setExpanded(e => ({...e,[name]:!isExp}))} style={{ width:"100%", background:"transparent", border:`1px solid rgba(255,255,255,0.08)`, color:"#6B7280", borderRadius:6, padding:"7px 12px", fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:1, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:isExp?8:12 }}>
              <span>SESSION HISTORY ({data.history.length} session{data.history.length!==1?"s":""})</span>
              <span>{isExp?"▲":"▼"}</span>
            </button>
            {isExp && (
              <div style={{ border:`1px solid rgba(255,255,255,0.06)`, borderRadius:8, overflow:"hidden", marginBottom:12 }}>
                <div style={{ display:"grid", gridTemplateColumns:"36px 88px 82px 44px 82px", padding:"6px 12px", background:"rgba(255,255,255,0.04)" }}>
                  {["WK","DATE","WEIGHT","REPS","EST 1RM"].map(h=>(
                    <div key={h} style={{ fontSize:8, color:"#4B5563", fontFamily:"'JetBrains Mono',monospace", letterSpacing:1 }}>{h}</div>
                  ))}
                </div>
                {[...data.history].sort((a,b)=>a.week-b.week).map((h,i)=>(
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"36px 88px 82px 44px 82px", padding:"8px 12px", borderTop:"1px solid rgba(255,255,255,0.03)", background:i%2===0?"transparent":"rgba(255,255,255,0.015)" }}>
                    <div style={{ fontSize:11, color:"#6B7280", fontFamily:"'JetBrains Mono',monospace" }}>W{h.week}</div>
                    <div style={{ fontSize:11, color:"#9CA3AF" }}>{h.date}</div>
                    <div style={{ fontSize:11, color:"#F0F4FF", fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>{h.weight} lbs</div>
                    <div style={{ fontSize:11, color:"#6B7280", fontFamily:"'JetBrains Mono',monospace" }}>{h.reps}</div>
                    <div style={{ fontSize:11, color:ph.c, fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>{h.est1RM} lbs</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {/* Notes */}
        <div>
          <div style={{ fontSize:10, color:"#6B7280", fontFamily:"'JetBrains Mono',monospace", letterSpacing:2, marginBottom:6 }}>NOTES / 1RM CONTEXT</div>
          <textarea
            value={notes[noteKey] || ""}
            onChange={ev => onNote(noteKey, ev.target.value)}
            placeholder={`Goals, equipment, conditions, true max vs estimated...`}
            style={{ width:"100%", minHeight:60, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#C9D1E0", fontSize:12, fontFamily:"'JetBrains Mono',monospace", padding:"8px 12px", resize:"vertical", outline:"none", lineHeight:1.6, display:"block" }}
          />
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding:"16px 18px" }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:22, letterSpacing:2 }}>LIFT TRACKER — MAX & 1RM</div>
        <div style={{ fontSize:11, color:"#6B7280", marginTop:4 }}>Auto-populated from your logged sessions · Epley formula · tap history to expand</div>
      </div>
      <div style={{ fontSize:10, color:ph.c, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:2, marginBottom:10, opacity:0.8 }}>── PRIMARY LIFTS ──</div>
      {PRIMARY.map(n => renderCard(n, true))}
      <div style={{ fontSize:10, color:"#4B5563", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:2, margin:"20px 0 10px" }}>── ACCESSORY LIFTS ──</div>
      {SECONDARY.map(n => renderCard(n, false))}
      <div style={{ height:40 }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════
// PHASE + WEEK FOCUS BANNER
// ═══════════════════════════════════════════════════
function PhaseWeekBanner({ week, ph }) {
  return (
    <div style={{ padding:"12px 14px", borderRadius:10, background:`rgba(${ph.r},0.06)`, border:`1px solid rgba(${ph.r},0.2)`, marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:5 }}>
        <span style={{ fontSize:13 }}>{ph.icon}</span>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:13, color:ph.c, letterSpacing:1.5 }}>
          PHASE {week.ph} — {ph.name}
        </span>
      </div>
      <div style={{ fontSize:11, color:"#9CA3AF", lineHeight:1.55, marginBottom:8 }}>{ph.goal}</div>
      <div style={{ height:1, background:`rgba(${ph.r},0.15)`, marginBottom:8 }} />
      <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:3 }}>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11, color:"#F0F4FF", letterSpacing:1 }}>
          THIS WEEK'S FOCUS
        </span>
      </div>
      <div style={{ fontSize:11, color:"#9CA3AF", lineHeight:1.55 }}>{WEEK_FOCUS[week.w]}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════
export function TrainingPlan() {
  const pos = getBlockPos();
  const [tab, setTab] = useState("today");
  const [wIdx, setWIdx] = useState(pos.wIdx);
  const [dIdx, setDIdx] = useState(pos.dIdx);
  const [completedSets, setCompletedSets] = useState({});
  const [weights, setWeights] = useState({});
  const [cardio, setCardio] = useState({});
  const [activities, setActivities] = useState({});
  const [notes, setNotes] = useState({});
  const [repNotes, setRepNotes] = useState({});
  const [customExercises, setCustomExercises] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const applyData = d => {
    setCompletedSets(d.sets || {});
    setWeights(d.weights || {});
    setCardio(d.cardio || {});
    setActivities(d.activities || {});
    setNotes(d.notes || {});
    setRepNotes(d.setNotes || {});
    setCustomExercises(d.customExercises || {});
    setLastSaved(d.lastSaved || null);
  };

  useEffect(() => {
    (async () => {
      try {
        const d = await getTrainingPlanData();
        if (d) applyData(d);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const save = async (sets, wts, crd, acts, nts, rns, cex) => {
    const ts = new Date().toISOString();
    const data = {sets, weights:wts, cardio:crd, activities:acts, notes:nts, setNotes:rns, customExercises:cex, lastSaved:ts};
    setSaveStatus("saving");
    try {
      await saveTrainingPlanData(data);
      setLastSaved(ts);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  };

  const handleToggle = async (key, count) => {
    const ns = { ...completedSets, [key]: count };
    setCompletedSets(ns);
    await save(ns, weights, cardio, activities, notes, repNotes, customExercises);
  };

  const handleWeight = async (key, val) => {
    const nw = { ...weights, [key]: val };
    setWeights(nw);
    await save(completedSets, nw, cardio, activities, notes, repNotes, customExercises);
  };

  const handleCardio = async (key, val) => {
    const nc = { ...cardio, [key]: val };
    setCardio(nc);
    await save(completedSets, weights, nc, activities, notes, repNotes, customExercises);
  };

  const handleActivity = async (key, val) => {
    const na = { ...activities, [key]: val };
    setActivities(na);
    await save(completedSets, weights, cardio, na, notes, repNotes, customExercises);
  };

  const handleNote = async (key, val) => {
    const nn = { ...notes, [key]: val };
    setNotes(nn);
    await save(completedSets, weights, cardio, activities, nn, repNotes, customExercises);
  };

  const handleSetNote = async (key, val) => {
    const nrn = { ...repNotes, [key]: val };
    setRepNotes(nrn);
    await save(completedSets, weights, cardio, activities, notes, nrn, customExercises);
  };

  const handleCustomEx = async (key, val) => {
    const nc = { ...customExercises, [key]: val };
    setCustomExercises(nc);
    await save(completedSets, weights, cardio, activities, notes, repNotes, nc);
  };

  const handleReset = async () => {
    setCompletedSets({});
    setWeights({});
    setCardio({});
    setActivities({});
    setNotes({});
    setRepNotes({});
    setCustomExercises({});
    await save({}, {}, {}, {}, {}, {}, {});
    setShowResetConfirm(false);
  };

  const week = WEEKS[wIdx];
  const day = week.days[dIdx];
  const ph = PH[week.ph];
  const BG = "#0A0D14", CARD = "#0F1320", BORDER = "rgba(255,255,255,0.07)";

  // Block completion %
  const totalAllSets = WEEKS.reduce((a,wk)=>a+wk.days.reduce((b,d)=>b+d.exs.reduce((c,e)=>c+e.s,0),0),0);
  const doneAllSets = Object.values(completedSets).reduce((a,v)=>a+v,0);
  const overallPct = totalAllSets > 0 ? Math.round(Math.min((doneAllSets/totalAllSets)*100, 100)) : 0;

  // Live 1RM estimates — drives target weight calculations across all workouts
  const maxes = useMemo(() => computeMaxes(weights, completedSets), [weights, completedSets]);

  if (!loaded) return (
    <div style={{ background:BG, height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:"#4B5563", fontFamily:"'JetBrains Mono',monospace", fontSize:12, letterSpacing:2 }}>
      LOADING...
    </div>
  );

  return (
    <div className="jb-plan" style={{ background:BG, minHeight:"100vh", color:"#F0F4FF", fontFamily:"'JetBrains Mono',monospace" }}>
      {/* Scoped to .jb-plan — fonts and scrollbars come from the app-wide
          theme (src/index.css). A global reset here would leak out of this
          page and beat Tailwind's layered utilities everywhere else. */}
      <style>{`
        .jb-plan, .jb-plan *{box-sizing:border-box}
        .jb-plan button{cursor:pointer;outline:none;border:none;margin:0}
        .jb-plan input,.jb-plan textarea{color-scheme:dark}
        .jb-plan h1,.jb-plan h2,.jb-plan h3,.jb-plan p{margin:0}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ padding:"14px 18px", borderBottom:`1px solid ${BORDER}`, background:"rgba(10,13,20,0.97)", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:20, letterSpacing:3, color:"#F0F4FF" }}>
              JB'S SUMMER TRAINING PLAN
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:3 }}>
              <span style={{ fontSize:10, color:"#4B5563", letterSpacing:1 }}>JUN 1 – AUG 23, 2026</span>
              <div style={{ height:2, flex:1, maxWidth:120, background:"rgba(255,255,255,0.06)", borderRadius:1 }}>
                <div style={{ height:"100%", background:ph.c, width:`${overallPct}%`, borderRadius:1, transition:"width 0.3s" }} />
              </div>
              <span style={{ fontSize:10, color:ph.c, letterSpacing:1 }}>{overallPct}%</span>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
            <div style={{ background:`rgba(${ph.r},0.13)`, border:`1px solid rgba(${ph.r},0.45)`, borderRadius:8, padding:"7px 14px", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:14, color:ph.c, letterSpacing:1.5 }}>
              WK {week.w} / {ph.icon} {ph.name}
            </div>
            <span style={{ fontSize:9, fontFamily:"'JetBrains Mono',monospace", letterSpacing:0.5, padding:"2px 4px", color:saveStatus==="saving"?"#F59E0B":saveStatus==="error"?"#EF4444":"#374151" }}>
              {saveStatus==="saving" ? "saving…" : lastSaved ? `saved ${fmtTimeAgo(lastSaved)}` : "not yet saved"}
            </span>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display:"flex", borderBottom:`1px solid ${BORDER}`, background:CARD, position:"sticky", top:57, zIndex:40 }}>
        {["TODAY","WEEK","PROGRAM","MAXES","PROGRESS"].map(t => (
          <button key={t} onClick={()=>setTab(t.toLowerCase())} style={{ flex:1, padding:"11px 2px", background:"transparent", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:12, letterSpacing:1.5, color:tab===t.toLowerCase()?ph.c:"#4B5563", borderBottom:tab===t.toLowerCase()?`2px solid ${ph.c}`:"2px solid transparent", transition:"all 0.2s" }}>
            {t}
          </button>
        ))}
      </div>

      {/* ══════════════════════ TODAY ══════════════════════ */}
      {tab==="today" && (
        <div>
          <div style={{ padding:"16px 18px 0", background:`linear-gradient(140deg,rgba(${ph.r},0.08) 0%,transparent 60%)` }}>
            <PhaseWeekBanner week={week} ph={ph} />
            <div style={{ fontSize:10, letterSpacing:3, color:"#4B5563", marginBottom:3 }}>
              {pos.active?"— TODAY —":"— CURRENT SELECTION —"}
            </div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:36, letterSpacing:1, lineHeight:1 }}>
              {day.dn.toUpperCase()}, {day.dt.toUpperCase()}
            </div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, fontSize:15, color:ph.c, letterSpacing:1, marginTop:6, marginBottom:16 }}>
              {day.title}
            </div>
          </div>
          <WorkoutView week={week} day={day} wIdx={wIdx} dIdx={dIdx} completedSets={completedSets} onToggle={handleToggle} weights={weights} onWeight={handleWeight} cardio={cardio} onCardio={handleCardio} activities={activities} onActivity={handleActivity} notes={notes} onNote={handleNote} setNotes={repNotes} onSetNote={handleSetNote} maxes={maxes} customExercises={customExercises} onCustomEx={handleCustomEx} />
          <div style={{ height:40 }} />
        </div>
      )}

      {/* ══════════════════════ WEEK ══════════════════════ */}
      {tab==="week" && (
        <div>
          {/* Week selector */}
          <div style={{ padding:"14px 18px", display:"flex", alignItems:"center", gap:10, borderBottom:`1px solid ${BORDER}` }}>
            <button onClick={()=>setWIdx(Math.max(0,wIdx-1))} disabled={wIdx===0} style={{ background:"transparent", border:`1px solid ${wIdx===0?"rgba(255,255,255,0.06)":"rgba(255,255,255,0.15)"}`, color:wIdx===0?"#374151":"#E2E8F0", borderRadius:6, padding:"6px 14px", fontFamily:"'JetBrains Mono',monospace", fontSize:14, opacity:wIdx===0?0.4:1 }}>←</button>
            <div style={{ flex:1, textAlign:"center" }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:18, letterSpacing:2 }}>WEEK {week.w} — {week.range}</div>
              {week.isReset && <div style={{ fontSize:10, color:"#F59E0B", letterSpacing:1, marginTop:2 }}>⚠ MID-BLOCK RESET WEEK</div>}
            </div>
            <button onClick={()=>setWIdx(Math.min(11,wIdx+1))} disabled={wIdx===11} style={{ background:"transparent", border:`1px solid ${wIdx===11?"rgba(255,255,255,0.06)":"rgba(255,255,255,0.15)"}`, color:wIdx===11?"#374151":"#E2E8F0", borderRadius:6, padding:"6px 14px", fontFamily:"'JetBrains Mono',monospace", fontSize:14, opacity:wIdx===11?0.4:1 }}>→</button>
          </div>

          <div style={{ padding:"14px 18px 0" }}>
            <PhaseWeekBanner week={week} ph={ph} />
          </div>

          {/* Day strip */}
          <div style={{ display:"flex", overflowX:"auto", gap:8, padding:"12px 18px 14px", scrollbarWidth:"none" }}>
            {week.days.map((d,i) => {
              const isToday = pos.active && wIdx===pos.wIdx && i===pos.dIdx;
              const isSel = i===dIdx;
              const typeIcon = {strength:"🏋️",power:"⚡",zone2:"🏃",rest:"✝️"}[d.type];
              const dk = WEEKS.indexOf(week);
              const sessionDone = cardio[`${dk}-${i}`] || false;
              return (
                <button key={i} onClick={()=>setDIdx(i)} style={{ minWidth:74, padding:"10px 6px 8px", borderRadius:10, background:isSel?`rgba(${ph.r},0.15)`:"rgba(255,255,255,0.03)", border:isSel?`1px solid ${ph.c}`:isToday?`1px solid rgba(${ph.r},0.45)`:`1px solid rgba(255,255,255,0.06)`, flexShrink:0, transition:"all 0.15s", textAlign:"center" }}>
                  <div style={{ fontSize:9, letterSpacing:1, color:"#6B7280", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, marginBottom:6 }}>
                    {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]} - {fmtDate(d.dt)}
                  </div>
                  <div style={{ fontSize:20, marginBottom:4 }}>{typeIcon}</div>
                  {isToday && <div style={{ fontSize:8, color:ph.c, letterSpacing:1, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700 }}>TODAY</div>}
                  {!isToday && sessionDone && d.type !== R && <div style={{ fontSize:8, color:"#22C55E", letterSpacing:0.5 }}>✓</div>}
                </button>
              );
            })}
          </div>

          <div style={{ borderTop:`1px solid ${BORDER}` }}>
            <div style={{ padding:"12px 18px 4px" }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:20, letterSpacing:1 }}>{day.dn} - {fmtDate(day.dt)}</div>
              <div style={{ color:ph.c, fontSize:12, marginTop:2 }}>{day.title}</div>
            </div>
            <WorkoutView week={week} day={day} wIdx={wIdx} dIdx={dIdx} completedSets={completedSets} onToggle={handleToggle} weights={weights} onWeight={handleWeight} cardio={cardio} onCardio={handleCardio} activities={activities} onActivity={handleActivity} notes={notes} onNote={handleNote} setNotes={repNotes} onSetNote={handleSetNote} maxes={maxes} customExercises={customExercises} onCustomEx={handleCustomEx} />
          </div>
          <div style={{ height:40 }} />
        </div>
      )}

      {/* ══════════════════════ PROGRAM ══════════════════════ */}
      {tab==="program" && (
        <div style={{ padding:"16px 18px" }}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:22, letterSpacing:2 }}>PROGRAM OVERVIEW</div>
            <div style={{ fontSize:11, color:"#6B7280", marginTop:4 }}>June 1 – August 23, 2026 · 12 weeks · 5 phases · Tap any week to view</div>
          </div>
          {pos.active && <PhaseWeekBanner week={week} ph={ph} />}
          {/* Phase legend */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:18 }}>
            {Object.entries(PH).map(([k,p])=>(
              <div key={k} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:20, background:`rgba(${p.r},0.08)`, border:`1px solid rgba(${p.r},0.2)` }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:p.c }} />
                <span style={{ fontSize:11, color:p.c, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:1 }}>{p.icon} PH{k} {p.name}</span>
              </div>
            ))}
          </div>
          {/* Week grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))", gap:10 }}>
            {WEEKS.map((wk,wi)=>{
              const p = PH[wk.ph];
              const isCurr = wi===pos.wIdx && pos.active;
              const wkTotalSets = wk.days.reduce((a,d)=>a+d.exs.reduce((b,e)=>b+e.s,0),0);
              const wkDone = wk.days.reduce((a,d,di)=>a+d.exs.reduce((b,e,ei)=>b+Math.min(completedSets[`${wi}-${di}-${ei}`]||0,e.s),0),0);
              const wkPct = wkTotalSets>0?Math.round((wkDone/wkTotalSets)*100):0;
              return (
                <div key={wi} onClick={()=>{setWIdx(wi);setDIdx(isCurr?pos.dIdx:0);setTab("week");}} style={{ borderRadius:10, padding:"13px 14px", cursor:"pointer", background:isCurr?`rgba(${p.r},0.1)`:CARD, border:isCurr?`1px solid ${p.c}`:`1px solid ${BORDER}`, transition:"all 0.2s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:17, letterSpacing:1 }}>
                      WEEK {wk.w}
                      {isCurr&&<span style={{ fontSize:10, color:p.c, marginLeft:8 }}>← NOW</span>}
                      {wk.isReset&&<span style={{ fontSize:9, color:"#F59E0B", marginLeft:6 }}>RESET</span>}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {wkPct>0&&<span style={{ fontSize:10, color:wkPct===100?"#22C55E":p.c, fontFamily:"'JetBrains Mono',monospace" }}>{wkPct===100?"✓":wkPct+"%"}</span>}
                      <span style={{ fontSize:10, color:p.c, background:`rgba(${p.r},0.12)`, padding:"2px 8px", borderRadius:10, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:1 }}>{p.icon} {p.name}</span>
                    </div>
                  </div>
                  <div style={{ fontSize:10, color:"#374151", marginBottom:8, letterSpacing:1 }}>{wk.range}</div>
                  {/* Progress bar */}
                  {wkPct>0&&<div style={{ height:2, background:"rgba(255,255,255,0.05)", borderRadius:1, marginBottom:8 }}><div style={{ height:"100%", background:wkPct===100?"#22C55E":p.c, width:`${wkPct}%`, borderRadius:1 }}/></div>}
                  {wk.days.filter(d=>d.type!==R).map((d,di)=>(
                    <div key={di} style={{ fontSize:11, color:"#6B7280", padding:"3px 0", borderBottom:"1px solid rgba(255,255,255,0.03)", display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ color:"#374151", minWidth:28, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:11 }}>{d.dn.substring(0,3).toUpperCase()}</span>
                      <span style={{ fontSize:10, flex:1 }}>{d.title}</span>
                      {d.type===Z && d.dur && <span style={{ fontSize:9, color:"#374151", fontFamily:"'JetBrains Mono',monospace" }}>{d.dur}</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {/* Reset button */}
          <div style={{ marginTop:24, borderTop:`1px solid ${BORDER}`, paddingTop:16 }}>
            {!showResetConfirm?(
              <button onClick={()=>setShowResetConfirm(true)} style={{ background:"transparent", border:`1px solid rgba(239,68,68,0.3)`, color:"rgba(239,68,68,0.6)", borderRadius:6, padding:"8px 16px", fontFamily:"'JetBrains Mono',monospace", fontSize:11, letterSpacing:1 }}>
                Reset all progress
              </button>
            ):(
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <span style={{ fontSize:12, color:"#9CA3AF" }}>Reset ALL set tracking?</span>
                <button onClick={handleReset} style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.4)", color:"#EF4444", borderRadius:6, padding:"6px 14px", fontFamily:"'JetBrains Mono',monospace", fontSize:11 }}>Yes, reset</button>
                <button onClick={()=>setShowResetConfirm(false)} style={{ background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"#6B7280", borderRadius:6, padding:"6px 14px", fontFamily:"'JetBrains Mono',monospace", fontSize:11 }}>Cancel</button>
              </div>
            )}
          </div>
          <div style={{ height:40 }} />
        </div>
      )}

      {/* ══════════════════════ MAXES ══════════════════════ */}
      {tab==="maxes" && (
        <MaxesTab weights={weights} completedSets={completedSets} notes={notes} onNote={handleNote} ph={ph} />
      )}

      {/* ══════════════════════ PROGRESS ══════════════════════ */}
      {tab==="progress" && (
        <div style={{ padding:"16px 18px" }}>
          <div style={{ marginBottom:18 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:22, letterSpacing:2 }}>LOAD PROGRESSION</div>
            <div style={{ fontSize:11, color:"#6B7280", marginTop:4 }}>% of 1RM (left axis) for primary lifts · actual logged lbs (right axis) for Row/Pull-Ups & RDL — week 6 & 12 are planned drops</div>
          </div>

          {/* Legend */}
          <div style={{ display:"flex", gap:14, marginBottom:12, flexWrap:"wrap" }}>
            {LIFT_CONFIG.map(l=>(
              <div key={l.key} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:16, height:3, background:l.color, borderRadius:2 }} />
                <span style={{ fontSize:11, color:"#9CA3AF" }}>{l.label}{l.noPercent?" (lbs)":""}</span>
              </div>
            ))}
          </div>

          {(() => {
            const rowHist = maxes["Row / Pull-Ups"]?.history || [];
            const rdlHist = maxes["Romanian DL"]?.history || [];
            const chartData = PROG.map((row,i) => {
              const wkNum = i+1;
              const rw = rowHist.find(h=>h.week===wkNum);
              const rd = rdlHist.find(h=>h.week===wkNum);
              return { ...row, row: rw ? rw.weight : null, rdl: rd ? rd.weight : null };
            });
            return (
              <div style={{ background:CARD, borderRadius:12, border:`1px solid ${BORDER}`, padding:"18px 8px 18px 0", marginBottom:20 }}>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData} margin={{left:8,right:12,top:4,bottom:4}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                    <XAxis dataKey="n" tick={{fill:"#4B5563",fontSize:9,fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false}/>
                    <YAxis yAxisId="left" domain={[50,105]} tick={{fill:"#4B5563",fontSize:9,fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                    <YAxis yAxisId="right" orientation="right" tick={{fill:"#4B5563",fontSize:9,fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}`}/>
                    <Tooltip contentStyle={{background:"#0F1320",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,fontFamily:"JetBrains Mono",fontSize:11}} labelStyle={{color:"#F0F4FF",fontWeight:600,marginBottom:4}} formatter={(v,name)=>{
                      if (v==null) return [null, null];
                      const cfg = LIFT_CONFIG.find(l=>l.key===name);
                      if (cfg.noPercent) return [`${v} lbs`, cfg.label];
                      const oneRM = maxes[cfg.name]?.max1RM;
                      const lbs = calcTargetWeight(v, oneRM);
                      return [lbs?`${v}% ≈ ${lbs} lbs`:`${v}%`, cfg.label];
                    }}/>
                    {pos.active&&<ReferenceLine yAxisId="left" x={PROG[pos.wIdx]?.n} stroke={ph.c} strokeDasharray="5 3" strokeWidth={1.5}/>}
                    {LIFT_CONFIG.map(l=>(
                      <Area key={l.key} yAxisId={l.noPercent?"right":"left"} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} fill="none" connectNulls dot={{fill:l.color,r:2.5,strokeWidth:0}} activeDot={{r:4}}/>
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {/* Per-week % + lbs breakdown — all lifts */}
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:16, letterSpacing:2, color:"#F0F4FF", marginBottom:4 }}>WEEKLY TARGET LOADS</div>
          <div style={{ fontSize:11, color:"#6B7280", marginBottom:10 }}>Color dot matches the chart legend · Row/Pull-Ups & RDL show actual logged lbs (no %1RM prescribed)</div>
          <div style={{ border:`1px solid ${BORDER}`, borderRadius:10, overflow:"hidden", marginBottom:20 }}>
            {PROG.map((row,i)=>{
              const isCurrentWk = pos.active && i===pos.wIdx;
              const wkNum = i+1;
              const rowHist = maxes["Row / Pull-Ups"]?.history || [];
              const rdlHist = maxes["Romanian DL"]?.history || [];
              const rowEntry = rowHist.find(h=>h.week===wkNum);
              const rdlEntry = rdlHist.find(h=>h.week===wkNum);
              return (
                <div key={row.n} style={{ padding:"10px 14px", borderTop:i===0?"none":"1px solid rgba(255,255,255,0.03)", background:isCurrentWk?`rgba(${ph.r},0.07)`:i%2===0?"transparent":"rgba(255,255,255,0.015)" }}>
                  <div style={{ fontSize:11, color:isCurrentWk?ph.c:"#6B7280", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:1, marginBottom:6 }}>
                    {row.n}{isCurrentWk?" — NOW":""}
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                    {LIFT_CONFIG.map(l=>{
                      if (l.noPercent) {
                        const entry = l.key==="row" ? rowEntry : rdlEntry;
                        if (!entry) return null;
                        return (
                          <div key={l.key} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:8, background:"rgba(255,255,255,0.03)", border:`1px solid ${l.color}40` }}>
                            <span style={{ width:8, height:8, borderRadius:"50%", background:l.color, flexShrink:0 }} />
                            <span style={{ fontSize:10, color:"#9CA3AF", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:0.5 }}>{l.shortLabel}</span>
                            <span style={{ fontSize:11, color:l.color, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{entry.weight} lbs</span>
                            <span style={{ fontSize:10, color:"#4B5563", fontFamily:"'JetBrains Mono',monospace" }}>· {entry.reps} rep{entry.reps!==1?"s":""}</span>
                          </div>
                        );
                      }
                      const pct = row[l.key];
                      if (pct==null) return null;
                      const lbs = calcTargetWeight(pct, maxes[l.name]?.max1RM);
                      return (
                        <div key={l.key} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:8, background:"rgba(255,255,255,0.03)", border:`1px solid ${lbs?`${l.color}40`:"rgba(255,255,255,0.06)"}` }}>
                          <span style={{ width:8, height:8, borderRadius:"50%", background:l.color, flexShrink:0 }} />
                          <span style={{ fontSize:10, color:"#9CA3AF", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:0.5 }}>{l.shortLabel}</span>
                          <span style={{ fontSize:11, color:"#F0F4FF", fontFamily:"'JetBrains Mono',monospace" }}>{pct}%</span>
                          {lbs
                            ? <span style={{ fontSize:11, color:l.color, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>≈ {lbs} lbs</span>
                            : <span style={{ fontSize:10, color:"#374151", fontStyle:"italic" }}>log max</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progression Rules */}
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:16, letterSpacing:2, color:"#F0F4FF", marginBottom:10 }}>MASTER RULES</div>
          {[
            [ph.c,"Main lifts","Add 2.5–5 lb when all reps completed cleanly"],
            [ph.c,"Speed lifts","Increase sets before load — bar speed stays explosive"],
            [ph.c,"Zone 2","Add duration only, never intensity"],
            ["#F59E0B","Week 6 Reset","Drop ~10% all loads, reduce volume — do not skip"],
            ["#22C55E","Week 12 Deload","Reduce volume ~35–40%, keep load at ~65%"],
          ].map(([c,rule,desc])=>(
            <div key={rule} style={{ display:"flex", gap:12, padding:"11px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ minWidth:108, fontSize:11, color:c, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:1 }}>{rule}</div>
              <div style={{ fontSize:12, color:"#9CA3AF", lineHeight:1.4 }}>{desc}</div>
            </div>
          ))}

          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:16, letterSpacing:2, color:"#F0F4FF", margin:"20px 0 10px" }}>AUTO-REGULATION</div>
          {[
            ["#EF4444","High fatigue","Hold load, drop 1 set, keep the reps"],
            ["#EF4444","Lift feels off","Drop to 70% and fix form — skip the heavy top set"],
            ["#F59E0B","Bad sleep/nutrition","Lower intensity for session, but do not skip"],
            ["#F59E0B","Pain (not soreness)","Skip the exercise, not the session. Sub a pain-free variation."],
            ["#22C55E","Life happens","One missed session will not derail 12 weeks."],
          ].map(([c,rule,desc])=>(
            <div key={rule} style={{ display:"flex", gap:12, padding:"11px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ minWidth:108, fontSize:11, color:c, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:1 }}>{rule}</div>
              <div style={{ fontSize:12, color:"#9CA3AF", lineHeight:1.4 }}>{desc}</div>
            </div>
          ))}
          <div style={{ height:40 }} />
        </div>
      )}
    </div>
  );
}
