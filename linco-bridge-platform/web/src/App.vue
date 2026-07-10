<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { bootstrapVisitorSession } from '@/api/visitor-api'

onLaunch(() => {
  void bootstrapVisitorSession().catch(() => undefined)
})
</script>

<style lang="scss">
@use './styles/global';
</style>
