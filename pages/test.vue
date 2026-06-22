<template>
    <div>
        <h1>Test Page</h1>
    </div>
</template>

<script setup lang="ts">
    const dockStore = useDockStore()

    let wsConnection:
    | {
        robots: Ref<onlineRobot[]>
        connected: Ref<boolean>
        close: () => void
        }
    | undefined;

    let disconnect: (() => void) | undefined;

    onMounted(async () => {
        const wsProtocol =
            window.location.protocol === 'https:' ? 'wss:' : 'ws:'

        wsConnection = await dockStore.fetchOnlineRobots()
        watch(
            wsConnection.robots,
            (robots) => {
                console.log("Received robots:", robots)
            },
            { deep: true }
        )
    })

    onUnmounted(() => {
        wsConnection?.close()
    })

    // onMounted(async () => {
    //     console.log("Mounted test page, calling dockStore.test()")
    //     await dockStore.test()
    // })
</script>