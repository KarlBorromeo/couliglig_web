<template>
    <div>
        <h1>Test Page</h1>
    </div>
</template>

<script setup lang="ts">
const dockStore = useDockStore()
    onMounted(async () => {
        console.log("Mounted test page, calling dockStore.test()")
        await dockStore.test()
    })
</script>