import { defineStore } from "pinia";

// Results from the warehouse simulator (the Godot web export in
// public/simulator-app/, shown by components/SimulatorFrame.vue). The sim posts
// {source: "couliglig-sim", type, data} messages to this page (see
// plugins/simBridge.client.ts):
//   live     its metrics panel's numbers, about once a second while it runs
//   episode  one finished episode, the same row it appends to episodes.csv
// Episodes are kept in this browser's localStorage so they survive reloads.

export const SIM_SOURCE = "couliglig-sim";
const STORAGE_KEY = "couliglig.sim.episodes";
/** Live numbers older than this mean the sim is closed or in its menus. The sim
 *  posts every second, but a hidden iframe (another page open) gets fewer
 *  frames, so this allows for gaps. */
export const LIVE_STALE_MS = 10000;

// Column order of the simulator's episodes.csv (FleetMetrics.CSV_COLUMNS).
export const EPISODE_COLUMNS = [
  "timestamp", "layout", "episode", "policy", "seed", "pickers", "transporters",
  "total_items", "delivered_items", "completion_rate", "all_delivered",
  "time_s", "time_limit_s", "steps", "mean_reward", "idle_ratio",
  "picker_idle_time", "transporter_idle_time", "transporter_parked_time",
  "picks", "handoffs", "delivery_dockings", "failed_dockings", "stale_actions",
  "manual_orders", "mean_box_time_s", "mean_load_at_delivery", "policy_ms",
] as const;

export interface SimEpisode {
  timestamp: string;
  layout: string;
  episode: number;
  policy: string;              // rl_stochastic | rl_deterministic | assign | stay | greedy | random | manual
  seed: number;
  pickers: number;
  transporters: number;
  total_items: number;
  delivered_items: number;
  completion_rate: number;     // 0..1
  all_delivered: boolean;
  time_s: number;
  time_limit_s: number;
  steps: number;
  mean_reward: number;
  idle_ratio: number;
  picker_idle_time: number;    // 0..1 share of picker time
  transporter_idle_time: number;
  transporter_parked_time: number;
  picks: number;
  handoffs: number;
  delivery_dockings: number;
  failed_dockings: number;
  stale_actions: number;
  manual_orders: number;
  mean_box_time_s: number;
  mean_load_at_delivery: number;
  policy_ms: number;
}

export interface SimLive {
  layout: string;
  mode: string;                // "RL policy", "Assign heuristic", ...
  policy: string;
  episode: number;             // -1 when running continuously
  episode_mode: boolean;
  boxes: number;               // batch size, 0 when continuous
  limit: number;
  elapsed: number;
  delivered: number;
  rate: number;                // boxes per minute, recent
  idle_ratio: number;
  picker_idle_time: number;
  transporter_idle_time: number;
  transporter_parked_time: number;
  picks: number;
  handoffs: number;
  delivery_dockings: number;
  failed_dockings: number;
  stale: number;
  manual_orders: number;
  mean_box_time: number;
  mean_load: number;
  policy_ms: number;
  steps: number;
  mean_reward: number;
  pickers: number;
  transporters: number;
  speed: number;
}

export interface PolicySummary {
  layout: string;
  policy: string;
  n: number;
  completion: number;
  allDelivered: number;
  timeMean: number;
  timeSd: number;
  reward: number;
  failedDockings: number;
  pickerIdle: number;
  transporterIdle: number;
  boxTime: number;
  policyMs: number;
}

function episodeKey(e: SimEpisode) {
  return `${e.timestamp}|${e.layout}|${e.policy}|${e.episode}`;
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export const useSimStore = defineStore("sim", {
  state: () => ({
    episodes: [] as SimEpisode[],
    live: null as SimLive | null,
    liveAt: 0,
    loaded: false,
  }),

  getters: {
    layouts(state): string[] {
      return [...new Set(state.episodes.map((e) => e.layout))];
    },
  },

  actions: {
    load() {
      if (this.loaded) return;
      this.loaded = true;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const rows = raw ? JSON.parse(raw) : [];
        if (Array.isArray(rows)) this.episodes = rows;
      } catch {
        this.episodes = [];
      }
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.episodes));
      } catch {
        // Storage full or blocked: the rows stay for this session only.
      }
    },

    addEpisode(row: SimEpisode) {
      this.load();
      const key = episodeKey(row);
      if (this.episodes.some((e) => episodeKey(e) === key)) return;
      this.episodes.push(row);
      this.save();
    },

    setLive(data: SimLive) {
      this.live = data;
      this.liveAt = Date.now();
    },

    clearEpisodes() {
      this.episodes = [];
      this.save();
    },

    /** Per layout and policy, in first-seen order. */
    summary(layout?: string): PolicySummary[] {
      const groups = new Map<string, SimEpisode[]>();
      for (const e of this.episodes) {
        if (layout && e.layout !== layout) continue;
        const key = `${e.layout}|${e.policy}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(e);
      }
      return [...groups.values()].map((rows) => {
        const times = rows.map((r) => r.time_s);
        const m = mean(times);
        const sd = rows.length > 1
          ? Math.sqrt(times.reduce((a, t) => a + (t - m) ** 2, 0) / (rows.length - 1))
          : 0;
        return {
          layout: rows[0].layout,
          policy: rows[0].policy,
          n: rows.length,
          completion: mean(rows.map((r) => r.completion_rate)),
          allDelivered: mean(rows.map((r) => (r.all_delivered ? 1 : 0))),
          timeMean: m,
          timeSd: sd,
          reward: mean(rows.map((r) => r.mean_reward)),
          failedDockings: mean(rows.map((r) => r.failed_dockings)),
          pickerIdle: mean(rows.map((r) => r.picker_idle_time)),
          transporterIdle: mean(rows.map((r) => r.transporter_idle_time)),
          boxTime: mean(rows.map((r) => r.mean_box_time_s)),
          policyMs: mean(rows.map((r) => r.policy_ms)),
        };
      });
    },

    /** The stored episodes as episodes.csv (same columns as the sim writes). */
    csv(): string {
      const cell = (v: unknown) => {
        const s = typeof v === "boolean" ? (v ? "true" : "false") : String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [EPISODE_COLUMNS.join(",")];
      for (const e of this.episodes) {
        lines.push(EPISODE_COLUMNS.map((c) => cell((e as any)[c])).join(","));
      }
      return lines.join("\n") + "\n";
    },
  },
});
