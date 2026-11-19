import { defineStore } from "pinia";
import axios from "axios";
import { useBaseURL } from "./dockStore";

// The server's fleet coordinator (FLEET_MODE=bus). It starts in manual: it gives robots
// no tasks, and operators move them by hand. Auto hands control to the coordinator;
// switching back to manual lets running tasks finish and gives no new ones.
export type FleetMode = "legacy" | "bus";
export type FleetControl = "manual" | "auto";

export interface FleetPose { x: number; y: number; yaw: number; loc_ok: boolean }
export interface FleetRobot {
  role: string;
  robot_type: string;
  status: string;            // ONLINE | STALE | OFFLINE | REFUSED
  exec_state: string;        // IDLE | EXECUTING | HOLD | SAFE_STOP | ESTOP ...
  task: string | null;
  zone: string | null;
  parked: boolean;
  carried: string[];
  held_item: string | null;
  pose: FleetPose | null;
}
export interface FleetItem {
  status: string;            // AVAILABLE | CLAIMED | HELD | HANDING | ON_TRANSPORTER | DELIVERING | DELIVERED
  pickup_dock: string;
  receiver_dock: string;
  weight: number;
  holder: string | null;
  transporter: string | null;
}
export interface FleetTask { robot: string; kind: string; status: string; target: string }
export interface FleetPolicy {
  name: string;              // stay | greedy | marl_onnx
  label: string;
  kind: "heuristic" | "rl" | string;
  available: boolean;
  reason: string | null;     // why it is not available (e.g. the RL model failed to load)
}
export interface FleetSnapshot {
  epoch: number;
  paused: boolean;
  control: FleetControl;
  policy: string;              // who decides in auto: stay | greedy | marl_onnx
  policies: FleetPolicy[];
  robots: Record<string, FleetRobot>;
  items: Record<string, FleetItem>;
  tasks: Record<string, FleetTask>;
  docks: Record<string, { type: string; x: number; y: number; yaw: number }>;
}

function detail(error: any, fallback: string): string {
  return error?.response?.data?.detail || error?.message || fallback;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollUsers = 0;

export const useFleetStore = defineStore("fleet", {
  state: () => ({
    mode: null as FleetMode | null,
    snapshot: null as FleetSnapshot | null,
    error: "" as string,     // the coordinator could not be reached
    busy: false,
  }),
  getters: {
    isBus: (s) => s.mode === "bus",
    control: (s): FleetControl | null => s.snapshot?.control ?? null,
    // Hand controls (dock, go to initial pose) are refused only while the coordinator is
    // known to be in auto; Stop is always allowed.
    handControlLocked(): boolean {
      return this.isBus && this.control === "auto";
    },
  },
  actions: {
    async fetchMode() {
      try {
        const res = await axios.get(`${useBaseURL()}fleet/mode`);
        this.mode = res.data.fleet_mode;
      } catch (error) {
        this.mode = null;
        this.error = detail(error, "cannot reach the server");
      }
    },
    async fetchSnapshot() {
      if (!this.isBus) return;
      try {
        const res = await axios.get(`${useBaseURL()}fleet/snapshot`);
        this.snapshot = res.data;
        this.error = "";
      } catch (error) {
        this.snapshot = null;
        this.error = detail(error, "the fleet coordinator did not answer");
      }
    },
    async setControl(control: FleetControl) {
      this.busy = true;
      try {
        await axios.post(`${useBaseURL()}fleet/${control === "auto" ? "resume" : "pause"}`);
        await this.fetchSnapshot();
      } catch (error) {
        throw new Error(detail(error, `could not switch to ${control}`));
      } finally {
        this.busy = false;
      }
    },
    // Who decides in auto: a heuristic or the RL model. Running tasks finish as planned.
    async setPolicy(policy: string) {
      this.busy = true;
      try {
        await axios.post(`${useBaseURL()}fleet/policy`, { policy });
        await this.fetchSnapshot();
      } catch (error) {
        throw new Error(detail(error, `could not switch to ${policy}`));
      } finally {
        this.busy = false;
      }
    },
    // Stops every robot and leaves the fleet in manual; switching to auto releases it.
    async estop(reason = "operator e-stop (web)") {
      this.busy = true;
      try {
        await axios.post(`${useBaseURL()}fleet/estop`, { reason });
        await this.fetchSnapshot();
      } catch (error) {
        throw new Error(detail(error, "e-stop failed"));
      } finally {
        this.busy = false;
      }
    },
    // Shared polling: every caller of startPolling must call stopPolling once.
    async startPolling(periodMs = 2000) {
      pollUsers += 1;
      if (pollTimer) return;
      await this.fetchMode();
      await this.fetchSnapshot();
      pollTimer = setInterval(async () => {
        if (this.mode === null) await this.fetchMode();
        await this.fetchSnapshot();
      }, periodMs);
    },
    stopPolling() {
      pollUsers = Math.max(0, pollUsers - 1);
      if (pollUsers === 0 && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    },
  },
});
