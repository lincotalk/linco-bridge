<script setup lang="ts">

import { CHAT_ICON } from '@/constants/chat-icons'

import { getCustomNavBarPaddingStyle } from '@/utils/page-safe-area'



defineProps<{

  title: string

  subtitle?: string

  avatar: string

  showWorkspace?: boolean

  showContext?: boolean

  showMore?: boolean

}>()



const emit = defineEmits<{

  back: []

  workspace: []

  context: []

  more: []

}>()



const navBarSafeStyle = getCustomNavBarPaddingStyle()



function handleBack() {

  emit('back')

  uni.navigateBack()

}



function handleWorkspace() {

  emit('workspace')

}



function handleContext() {

  emit('context')

}



function handleMore() {

  emit('more')

}

</script>



<template>

  <view class="landing-bar" :style="navBarSafeStyle">

    <view class="landing-bar__inner">

      <view class="landing-bar__leading">

        <view class="landing-bar__back" @tap.stop="handleBack">

          <text class="landing-bar__back-icon">‹</text>

        </view>

        <image class="landing-bar__avatar" :src="avatar" mode="aspectFill" />

      </view>



      <view class="landing-bar__title-block">

        <text class="landing-bar__title text-ellipsis">{{ title }}</text>

        <text v-if="subtitle" class="landing-bar__subtitle text-ellipsis">{{ subtitle }}</text>

      </view>



      <view class="landing-bar__actions">

        <view

          v-if="showWorkspace"

          class="landing-bar__action"

          @tap.stop="handleWorkspace"

        >

          <image class="landing-bar__folder" :src="CHAT_ICON.workspaceFolder" mode="aspectFit" />

        </view>

        <view

          v-if="showContext"

          class="landing-bar__action"

          @tap.stop="handleContext"

        >

          <image

            class="landing-bar__folder"

            :src="CHAT_ICON.contextProfile"

            mode="aspectFit"

            aria-label="切换 Profile"

          />

        </view>

        <view v-if="showMore !== false" class="landing-bar__action" @tap.stop="handleMore">

          <view class="landing-bar__more-dots" aria-label="更多">

            <view class="landing-bar__more-dot" />

            <view class="landing-bar__more-dot" />

            <view class="landing-bar__more-dot" />

          </view>

        </view>

      </view>

    </view>

  </view>

</template>



<style scoped lang="scss">

.landing-bar {

  flex-shrink: 0;

  width: 100%;

  background: #ffffff;

}



.landing-bar__inner {

  display: flex;

  align-items: center;

  width: 100%;

  min-height: 88rpx;

  padding: 12rpx 16rpx;

  box-sizing: border-box;

}



.landing-bar__leading {

  display: flex;

  align-items: center;

  flex-shrink: 0;

}



.landing-bar__back {

  display: flex;

  align-items: center;

  justify-content: center;

  width: 64rpx;

  height: 64rpx;

}



.landing-bar__back-icon {

  font-size: 48rpx;

  line-height: 1;

  color: #1a1a1a;

}



.landing-bar__avatar {

  width: 72rpx;

  height: 72rpx;

  border-radius: 50%;

  background: #f5f5f5;

}



.landing-bar__title-block {

  flex: 1;

  min-width: 0;

  margin-left: 16rpx;

}



.landing-bar__title {

  display: block;

  font-size: 30rpx;

  font-weight: 600;

  line-height: 1.2;

  color: #1a1a1a;

}



.landing-bar__subtitle {

  display: block;

  margin-top: 4rpx;

  font-size: 22rpx;

  line-height: 1.35;

  color: rgba(0, 0, 0, 0.45);

}



.landing-bar__actions {

  display: flex;

  align-items: center;

  flex-shrink: 0;

  margin-left: auto;

}



.landing-bar__action {

  display: flex;

  align-items: center;

  justify-content: center;

  width: 72rpx;

  height: 72rpx;

  flex-shrink: 0;

}



.landing-bar__folder {

  width: 40rpx;

  height: 40rpx;

}



.landing-bar__more-dots {

  display: flex;

  align-items: center;

  justify-content: center;

  gap: 6rpx;

  width: 40rpx;

  height: 40rpx;

}



.landing-bar__more-dot {

  width: 8rpx;

  height: 8rpx;

  border-radius: 50%;

  background: #1a1a1a;

}

</style>

