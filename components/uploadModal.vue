<template>
    <v-dialog max-width="500">
        <template v-slot:activator="{ props: activatorProps }">
            <v-btn
            v-bind="activatorProps"
            color="surface-variant"
            text="Open Dialog"
            variant="flat"
            >
            <v-icon>mdi-cloud-upload</v-icon>Upload
        </v-btn>
        </template>


        <template v-slot:default="{ isActive }">
            <v-card title="Dialog">
            <v-card-text>
                <v-text-field
                    v-model="combinationName"
                    label="Combination Name"
                ></v-text-field>
            </v-card-text>

            <v-card-actions>
                 <v-btn
                    color="primary"
                    text="Submit"
                    @click="submit(isActive)"
                ></v-btn>
                <v-spacer></v-spacer>

                <v-btn
                    text="Close Dialog"
                    @click="isActive.value = false"
                ></v-btn>
            </v-card-actions>
            </v-card>
        </template>
    </v-dialog>
</template>

<script setup>
    const emit = defineEmits(['submit']);
    const combinationName = ref("");
    function submit(isActive) {
        if (!combinationName.value) {
            alert("Please enter a combination name");
            return;
        }
        emit('submit', { combinationName: combinationName.value });

        // reset + close
        combinationName.value = ""
        isActive.value = false
    }
</script>