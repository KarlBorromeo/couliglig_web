<template>
  <v-container>
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
          <td>{{ item.battery }}</td>
        </tr>
      </tbody>
    </v-table>
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
</script>