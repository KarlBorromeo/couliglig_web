import { SIM_SOURCE, useSimStore } from "~/stores/simStore";

// Receives the warehouse simulator's messages (live metrics, finished
// episodes) from its iframe. Only messages from this site's own origin are
// accepted: the simulator is served from public/simulator-app/.
export default defineNuxtPlugin(() => {
  const sim = useSimStore();
  sim.load();

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const msg = event.data;
    if (!msg || typeof msg !== "object" || msg.source !== SIM_SOURCE) return;
    if (msg.type === "live" && msg.data) sim.setLive(msg.data);
    else if (msg.type === "episode" && msg.data) sim.addEpisode(msg.data);
  });
});
