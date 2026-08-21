<template>
  <div>
    <!-- 类型切换 -->
    <el-radio-group :model-value="recordType" @change="switchType" class="type-radio">
      <el-radio-button label="income"><el-icon><ArrowUp /></el-icon> 入账登记</el-radio-button>
      <el-radio-button label="expense"><el-icon><ArrowDown /></el-icon> 支出登记</el-radio-button>
    </el-radio-group>

    <el-card>
      <el-alert v-if="projects.length === 0" type="warning" :closable="false" class="proj-tip">
        暂无项目，请先<router-link to="/projects">创建项目</router-link>再记账
      </el-alert>

      <el-form v-else label-position="top" @submit.prevent>
        <el-form-item label="关联项目" required>
          <el-select v-model="form.projectId" placeholder="— 请选择项目 —" style="width: 100%">
            <el-option v-for="p in projects" :key="p.id" :label="`${p.name} (${p.type})`" :value="p.id" />
          </el-select>
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="日期" required>
              <el-date-picker
                v-model="form.date"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选择日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="金额（元）" required>
              <el-input-number
                v-model="form.amount"
                :min="0.01"
                :precision="2"
                :step="0.01"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item :label="recordType === 'income' ? '收入类别' : '支出类别'" required>
          <el-select v-model="form.category" placeholder="— 请选择 —" style="width: 100%">
            <el-option-group v-if="recordType === 'income'" label="项目收入">
              <el-option v-for="c in incomeCats" :key="c" :label="c" :value="c" />
            </el-option-group>
            <el-option-group v-else label="日常支出">
              <el-option v-for="c in expenseCats" :key="c" :label="c" :value="c" />
            </el-option-group>
          </el-select>
        </el-form-item>

        <el-form-item v-if="recordType === 'expense'" label="支出人">
          <el-input v-model="form.paidBy" placeholder="支出人姓名（可选）" />
        </el-form-item>

        <el-form-item label="说明 / 备注">
          <el-input v-model="form.note" type="textarea" :rows="3" placeholder="备注信息（可选）" />
        </el-form-item>

        <el-alert v-if="form.amount" type="info" :closable="false" class="amount-preview">
          <template #title>
            金额预览：<span :class="recordType === 'income' ? 'income' : 'expense'" class="amount-value">
              {{ recordType === 'income' ? '+' : '-' }}¥{{ Number(form.amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </span>
          </template>
        </el-alert>

        <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
        <el-alert v-if="success" title="记录已保存！" type="success" show-icon :closable="false" />

        <div class="form-actions">
          <el-button @click="$router.push('/records')">取消</el-button>
          <el-button type="primary" :loading="saving" :disabled="!form.projectId" @click="submit">保存记录</el-button>
          <el-button v-if="success" @click="resetForm">继续添加</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'

const route = useRoute()
const router = useRouter()
const recordType = computed(() => route.params.type || 'expense')

const incomeCats = [
  '项目款', '咨询费', '外包收入', '技术服务', '培训费',
  '产品销售', '授权费', '政府补贴', '投资收益', '退款收回', '其他收入'
]

const expenseCats = [
  '人力成本', '设备采购', '办公耗材', '房租水电', '差旅交通',
  '商务接待', '市场推广', '软件服务', '培训学习', '税费社保',
  '通讯网络', '快递物流', '法务咨询', '其他支出'
]

const projects = ref([])
const saving = ref(false)
const error = ref('')
const success = ref('')

const form = reactive({
  projectId: '',
  date: new Date().toISOString().slice(0, 10),
  amount: null,
  category: '',
  note: '',
  paidBy: '',
})

function switchType(type) {
  form.category = ''
  router.replace(`/add/${type}`)
}

async function loadProjects() {
  try {
    const res = await api('/projects')
    const data = await res.json()
    if (data.ok) projects.value = data.projects
  } catch (e) {
    console.error(e)
  }
}

async function submit() {
  error.value = ''
  success.value = ''
  if (!form.projectId) { error.value = '请先选择项目'; return }
  if (!form.date) { error.value = '请选择日期'; return }
  if (!form.amount || Number(form.amount) <= 0) { error.value = '请输入正确金额'; return }
  if (!form.category) { error.value = '请选择类别'; return }

  saving.value = true
  try {
    const res = await api('/records', {
      method: 'POST',
      body: JSON.stringify({
        projectId: Number(form.projectId),
        paidBy: form.paidBy,
        date: form.date,
        type: recordType.value,
        category: form.category,
        amount: Number(form.amount),
        note: form.note,
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '保存失败')
    }
    success.value = '记录已保存！'
    setTimeout(() => router.push('/records'), 1200)
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

function resetForm() {
  success.value = ''
  form.amount = null
  form.note = ''
  form.category = ''
  form.paidBy = ''
}

onMounted(loadProjects)
</script>

<style scoped>
.type-radio { margin-bottom: 16px; display: block; }
.proj-tip { margin-bottom: 16px; }
.proj-tip :deep(a) { color: var(--el-color-primary); font-weight: 600; }
.amount-preview :deep(.amount-value) {
  font-size: 20px;
  font-weight: 800;
  margin-left: 6px;
}
.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
</style>
