<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AgentHistorySearchRow from '@/components/AgentHistorySearchRow.vue'
import AgentHistorySearchTopBar from '@/components/AgentHistorySearchTopBar.vue'
import { createAppAgentChatSdk } from '@/api/agent-chat-api'
import type { AgentBridgeType, AgentHistoryItem } from '@/bridge/types'
import { openHistorySession } from '@/utils/open-agent-landing'
import { showToast } from '@/utils/format'
import { getCustomNavPagePaddingStyle } from '@/utils/page-safe-area'

const pageSafeStyle = getCustomNavPagePaddingStyle()

const SEARCH_HISTORY_KEY_PREFIX = 'bridge-agent-history-search:'
const MAX_SEARCH_HISTORY = 10

const agentType = ref<AgentBridgeType>('codex')
const connectionId = ref<string | undefined>()
const keyword = ref('')
const searchFocused = ref(false)
const isSearchMode = ref(false)
const isBatchMode = ref(false)
const isDeleting = ref(false)
const loading = ref(false)
const history = ref<AgentHistoryItem[]>([])
const selectedIds = ref<Set<string>>(new Set())
const searchHistories = ref<string[]>([])
const sdk = createAppAgentChatSdk()

const trimmedQuery = computed(() => keyword.value.trim())

const filteredItems = computed(() => {
  const query = trimmedQuery.value.toLowerCase()
  if (!query) return history.value
  return history.value.filter((item) => {
    const haystack = `${item.title} ${item.preview} ${item.projectPath ?? ''}`.toLowerCase()
    return haystack.includes(query)
  })
})

const allSelected = computed(() => {
  const items = filteredItems.value
  return items.length > 0 && items.every((item) => selectedIds.value.has(item.id))
})

const showSearchHistoryList = computed(
  () => isSearchMode.value && !isBatchMode.value && !trimmedQuery.value,
)

const emptyMessage = computed(() => {
  if (trimmedQuery.value) return '无搜索结果'
  return '暂无历史对话'
})

function searchHistoryStorageKey(type: AgentBridgeType): string {
  return `${SEARCH_HISTORY_KEY_PREFIX}${type}`
}

function loadSearchHistories(type: AgentBridgeType) {
  try {
    const raw = uni.getStorageSync(searchHistoryStorageKey(type))
    searchHistories.value = Array.isArray(raw) ? raw.filter((item) => typeof item === 'string') : []
  } catch {
    searchHistories.value = []
  }
}

function persistSearchHistories(type: AgentBridgeType) {
  try {
    uni.setStorageSync(searchHistoryStorageKey(type), searchHistories.value)
  } catch {
    // ignore storage errors
  }
}

async function loadHistory(
  type: AgentBridgeType,
  scopedConnectionId?: string,
  silent = false,
) {
  if (!silent) {
    loading.value = true
  }
  try {
    history.value = await sdk.listHistory(type, {
      limit: 100,
      connectionId: scopedConnectionId,
    })
    const validIds = new Set(history.value.map((item) => item.id))
    selectedIds.value = new Set([...selectedIds.value].filter((id) => validIds.has(id)))
  } catch (err) {
    if (!silent) {
      showToast(err instanceof Error ? err.message : '加载历史失败')
    }
    history.value = []
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}

const showCount = ref(0)

onLoad((query) => {
  const type = String(query?.agentType ?? 'codex') as AgentBridgeType
  agentType.value = type
  connectionId.value = query?.connectionId ? String(query.connectionId) : undefined
  loadSearchHistories(type)
})

onShow(() => {
  showCount.value += 1
  void loadHistory(agentType.value, connectionId.value, showCount.value > 1)
})

function handleBack() {
  uni.navigateBack()
}

function enterSearchMode() {
  isSearchMode.value = true
  isBatchMode.value = false
  selectedIds.value = new Set()
}

function handleSearchFocus() {
  if (!isSearchMode.value) {
    enterSearchMode()
  }
}

function cancelSearch() {
  keyword.value = ''
  searchFocused.value = false
  isSearchMode.value = false
}

function enterBatchMode(initialItem?: AgentHistoryItem) {
  isBatchMode.value = true
  isSearchMode.value = false
  searchFocused.value = false
  const next = new Set<string>()
  if (initialItem) {
    next.add(initialItem.id)
  }
  selectedIds.value = next
}

function exitBatchMode() {
  isBatchMode.value = false
  selectedIds.value = new Set()
}

function toggleAll() {
  const items = filteredItems.value
  if (items.length === 0) return
  if (allSelected.value) {
    const next = new Set(selectedIds.value)
    items.forEach((item) => next.delete(item.id))
    selectedIds.value = next
    return
  }
  const next = new Set(selectedIds.value)
  items.forEach((item) => next.add(item.id))
  selectedIds.value = next
}

function toggleSelected(item: AgentHistoryItem) {
  const next = new Set(selectedIds.value)
  if (next.has(item.id)) {
    next.delete(item.id)
  } else {
    next.add(item.id)
  }
  selectedIds.value = next
}

function addSearchHistory(value: string) {
  const normalized = value.trim()
  if (!normalized) return
  const next = searchHistories.value.filter((item) => item !== normalized)
  next.unshift(normalized)
  searchHistories.value = next.slice(0, MAX_SEARCH_HISTORY)
  persistSearchHistories(agentType.value)
}

function submitSearch(value?: string) {
  if (typeof value === 'string' && value.trim()) {
    keyword.value = value
  }
  addSearchHistory(keyword.value)
}

function useSearchHistory(value: string) {
  keyword.value = value
  searchFocused.value = true
}

function removeSearchHistory(value: string) {
  searchHistories.value = searchHistories.value.filter((item) => item !== value)
  persistSearchHistories(agentType.value)
}

function clearSearchHistories() {
  searchHistories.value = []
  persistSearchHistories(agentType.value)
}

function handleRowTap(item: AgentHistoryItem) {
  if (isBatchMode.value) {
    toggleSelected(item)
    return
  }
  if (trimmedQuery.value) {
    addSearchHistory(trimmedQuery.value)
  }
  void openHistorySession(item)
}

async function deleteSelected() {
  if (selectedIds.value.size === 0 || isDeleting.value) return

  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '确认删除历史会话',
      content: '此操作将从当前 Agent 的历史列表中移除该会话。',
      confirmText: '删除',
      confirmColor: '#e5484d',
      success: (res) => resolve(Boolean(res.confirm)),
      fail: () => resolve(false),
    })
  })
  if (!confirmed) return

  isDeleting.value = true
  try {
    const sessionIds = [...selectedIds.value]
    await sdk.hideHistorySessions(agentType.value, sessionIds)
    history.value = history.value.filter((item) => !selectedIds.value.has(item.id))
    selectedIds.value = new Set()
    isBatchMode.value = false
    showToast('删除成功')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '删除失败，请稍后重试')
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <view
    class="page-container history-page"
    :class="{ 'history-page--batch': isBatchMode && !isSearchMode }"
    :style="pageSafeStyle"
  >
    <AgentHistorySearchTopBar
      :is-search-mode="isSearchMode"
      :is-batch-mode="isBatchMode"
      :all-selected="allSelected"
      :keyword="keyword"
      :search-focused="searchFocused"
      @update:keyword="keyword = $event"
      @back="handleBack"
      @batch-tap="enterBatchMode()"
      @cancel-search="cancelSearch"
      @cancel-batch="exitBatchMode"
      @toggle-all="toggleAll"
      @search-focus="handleSearchFocus"
      @search-confirm="submitSearch"
      @search-tap="handleSearchFocus"
      @search-clear="keyword = ''"
    />

    <scroll-view class="history-page__body" scroll-y>
      <view v-if="showSearchHistoryList" class="history-page__search-history">
        <view v-if="searchHistories.length === 0" class="history-page__state">
          <text class="history-page__state-text">暂无搜索历史</text>
        </view>
        <template v-else>
          <view
            v-for="item in searchHistories"
            :key="item"
            class="history-page__search-history-row"
            @tap="useSearchHistory(item)"
          >
            <text class="history-page__search-history-icon">⟲</text>
            <text class="history-page__search-history-text text-ellipsis">{{ item }}</text>
            <text class="history-page__search-history-remove" @tap.stop="removeSearchHistory(item)">×</text>
          </view>
          <view class="history-page__search-history-clear-wrap">
            <text class="history-page__search-history-clear" @tap="clearSearchHistories">全部清除</text>
          </view>
        </template>
      </view>

      <view v-else-if="loading" class="history-page__state">
        <text class="history-page__state-text">加载中…</text>
      </view>

      <view v-else-if="filteredItems.length === 0" class="history-page__state">
        <text class="history-page__state-text">{{ emptyMessage }}</text>
      </view>

      <view v-else class="history-page__list" :class="{ 'history-page__list--batch': isBatchMode }">
        <AgentHistorySearchRow
          v-for="item in filteredItems"
          :key="item.id"
          :item="item"
          :query="trimmedQuery"
          :is-batch-mode="isBatchMode"
          :selected="selectedIds.has(item.id)"
          @tap="handleRowTap(item)"
          @longpress="enterBatchMode(item)"
          @toggle-selected="toggleSelected(item)"
        />
      </view>
    </scroll-view>

    <view v-if="isBatchMode && !isSearchMode" class="history-page__delete-bar">
      <view
        class="history-page__delete-btn"
        :class="{ 'history-page__delete-btn--disabled': selectedIds.size === 0 || isDeleting }"
        @tap="deleteSelected"
      >
        <text class="history-page__delete-text">删除</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.history-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #ffffff;
}

.history-page--batch {
  padding-bottom: env(safe-area-inset-bottom);
}

.history-page__body {
  flex: 1;
  min-height: 0;
}

.history-page__list {
  padding: 16rpx 32rpx 34rpx 48rpx;
}

.history-page__list--batch {
  padding-top: 4rpx;
}

.history-page__state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 480rpx;
}

.history-page__state-text {
  font-size: 28rpx;
  color: rgba(0, 0, 0, 0.45);
}

.history-page__search-history {
  padding: 16rpx 60rpx 32rpx;
}

.history-page__search-history-row {
  display: flex;
  align-items: center;
  height: 72rpx;
}

.history-page__search-history-icon {
  flex-shrink: 0;
  margin-right: 20rpx;
  font-size: 28rpx;
  color: rgba(0, 0, 0, 0.45);
}

.history-page__search-history-text {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  color: #1a1a1a;
}

.history-page__search-history-remove {
  flex-shrink: 0;
  width: 64rpx;
  text-align: center;
  font-size: 32rpx;
  color: rgba(0, 0, 0, 0.45);
}

.history-page__search-history-clear-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 8rpx;
}

.history-page__search-history-clear {
  font-size: 24rpx;
  color: #00754a;
}

.history-page__delete-bar {
  border-top: 1rpx solid rgba(0, 0, 0, 0.08);
  background: #ffffff;
  padding-bottom: env(safe-area-inset-bottom);
}

.history-page__delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 148rpx;
}

.history-page__delete-btn--disabled {
  opacity: 0.4;
}

.history-page__delete-text {
  font-size: 28rpx;
  font-weight: 400;
  color: #e5484d;
}
</style>
