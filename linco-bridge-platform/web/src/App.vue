<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'

import { ensureVisitorSession } from '@/api/visitor-api'

onLaunch(() => {
  void ensureVisitorSession().catch(() => undefined)
})
</script>

<style lang="scss">
@use './styles/global';
</style>
