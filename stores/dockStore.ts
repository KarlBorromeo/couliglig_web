import { defineStore } from "pinia";
import axios from "axios";

export const useBaseURL = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000/'
  }
//   return 'http://192.168.20.128:8000/'
  return `${window.location.protocol}//${window.location.hostname}:8000/`
}

export const useDockStore = defineStore("dock", {
  state: () => ({
    dockConfigs: [] as dockConfigs[],
    onlineRobots: [] as onlineRobot[],
    toMappingRobots : [] as onlineRobot[],
    toLaunchRobots : [] as onlineRobot[],
    toDockRobots : [] as onlineRobot[],
    docks: [] as Docks[],
    docks_pickups: [] as DockStates[],
    docks_receivers: [] as DockStates[],
  }),
  actions: {
    async test() {
        console.log("This is a test function in the dock store.");
        const baseurl = useBaseURL();
        console.log("Base URL for API calls:", baseurl);
    },
    async createConfig(configPayload: createDockConfig, docksPayload: createDock[]| [], formDataMap: FormData, robotPoses: robotPose[] | []) {
        let configId: number | undefined = undefined;
        let mapId: number | undefined = undefined;
        const baseurl = useBaseURL();
        try {
            const createConfigRes = await axios.post(`${baseurl}dock`, configPayload);
            const config = createConfigRes.data
            configId = config.id;
            const updatedDocksPayload = docksPayload.map(dock => ({
                ...dock,
                config_id: configId
            }))
            await axios.post(`${baseurl}dock/create_dock`, updatedDocksPayload);

            if (configId === undefined) {
                throw new Error("Config ID is undefined after creation");
            }
            formDataMap.append("dock_config_id", configId.toString());
            const uploadMapRes = await axios.post(`${baseurl}map/upload`, formDataMap, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });
            const map = uploadMapRes.data;
            mapId = map.id;

            if (mapId === undefined) {
                throw new Error("Map ID is undefined after upload");
            }
            const updatedRobotPoses = robotPoses.map(pose => ({
                ...pose,
                map_id: mapId
            }))
            await axios.post(`${baseurl}robots/infos`, updatedRobotPoses);

            console.log("Config created successfully:", config);
            console.log("Docks updated with config_id:", updatedDocksPayload);  
            console.log("Map files uploaded successfully");
   
        } catch (error:any) {
            if (configId !== undefined) {
                try {
                    await axios.delete(`${baseurl}dock/delete_config`, { params: { config_id: configId } });
                    console.log(`Dock configuration with ID ${configId} deleted successfully after error.`);
                } catch (deleteError) {
                    console.error(`Error deleting dock configuration with ID ${configId} after failure:`, deleteError);
                }
            }
            // const errorDetail = error.response.data.detail;
            // if (errorDetail == 'YAML filename already exists') {
            //     // delete the created config to prevent orphaned configs without maps
            //     await axios.delete(`${baseurl}dock/delete_config`, { params: { config_id: configId } });
            // }
            throw new Error(error.response.data.detail || "Error creating dock configuration");  
        }
    },
    async fetchDockConfigs() {
        try {
            const baseurl = useBaseURL();
            const response = await axios.get(`${baseurl}dock/configs`);
            this.dockConfigs = response.data;
            console.log("Fetched dock configurations:", this.dockConfigs);
        } catch (error) {
            console.error("Error fetching dock configurations:", error);
        }
    },
    // async fetchOnlineRobots() {
    //     try {
    //         const baseurl = useBaseURL();
    //         const response = await axios.get(`${baseurl}robots/online`);
    //         const robots = response.data.data;
    //         console.log("Fetched online robots:", robots);
    //         this.onlineRobots = robots.map((robot: onlineRobot) => ({
    //             ...robot,
    //             battery: Math.floor(Math.random() * 100) + 1, // Simulate battery level
    //             status: "" // Default status, can be updated based on real data
    //         }));
    //     } catch (error) {
    //         console.error("Error fetching online robots:", error);
    //         return [];
    //     }
    // },
    async fetchOnlineRobotsWS() {
        const store = this;
        const robots = ref<onlineRobot[]>([]);
        const connected = ref(false);
        const baseurl = useBaseURL();
        let ws: WebSocket | null = null;
        let reconnectDelay = 1000;
        const maxDelay = 30_000;
        let closedByUser = false;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

        function connect() {
            closedByUser = false;

            ws = new WebSocket(`${baseurl}robots/online/ws`);

            ws.onopen = () => {
            connected.value = true;
            reconnectDelay = 1000; // reset backoff
            };

            ws.onmessage = (event) => {
            try {
                robots.value = JSON.parse(event.data) as onlineRobot[];
                store.onlineRobots = robots.value.map((robot: onlineRobot) => ({
                    ...robot,
                    status: ""
                }));
                // console.log("Received online robots update via WebSocket:", robots.value);
            } catch (err) {
                console.error("[robots-ws] bad payload", err);
            }
            };

            ws.onclose = () => {
            connected.value = false;
            if (!closedByUser) scheduleReconnect();
            };

            ws.onerror = () => ws?.close(); // triggers onclose -> reconnect
        }

        function scheduleReconnect() {
            reconnectTimer = setTimeout(connect, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
        }

        function close() {
            closedByUser = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            ws?.close();
            ws = null;
        }

        connect();
        onUnmounted(close); // auto-cleanup when the component unmounts

        return { robots, connected, close };
    },
    async getMap(config_id: number | null) {
        try{
            if (config_id === null) {
                console.warn("No dock configuration selected, skipping getMap");
                return null;
            }
            const baseurl = useBaseURL();
            const response = await axios.get(`${baseurl}map`, { params: { config_id } });
            const index = response.data.findIndex((map: { dock_config_id: number }) => map.dock_config_id === config_id);
            if (index !== -1) {
                return response.data[index];
            } else {
                console.warn("No map found for config_id:", config_id);
                return null;
            }
        }catch(error){
            console.error("Error fetching map:", error);
            return null;
        }
    },
    async getRobotInitialPoses(map_id: number | null) {
        try {
            if (map_id === null) {
                console.warn("No map selected, skipping getRobotInitialPoses");
                return [];
            }
            const baseurl = useBaseURL();
            const response = await axios.get(`${baseurl}robots/infos`, { params: { map_id } });
            return response.data
        }catch (error) {
            console.error("Error fetching robot initial poses:", error);
            return [];
        }
    },
    async deleteConfig(configId: number) {
        try{
            if (!configId) {
                console.warn("No dock configuration selected, skipping deleteConfig");
                return;
            }
            const baseurl = useBaseURL();
            await axios.delete(`${baseurl}dock/delete_config`, { params: { config_id: configId } });
            this.dockConfigs = this.dockConfigs.filter(config => config.id !== configId);
            console.log(`Dock configuration with ID ${configId} deleted successfully.`);
        }catch(error){
            console.error("Error deleting dock configuration:", error);
            throw new Error(`Error deleting dock configuration`);
        }
    },
    fetchToMappingRobots() {
        //console.log("Filtering to mapping robots from online robots:", this.onlineRobots);
        this.toMappingRobots = this.onlineRobots.filter(robot => robot.status.toUpperCase() === 'MAPPING' || robot.status.toUpperCase() === 'IDLE');
    },
    fetchToLaunchRobots() {
        //console.log("Filtering to launch robots from online robots:", this.onlineRobots);
        this.toLaunchRobots = this.onlineRobots.filter(robot => robot.status.toUpperCase() === 'IDLE' || robot.status.toUpperCase() === 'PROCESSING');
    },
    fetchToDockRobots() {
        //console.log("Filtering to dock robots from online robots:", this.onlineRobots);
        this.toDockRobots = this.onlineRobots.filter(robot => robot.status.toUpperCase() === 'NAVIGATING' || robot.status.toUpperCase() === 'READY');
    },
    updateRobotStatus(ip: string, status: string) {
        const robotIndex = this.onlineRobots.findIndex(robot => robot.ip === ip);
        if (robotIndex !== -1) {
            this.onlineRobots[robotIndex].status = status;
        }
        this.fetchToLaunchRobots();
        this.fetchToDockRobots();
        this.fetchToMappingRobots();
    },
    async deleteDockConfig(configId: number) {
        try {
            const baseurl = useBaseURL();
            await axios.delete(`${baseurl}dock/delete_config`, { params: { config_id: configId } });
            this.dockConfigs = this.dockConfigs.filter(config => config.id !== configId);
            console.log(`Dock configuration with ID ${configId} deleted successfully.`);
        } catch (error) {
            console.error("Error deleting dock configuration:", error);
        }
    },
    async fetchDocksAll(configId: number | null) {
        if (configId === null) {
            console.warn("No dock configuration selected, skipping fetchDocksAll");
            this.docks = [];
            return [];
        }
        try {
            const baseurl = useBaseURL();
            const response = await axios.get(`${baseurl}dock`, { params: { config_id: configId } });
            const data = [...response.data].sort((a, b) =>
                a.dock_id.localeCompare(b.dock_id, undefined, { numeric: true })
            )
            this.docks = data;
            console.log("Fetched all docks:", this.docks);
            return data;
        } catch (error) {
            console.error("Error fetching all docks:", error);
            return [];
        }
    },
    async fetchDocks() {
        try {
            const baseurl = useBaseURL();
            const response = await axios.get(`${baseurl}dock/all_dock_states`);
            let docks = response.data;
            this.docks_pickups = docks.filter((dock: Docks) => dock.dock_type === 'pickup');
            this.docks_receivers = docks.filter((dock: Docks) => dock.dock_type === 'receiver');
            this.docks_pickups.sort((a, b) => a.dock_id.localeCompare(b.dock_id));
            this.docks_receivers.sort((a, b) => a.dock_id.localeCompare(b.dock_id));
        } catch (error) {
            console.error("Error fetching docks:", error);
        }
    },
    async actionRunNavigation(config_id: number | null, robot_data : robotData[]) {
        try {
            // await Promise.reject(new Error("Simulated navigation launch error"))
            console.log("Launching navigation with config_id:", config_id, "and robot_data:", robot_data);
            const baseurl = useBaseURL();
            await axios.post(`${baseurl}actions/run_nav`, 
                { 
                    config_id, 
                    robot_data
                });
            console.log("Navigation launched successfully");
        } catch (error) {
            console.error("Error launching navigation:", error);
             throw new Error(`Error launching navigation`);
        }
    },
    async actionStopNavigation(config_id: number | null, robot_data : robotData[]) {
        try {
            console.log("Stopping navigation with config_id:", config_id, "and robot_data:", robot_data);
            const baseurl = useBaseURL();
            const res = await axios.post(`${baseurl}actions/stop_nav`, { config_id, robot_data });
            return {
                successful: res.data.successful,
                message: res.data.failed
            }
        } catch (error) {
            console.error("Error stopping navigation:", error);
            throw new Error(`Error stopping navigation`);
        }
    },
    async activateDockConfig(configId: number) {
        try {
            const baseurl = useBaseURL();
            await axios.post(`${baseurl}dock/activate`, null, { params: { config_id: configId } });
            console.log(`Dock configuration with ID ${configId} activated successfully.`);
        } catch (error) {
            console.error("Error activating dock configuration:", error);
            throw new Error(`Error activating dock configuration`);
        }
    },
    async dockClear() {
        try {
            const baseurl = useBaseURL();
            await axios.post(`${baseurl}dock/clear`);
            this.docks = [];
            this.docks_pickups = [];
            this.docks_receivers = [];
            console.log("All docks cleared successfully.");
        } catch (error) {
            console.error("Error clearing docks:", error);
            throw new Error(`Error clearing docks`);
        }
    },
    async deleteDockItem(dock_id: string) {
        try {
            const baseurl = useBaseURL();
            await axios.post(`${baseurl}dock/remove-item`, {
                dock_id
            });
            console.log(`Dock item with ID ${dock_id} deleted successfully.`);
            await this.fetchDocks(); // Refresh dock states after deletion
        } catch (error) {
            console.error("Error deleting dock item:", error);
            throw new Error(`Error deleting dock item`);
        }
    },
    async addDockItem(dock_id: string, receiver_dock_id: string, item_id: string, item_weight: number) {
        try {
            const baseurl = useBaseURL();
            await axios.post(`${baseurl}dock/add-item`, {
                dock_id,
                receiver_dock_id,
                item_id,
                item_weight
            });
            console.log(`Item added to dock with ID ${dock_id} successfully.`);
            await this.fetchDocks(); // Refresh dock states after addition
        }catch (error: any) {
            console.error("Error adding item to dock:", error.response?.data?.detail || error);
            if (error.response?.data?.detail) {
                throw new Error(error.response.data.detail);
            }
            throw new Error(`Error adding item to dock`);
        }
    },
    async updateDocks(docks : updateDocks[]) {
        try {
            const baseurl = useBaseURL();
            await axios.post(`${baseurl}dock/upsert_dock`, docks);
            console.log("Docks updated successfully.");
        } catch (error: any) {
            console.error("Error updating docks:", error.response?.data?.detail || error);
            if(error.response?.data?.detail) {
                throw new Error(error.response.data.detail);
            }   
            throw new Error(`Error updating docks`);
        }
    },
    async updateRobotInitialPoses(initialPoses: robotUpdatePose[]) {
        try {
            const baseurl = useBaseURL();
            await axios.post(`${baseurl}robots/infos/upsert`, initialPoses);
            console.log("Map updated with new robot poses successfully.");
        }catch (error: any) {
            console.error("Error updating map with new robot poses:", error.response?.data?.detail || error);
            if (error.response?.data?.detail) {
                throw new Error(error.response.data.detail);
            }
            throw new Error(`Error updating map with new robot poses`);
        }
    },
    async updateMap(formDataMap: FormData) {
        try{
            const baseurl = useBaseURL();
            await axios.put(`${baseurl}map/update`, formDataMap, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });
            console.log("Map updated successfully.");
        }catch(error: any){
            console.error("Error updating map:", error.response?.data?.detail || error);
            if (error.response?.data?.detail) {
                throw new Error(error.response.data.detail);
            }
            throw new Error(`Error updating map`);
        }
    },
    async deleteDock(dock_id: number) {
        try{
            const ids = [dock_id];
            const baseurl = useBaseURL();
            const res = await axios.delete(`${baseurl}dock/delete_dock`, {
                data: {
                    ids: ids
                }
            });
            console.log(`Dock with ID ${dock_id} deleted successfully.`);
        }catch(error: any){
            console.error("Error deleting dock:", error.response?.data?.detail || error);
            if(error.response?.data?.detail) {
                throw new Error(error.response.data.detail);
            }
            throw new Error(`Error deleting dock`);
        }
    },
    async deleteRobotInitialPose(pose_id: number) {
        try {
            const ids = [pose_id];
            const baseurl = useBaseURL();
            await axios.delete(`${baseurl}robots/infos/bulk`, {
                data: {
                    ids: ids
                }
            });
            console.log(`Robot initial pose with ID ${pose_id} deleted successfully.`);
        } catch (error) {
            console.error("Error deleting robot initial pose:", error);
            throw new Error(`Error deleting robot initial pose`);
        }
    },
  }
});

interface createDockConfig {
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
interface robotPose {
    robot_name: string
    initial_x: number
    initial_y: number
    initial_theta: number
}

interface robotUpdatePose {
    robot_name: string
    initial_x: number
    initial_y: number
    initial_theta: number
    map_id: number
}
interface robotInfo {
    id: number;
    robot_name: string;
    initial_x: number;
    initial_y: number;
    initial_theta: number;
    map_id: number;
}
interface dockConfigs {
    id: number;
    name: string;
    description: string;
    is_active: boolean;
    robot_infos: robotInfo[];
}
interface onlineRobot {
    ip: string;
    hostname: string;
    namespace: string;
    ros_domain_id: string;
    battery: number; //TODO: replace with real battery data from backend
    status: string; 
    timestamp: number;
}
export type { onlineRobot };

interface DockStates {
    dock_type: string;
    dock_id: string;
    status: string;
    robot_id: string;
    item_id: string;
    item_weight: number; // Simulated weight for demonstration
    receiver_dock_id: string; // For pickup docks, this will be null. For receiver docks, this will indicate which pickup dock is assigned to it.
}
interface Docks {
    id: number;
    config_id: number;
    dock_id: string;
    dock_type: string;
    x: number;
    y: number;
    theta: number;
    aruco_id: number;
}

interface updateDocks {
    config_id: number;
    dock_id: string;
    dock_type: string;
    x: number;
    y: number;
    theta: number;
    aruco_id: number;
}
interface robotData {
    namespace: string;
    robot_ip: string;
}
