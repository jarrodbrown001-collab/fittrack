// @ts-nocheck
// The training plan tracker, spanning every block Jarrod runs. Deliberately
// untyped: this is a large, battle-tested JS component with its own
// self-contained styling (dark military aesthetic), kept as close to the
// original as possible. Persistence goes through FitTrack's storage layer
// ('training_plan' doc, namespaced per block — see lib/api.ts) so the data
// is included in Settings → Export/Import backups.
//
// Block content (phases, weekly programs, calendar windows) lives in
// lib/trainingBlocks.ts — this file only renders whichever block
// selectBlockAt() says is active right now. Adding a new block after this
// one means adding an entry there, not editing this file.
import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { getTrainingPlanData, saveTrainingPlanData } from "../lib/api";
import {
  BLOCKS, LIFT_CONFIG, S, PW, Z, R,
  canonical, parseReps, parsePct, getPctLiftName, calcTargetWeight, fmtDate,
  computeMaxes, selectBlockAt, migrateDoc,
} from "../lib/trainingBlocks";

export { S, PW, Z, R, selectBlockAt, BLOCKS };

// The block active right now (by real calendar date).
const ACTIVE_BLOCK = selectBlockAt(new Date()).block;

// These four are reassigned (not just read) when the "Preview" switcher
// jumps to a different block — see switchBlock() in the App component.
// Every renderer in this file (WorkoutView, MaxesTab, PhaseWeekBanner, App
// itself) reads them as free module variables, re-evaluated fresh on every
// render, so a reassignment right before a state-driven re-render is picked
// up correctly everywhere in the same pass.
export let PH = ACTIVE_BLOCK.PH;
let WEEK_FOCUS = ACTIVE_BLOCK.WEEK_FOCUS;
export let WEEKS = ACTIVE_BLOCK.WEEKS;
let PROG = ACTIVE_BLOCK.PROG;

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
function MaxesTab({ weights, completedSets, notes, onNote, ph, otherBlocksData }) {
  const maxes = useMemo(
    () => computeMaxes(WEEKS, weights, completedSets, otherBlocksData),
    [weights, completedSets, otherBlocksData]
  );
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
  const pos = selectBlockAt(new Date());
  const [tab, setTab] = useState("today");
  const [wIdx, setWIdx] = useState(pos.wIdx);
  const [dIdx, setDIdx] = useState(pos.dIdx);
  const [viewedBlockId, setViewedBlockId] = useState(pos.block.id);
  const viewedBlock = BLOCKS.find((b) => b.id === viewedBlockId) || pos.block;
  // True only when the block on screen is the one the real calendar says is
  // active right now — drives every "— TODAY —" / highlighted-day treatment
  // below. Previewing a future or past block should never look like "today".
  const isRealActive = pos.active && viewedBlockId === pos.block.id;

  const switchBlock = (blockId) => {
    if (blockId === viewedBlockId) return;
    const block = BLOCKS.find((b) => b.id === blockId);
    WEEKS = block.WEEKS;
    PH = block.PH;
    WEEK_FOCUS = block.WEEK_FOCUS;
    PROG = block.PROG;
    setViewedBlockId(blockId);
    setTab("today");
    const jumpToRealPosition = pos.active && blockId === pos.block.id;
    setWIdx(jumpToRealPosition ? pos.wIdx : 0);
    setDIdx(jumpToRealPosition ? pos.dIdx : 0);
    // Reload the editable state (sets/weights/cardio/...) from this block's
    // own storage slice — otherwise the previously-viewed block's logged
    // checkmarks would show up against this block's exercise list.
    applyData(fullDoc.blocks[blockId] || {});
  };
  const [completedSets, setCompletedSets] = useState({});
  const [weights, setWeights] = useState({});
  const [cardio, setCardio] = useState({});
  const [activities, setActivities] = useState({});
  const [notes, setNotes] = useState({});
  const [repNotes, setRepNotes] = useState({});
  const [customExercises, setCustomExercises] = useState({});
  const [fullDoc, setFullDoc] = useState({ blocks: {} });
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
        const raw = await getTrainingPlanData();
        const migrated = migrateDoc(raw);
        setFullDoc(migrated);
        applyData(migrated.blocks[viewedBlockId] || {});
      } catch {}
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Frozen historical data from every block OTHER than the one currently
  // being viewed/edited, for merging lift maxes across the whole training
  // history (see computeMaxes in trainingBlocks.ts). Keyed off viewedBlockId
  // (not the real-calendar-active block) so previewing a future block still
  // pulls in every other block's maxes, itself included once it has its own
  // logged sets.
  const otherBlocksData = useMemo(() => {
    return BLOCKS.filter(b => b.id !== viewedBlockId).map(b => ({
      weeks: b.WEEKS,
      weights: fullDoc.blocks[b.id]?.weights || {},
      completedSets: fullDoc.blocks[b.id]?.sets || {},
    }));
  }, [fullDoc, viewedBlockId])

  const save = async (sets, wts, crd, acts, nts, rns, cex) => {
    const ts = new Date().toISOString();
    const activeData = {sets, weights:wts, cardio:crd, activities:acts, notes:nts, setNotes:rns, customExercises:cex, lastSaved:ts};
    const newDoc = { ...fullDoc, blocks: { ...fullDoc.blocks, [viewedBlockId]: activeData }, lastSaved: ts };
    setSaveStatus("saving");
    try {
      await saveTrainingPlanData(newDoc);
      setFullDoc(newDoc);
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

  // Live 1RM estimates — drives target weight calculations across all workouts.
  // Merges in frozen history from every other block so a new block's targets
  // are informed by maxes set previously, not blind on day one.
  const maxes = useMemo(
    () => computeMaxes(WEEKS, weights, completedSets, otherBlocksData),
    [weights, completedSets, otherBlocksData]
  );

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
              {viewedBlock.label}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:3 }}>
              <span style={{ fontSize:10, color:"#4B5563", letterSpacing:1 }}>{viewedBlock.dateRangeLabel}</span>
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
        {BLOCKS.length > 1 && (
          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:9, color:"#4B5563", letterSpacing:1, fontFamily:"'JetBrains Mono',monospace" }}>VIEWING:</span>
            {BLOCKS.map(b => {
              const isSelected = b.id === viewedBlockId;
              const isTrueActive = b.id === pos.block.id && pos.active;
              return (
                <button key={b.id} onClick={()=>switchBlock(b.id)} style={{
                  padding:"4px 10px", borderRadius:20, fontSize:10, letterSpacing:0.5,
                  fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700,
                  background:isSelected?`rgba(${ph.r},0.15)`:"rgba(255,255,255,0.04)",
                  border:isSelected?`1px solid ${ph.c}`:"1px solid rgba(255,255,255,0.1)",
                  color:isSelected?ph.c:"#9CA3AF",
                }}>
                  {b.label}{isTrueActive?" ● NOW":""}
                </button>
              );
            })}
          </div>
        )}
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
              {isRealActive?"— TODAY —":"— CURRENT SELECTION —"}
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
            <button onClick={()=>setWIdx(Math.min(WEEKS.length-1,wIdx+1))} disabled={wIdx===WEEKS.length-1} style={{ background:"transparent", border:`1px solid ${wIdx===WEEKS.length-1?"rgba(255,255,255,0.06)":"rgba(255,255,255,0.15)"}`, color:wIdx===WEEKS.length-1?"#374151":"#E2E8F0", borderRadius:6, padding:"6px 14px", fontFamily:"'JetBrains Mono',monospace", fontSize:14, opacity:wIdx===WEEKS.length-1?0.4:1 }}>→</button>
          </div>

          <div style={{ padding:"14px 18px 0" }}>
            <PhaseWeekBanner week={week} ph={ph} />
          </div>

          {/* Day strip */}
          <div style={{ display:"flex", overflowX:"auto", gap:8, padding:"12px 18px 14px", scrollbarWidth:"none" }}>
            {week.days.map((d,i) => {
              const isToday = isRealActive && wIdx===pos.wIdx && i===pos.dIdx;
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
            <div style={{ fontSize:11, color:"#6B7280", marginTop:4 }}>{viewedBlock.dateRangeLabel} · {WEEKS.length} weeks · {Object.keys(PH).length} phases · Tap any week to view</div>
          </div>
          {isRealActive && <PhaseWeekBanner week={week} ph={ph} />}
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
              const isCurr = wi===pos.wIdx && isRealActive;
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
        <MaxesTab weights={weights} completedSets={completedSets} notes={notes} onNote={handleNote} ph={ph} otherBlocksData={otherBlocksData} />
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
                    {isRealActive&&<ReferenceLine yAxisId="left" x={PROG[pos.wIdx]?.n} stroke={ph.c} strokeDasharray="5 3" strokeWidth={1.5}/>}
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
              const isCurrentWk = isRealActive && i===pos.wIdx;
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
