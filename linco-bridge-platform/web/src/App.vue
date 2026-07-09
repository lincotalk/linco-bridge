<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { getOrCreateVisitorId } from '@/utils/visitor-id'

onLaunch(() => {
  getOrCreateVisitorId()
})
</script>

<style lang="scss">
@use './styles/global';
</style>
