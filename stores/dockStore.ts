import { defineStore } from "pinia";
import axios from "axios";

export const useDockStore = defineStore("dock", {
  state: () => ({

  }),
  actions: {
    async createConfig(configPayload: dockConfig, docksPayload: createDock[]| []) {
        try {
            const baseurl = useRuntimeConfig().public.baseURL;
            const createConfigRes = await axios.post(`${baseurl}dock`, configPayload);
            const config = createConfigRes.data
            const updatedDocksPayload = docksPayload.map(dock => ({
                ...dock,
                config_id: config.id
            }))
            await axios.post(`${baseurl}dock/create_dock`, updatedDocksPayload);

            // TODO: add here request to create the mapping between the config and the docks
        } catch (error) {
            console.error("Error creating config:", error);
        }
    }
  },
});

interface dockConfig {
  name: string;
  description: string;
}
interface createDock {
    config_id: number | undefined;
    dock_id: string;
    dock_type: string;
    x: number;
    y: number;
    theta: number;
    aruco_id: number;
}