<template>
  <v-container>
    <v-card elevation="3">
      <v-table>
        <thead>
          <tr>
            <th v-for="header in itemHeader" :key="header">
              {{ header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in itemsData"
            :key="item.name"
          >
            <td>{{ item.name }}</td>
            <td>{{ item.ip }}</td>
            <td>{{ item.status }}</td>
            <td>
              <v-icon color="green" v-if="item.battery > 75">
                mdi-battery-high
              </v-icon>
              <v-icon color="orange" v-else-if="item.battery > 50">
                mdi-battery-medium
              </v-icon>
              <v-icon color="red" v-else>
                mdi-battery-low
              </v-icon>
              {{ item.battery }}%
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
  </v-container>
</template>
<script setup lang="ts">
  const itemHeader = [
    'Robot name',
    'IP Address',
    'Status',
    'Battery (%)',
  ]
  const itemsData = [
    {
      name: 'Robot 1',
      ip: '192.168.1.1',
      status: 'Active',
      battery: 85,
    },
    {
      name: 'Robot 2',
      ip: '192.168.1.2',
      status: 'Inactive',
      battery: 60,
    },
  ]

  onMounted(() => {

    const ROSLIB = (window as any).ROSLIB

    const ros = new ROSLIB.Ros({
      url: "ws://192.168.20.106:9090"
    })

    ros.on("connection", () => {
      console.log("Connected to rosbridge")
    })

    ros.on("error", (err: any) => {
      console.error("ROS error:", err);
    });

    ros.on("close", () => {
      console.log("ROS connection closed");
    });

    const listener = new ROSLIB.Topic({
      ros: ros,
      name: "/chatter",
      messageType: "std_msgs/String"
    })

    listener.subscribe((msg:any) => {
      console.log("Message:", msg.data)
    })

  })
</script>