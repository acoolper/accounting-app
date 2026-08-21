<template>
  <div>
    <!-- 顶部操作栏 -->
    <el-row justify="space-between" align="middle" class="page-header">
      <h2 class="page-title"><el-icon><Briefcase /></el-icon> 项目管理</h2>
      <el-button type="primary" @click="openCreate"><el-icon><Plus /></el-icon> 新建项目</el-button>
    </el-row>

    <!-- 项目列表 -->
    <el-card>
      <el-table v-loading="loading" :data="projects" stripe>
        <el-table-column prop="name" label="项目" min-width="160" />
        <el-table-column label="类型" width="120">
          <template #default="{ row }"><el-tag effect="light">{{ row.type }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="manager" label="负责人" width="120" />
        <el-table-column label="总收入" width="130" align="right">
          <template #default="{ row }"><span class="income">+¥{{ fmt(row.total_income) }}</span></template>
        </el-table-column>
        <el-table-column label="总支出" width="130" align="right">
          <template #default="{ row }"><span class="expense">-¥{{ fmt(row.total_expense) }}</span></template>
        </el-table-column>
        <el-table-column label="结余" width="130" align="right">
          <template #default="{ row }">
            <span :class="row.total_income - row.total_expense >= 0 ? 'income' : 'expense'">
              ¥{{ fmt(row.total_income - row.total_expense) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="创建日期" width="130">
          <template #default="{ row }">{{ row.created_at?.slice(0, 10) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <div class="action-cell">
              <el-button size="small" @click="openEdit(row)"><el-icon><EditPen /></el-icon>编辑</el-button>
              <el-button size="small" type="danger" plain @click="confirmDelete(row)"><el-icon><Delete /></el-icon>删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && projects.length === 0" description="暂无项目，请先创建一个项目" />
    </el-card>

    <!-- 新建/编辑弹窗 -->
    <el-dialog v-model="showModal" :title="editing ? '编辑项目' : '新建项目'" width="460px">
      <el-form label-position="top">
        <el-form-item label="项目名称" required>
          <el-input v-model="form.name" placeholder="例如：智慧城市管理系统" />
        </el-form-item>
        <el-form-item label="项目类型" required>
          <el-select v-model="form.type" placeholder="— 选择类型 —" style="width: 100%">
            <el-option v-for="t in projectTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="form.manager" placeholder="负责人姓名（可选）" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" type="textarea" :rows="2" placeholder="项目说明（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-alert
          v-if="modalError"
          :title="modalError"
          type="error"
          show-icon
          :closable="false"
          style="margin-bottom: 12px"
        />
        <div class="dialog-footer">
          <el-button @click="showModal = false">取消</el-button>
          <el-button type="primary" :loading="saving" :disabled="!form.name || !form.type" @click="saveProject">
            保存
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/api'
import { ElMessageBox, ElMessage } from 'element-plus'

const loading = ref(false)
const projects = ref([])
const showModal = ref(false)
const editing = ref(null)
const saving = ref(false)
const modalError = ref('')

const projectTypes = ['软件开发', '系统集成', '运维服务', '咨询服务', '产品代理', '培训项目', '政府项目', '企业定制', '其他']

const form = ref({ name: '', type: '', manager: '', note: '' })

function fmt(n) {
  return (n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function loadProjects() {
  loading.value = true
  try {
    const res = await api('/projects')
    const data = await res.json()
    if (data.ok) projects.value = data.projects || []
  } catch (e) {
    console.error('[Projects] loadProjects error:', e)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = { name: '', type: '', manager: '', note: '' }
  modalError.value = ''
  showModal.value = true
}

function openEdit(p) {
  editing.value = p
  form.value = { name: p.name, type: p.type, manager: p.manager || '', note: p.note || '' }
  modalError.value = ''
  showModal.value = true
}

async function saveProject() {
  modalError.value = ''
  saving.value = true
  try {
    let res
    if (editing.value) {
      res = await api(`/projects/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(form.value),
      })
    } else {
      res = await api('/projects', {
        method: 'POST',
        body: JSON.stringify(form.value),
      })
    }
    const data = await res.json()
    if (!data.ok) { modalError.value = data.error; return }
    showModal.value = false
    await loadProjects()
    ElMessage.success(editing.value ? '已更新' : '已创建')
  } catch (e) {
    modalError.value = e.message
  } finally {
    saving.value = false
  }
}

function confirmDelete(p) {
  ElMessageBox.confirm(
    `确定删除项目 “${p.name}” 吗？删除后该项目下的收支记录将被保留（若已有收支记录则不允许删除）。`,
    '确认删除项目',
    { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' }
  ).then(() => doDelete(p)).catch(() => {})
}

async function doDelete(p) {
  const res = await api(`/projects/${p.id}`, { method: 'DELETE' })
  const data = await res.json()
  if (data.ok) { ElMessage.success('已删除'); loadProjects() }
  else ElMessage.error(data.error || '删除失败')
}

onMounted(loadProjects)
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: nowrap;
}
.page-title { font-size: 18px; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.action-cell { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.dialog-footer { display: flex; justify-content: flex-end; gap: 10px; }
</style>
