<template>
  <div class="auth-page">
    <el-card class="auth-card" shadow="always">
      <div class="auth-header">
        <el-icon class="auth-logo"><Money /></el-icon>
        <h2>记账本</h2>
        <p class="auth-sub">项目管理收入 · 日常支出记账</p>
      </div>
      <el-form label-position="top" @submit.prevent="handleLogin">
        <el-form-item label="账号">
          <el-input v-model="form.username" placeholder="请输入账号" size="large" clearable>
            <template #prefix><el-icon><User /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          >
            <template #prefix><el-icon><Lock /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-button type="primary" size="large" class="auth-btn" :loading="loading" @click="handleLogin">
          登录
        </el-button>
        <el-alert
          v-if="error"
          :title="error"
          type="error"
          show-icon
          :closable="false"
          class="auth-error"
        />
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({ username: '', password: '' })
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await authStore.login(form.username, form.password)
    router.push('/')
  } catch (e) {
    error.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color-page);
  padding: 20px;
}
.auth-card {
  width: 100%;
  max-width: 400px;
  border-radius: 14px;
}
.auth-header { text-align: center; margin-bottom: 8px; }
.auth-logo { font-size: 44px; color: var(--el-color-primary); }
.auth-header h2 { font-size: 22px; font-weight: 700; margin: 8px 0 4px; color: var(--el-text-color-primary); }
.auth-sub { font-size: 13px; color: var(--el-text-color-secondary); margin-bottom: 12px; }
.auth-btn { width: 100%; }
.auth-error { margin-top: 12px; }
</style>
