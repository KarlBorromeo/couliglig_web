import { defineStore } from "pinia";
const config = useRuntimeConfig()
const baseurl = config.public.baseURL


export const useDockStore = defineStore("dock", {
  state: () => ({
    docks: [] as Dock[],
  }),
  actions: {
    sample(){
        return `hahaha${baseurl}`
    }
  },
});

interface Dock {
  pose_x: string;
  pose_y: string;
}