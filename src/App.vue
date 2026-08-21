<template>
  <el-container v-if="authStore.isLoggedIn" class="app-shell">
    <el-aside width="220px" class="sidebar">
      <div class="sidebar-logo">
        <el-icon class="logo-icon"><Money /></el-icon>
        <div class="logo-text">
          <h1>记账本</h1>
          <span>UID: {{ authStore.user?.id }}</span>
        </div>
      </div>
      <el-menu :default-active="activeMenu" router class="sidebar-menu">
        <el-menu-item index="/">
          <el-icon><DataLine /></el-icon>
          <span>首页统计</span>
        </el-menu-item>
        <el-menu-item index="/projects">
          <el-icon><Briefcase /></el-icon>
          <span>项目管理</span>
        </el-menu-item>
        <el-menu-item index="/records">
          <el-icon><List /></el-icon>
          <span>收支记录</span>
        </el-menu-item>
        <el-menu-item index="/add/income">
          <el-icon><ArrowUp /></el-icon>
          <span>入账登记</span>
        </el-menu-item>
        <el-menu-item index="/add/expense">
          <el-icon><ArrowDown /></el-icon>
          <span>支出登记</span>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer">
        <div class="user-card">
          <el-icon class="user-avatar"><User /></el-icon>
          <div class="user-detail">
            <span class="user-name">{{ authStore.user?.username }}</span>
            <span class="user-id">ID: {{ authStore.user?.id }}</span>
          </div>
        </div>
        <div class="sidebar-actions">
          <el-button size="small" @click="handleBackup">
            <el-icon><Upload /></el-icon>备份
          </el-button>
          <el-button size="small" @click="handleRestore">
            <el-icon><Download /></el-icon>恢复
          </el-button>
          <el-button size="small" @click="showChangePwd = true">
            <el-icon><Key /></el-icon>改密
          </el-button>
          <el-button size="small" type="danger" @click="handleLogout">
            <el-icon><SwitchButton /></el-icon>退出
          </el-button>
        </div>
      </div>
    </el-aside>
    <el-main class="main-content">
      <router-view />
    </el-main>

    <!-- 修改密码弹窗 -->
    <el-dialog v-model="showChangePwd" title="修改密码" width="400px">
      <el-form label-position="top">
        <el-form-item label="原密码" required>
          <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入原密码" />
        </el-form-item>
        <el-form-item label="新密码" required>
          <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="确认新密码" required>
          <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
        </el-form-item>
      </el-form>
      <el-alert v-if="pwdError" :title="pwdError" type="error" show-icon :closable="false" style="margin-bottom:12px" />
      <template #footer>
        <el-button @click="showChangePwd = false">取消</el-button>
        <el-button type="primary" :loading="pwdLoading" :disabled="!pwdForm.oldPassword || !pwdForm.newPassword || !pwdForm.confirmPassword" @click="handleChangePwd">
          确认修改
        </el-button>
      </template>
    </el-dialog>
  </el-container>
  <router-view v-else />
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api, backupDb, restoreDb } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const activeMenu = computed(() => route.path)

const showChangePwd = ref(false)
const pwdLoading = ref(false)
const pwdError = ref('')
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })

function handleLogout() {
  authStore.logout()
  router.push('/login')
}

async function handleChangePwd() {
  pwdError.value = ''
  if (pwdForm.value.newPassword !== pwdForm.value.confirmPassword) {
    pwdError.value = '两次输入的新密码不一致'
    return
  }
  pwdLoading.value = true
  try {
    const res = await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        oldPassword: pwdForm.value.oldPassword,
        newPassword: pwdForm.value.newPassword,
      }),
    })
    const data = await res.json()
    if (!data.ok) {
      pwdError.value = data.error || '修改失败'
      return
    }
    ElMessage.success('密码修改成功，请重新登录')
    showChangePwd.value = false
    pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
    handleLogout()
  } catch (e) {
    pwdError.value = e.message || '网络错误'
  } finally {
    pwdLoading.value = false
  }
}

async function handleBackup() {
  try {
    const result = await backupDb()
    if (result.cancelled) return
    if (!result.ok) {
      ElMessage.error(result.error || '备份失败')
      return
    }
    ElMessage.success(`备份成功：${result.path}`)
  } catch (e) {
    ElMessage.error('备份失败：' + e.message)
  }
}

async function handleRestore() {
  try {
    await ElMessageBox.confirm(
      '恢复数据将覆盖当前所有数据，操作不可逆！\n建议先点击左侧「备份」按钮导出当前数据。\n\n确认继续？',
      '恢复数据库',
      { type: 'warning', confirmButtonText: '确认恢复', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    const result = await restoreDb()
    if (result.cancelled) return
    if (!result.ok) {
      ElMessage.error(result.error || '恢复失败')
      return
    }
    ElMessage.success('数据恢复成功，请重新登录')
    handleLogout()
  } catch (e) {
    ElMessage.error('恢复失败：' + e.message)
  }
}
</script>

<style scoped>
.app-shell { height: 100vh; }
.sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 18px;
  border-bottom: 1px solid var(--el-border-color-light);
}
.logo-icon { font-size: 28px; color: var(--el-color-primary); }
.logo-text h1 { font-size: 18px; font-weight: 800; color: var(--el-text-color-primary); line-height: 1.2; }
.logo-text span { font-size: 12px; color: var(--el-text-color-secondary); }
.sidebar-menu { border-right: none; flex: 1; }
.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-lighter);
}
.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: var(--el-bg-color);
  border-radius: 8px;
  margin-bottom: 12px;
}
.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-3));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.user-detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.user-id {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.sidebar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sidebar-actions .el-button {
  flex: 1 1 calc(50% - 3px);
}
.main-content {
  padding: 10px;
  background: var(--el-bg-color-page);
}
</style>
