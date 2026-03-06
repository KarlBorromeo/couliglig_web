<template>
    <v-dialog max-width="500">
        <template v-slot:activator="{ props: activatorProps }">
            <v-btn
            v-bind="activatorProps"
            color="surface-variant"
            text="Open Dialog"
            variant="flat"
            >
            <v-icon class="mr-2">mdi-cloud-upload</v-icon> Submit Config
        </v-btn>
        </template>


        <template v-slot:default="{ isActive }">
            <v-card title="Dialog">
            <v-card-text>
                <v-text-field
                    v-model="name"
                    label="Config Name"
                ></v-text-field>
                <v-text-field
                    v-model="description"
                    label="Config Description"
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

<script setup lang="ts">
    const emit = defineEmits(['submit']);
    const name = ref("");
    const description = ref("");
    function submit(isActive: Ref<boolean>) {
        if (!name.value || !description.value) {
            alert("Please enter a combination name and description");
            return;
        }
        emit('submit', { name: name.value, description: description.value });

        // reset + close
        name.value = ""
        description.value = ""
        isActive.value = false
    }
</script>