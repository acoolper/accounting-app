<template>
  <div>
    <!-- 筛选栏 -->
    <el-card class="filter-card">
      <el-form :inline="true" @submit.prevent>
        <el-form-item label="项目">
          <el-select v-model="filters.projectId" placeholder="全部项目" clearable style="width: 160px" @change="onFilterChange">
            <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="filters.type" placeholder="全部类型" clearable style="width: 120px" @change="onFilterChange">
            <el-option label="收入" value="income" />
            <el-option label="支出" value="expense" />
          </el-select>
        </el-form-item>
        <el-form-item label="类别">
          <el-select v-model="filters.category" placeholder="全部类别" clearable style="width: 150px" @change="onFilterChange">
            <el-option-group label="收入">
              <el-option v-for="c in incomeCats" :key="c" :label="c" :value="c" />
            </el-option-group>
            <el-option-group label="支出">
              <el-option v-for="c in expenseCats" :key="c" :label="c" :value="c" />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            @change="onDateChange"
          />
        </el-form-item>
        <el-form-item label="搜索">
          <el-input v-model="filters.keyword" placeholder="搜索说明/项目" clearable style="width: 190px" @input="debounceSearch">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button @click="clearFilters"><el-icon><RefreshLeft /></el-icon>重置</el-button>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" plain :loading="exporting" @click="onExport"><el-icon><Download /></el-icon>导出</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 统计汇总 -->
    <el-space wrap class="summary-bar" v-if="total > 0">
      <el-tag type="success" effect="light" size="large">收入 ¥{{ fmt(summaryIncome) }}</el-tag>
      <el-tag type="danger" effect="light" size="large">支出 ¥{{ fmt(summaryExpense) }}</el-tag>
      <el-tag type="info" effect="light" size="large">共 {{ total }} 条</el-tag>
    </el-space>

    <!-- 记录列表 -->
    <el-card>
      <el-table v-loading="loading" :data="records" stripe>
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="项目" min-width="140">
          <template #default="{ row }">
            <el-tag v-if="row.project_name" type="primary" effect="plain" size="small">{{ row.project_name }}</el-tag>
            <span v-else style="color:var(--el-text-color-secondary);font-size:12px">—</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="90">
          <template #default="{ row }">
            <el-tag :type="row.type === 'income' ? 'success' : 'danger'" effect="light">
              {{ row.type === 'income' ? '收入' : '支出' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="类别" width="120" />
        <el-table-column label="说明" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.note || '—' }}</template>
        </el-table-column>
        <el-table-column v-if="hasExpense" label="支出人" width="110">
          <template #default="{ row }">{{ row.paid_by || '—' }}</template>
        </el-table-column>
        <el-table-column label="金额" width="140" align="right">
          <template #default="{ row }">
            <span :style="{ color: row.type === 'income' ? 'var(--el-color-success)' : 'var(--el-color-danger)', fontWeight: 700 }">
              {{ row.type === 'income' ? '+' : '-' }}¥{{ fmt(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="danger" plain @click="confirmDelete(row)"><el-icon><Delete /></el-icon></el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && records.length === 0" description="暂无记录" />
      <el-pagination
        v-if="total > 0"
        class="pager"
        layout="total, sizes, prev, pager, next"
        :total="total"
        :page-size="pageSize"
        :page-sizes="[15, 30, 50, 100]"
        :current-page="page"
        @current-change="onPageChange"
        @size-change="onSizeChange"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '@/api'
import { ElMessageBox, ElMessage } from 'element-plus'

const loading = ref(false)
const exporting = ref(false)
const records = ref([])
const projects = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(15)
let searchTimer = null

const filters = ref({ projectId: '', type: '', category: '', start: '', end: '', keyword: '' })
const dateRange = ref([])

const incomeCats = ['项目款', '咨询费', '外包收入', '技术服务', '培训费', '产品销售', '授权费', '政府补贴', '投资收益', '退款收回', '其他收入']
const expenseCats = ['人力成本', '设备采购', '办公耗材', '房租水电', '差旅交通', '商务接待', '市场推广', '软件服务', '培训学习', '税费社保', '通讯网络', '快递物流', '法务咨询', '其他支出']

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))
const summaryIncome = computed(() => records.value.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0))
const summaryExpense = computed(() => records.value.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0))
const hasExpense = computed(() => records.value.some(r => r.type === 'expense' && r.paid_by))

function fmt(n) {
  return (n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function debounceSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; loadRecords() }, 400)
}

function onDateChange(val) {
  filters.value.start = val ? val[0] : ''
  filters.value.end = val ? val[1] : ''
  page.value = 1
  loadRecords()
}

function onFilterChange() {
  page.value = 1
  loadRecords()
}

function onPageChange(p) {
  page.value = p
  loadRecords()
}

function onSizeChange(sz) {
  pageSize.value = sz
  page.value = 1
  loadRecords()
}

function clearFilters() {
  filters.value = { projectId: '', type: '', category: '', start: '', end: '', keyword: '' }
  dateRange.value = []
  page.value = 1
  loadRecords()
}

async function onExport() {
  exporting.value = true
  try {
    const filtered = Object.fromEntries(Object.entries(filters.value).filter(([, v]) => v))
    const params = new URLSearchParams(filtered)
    const res = await api(`/records/export?${params}`)
    const data = await res.json()
    if (data.cancelled) return
    if (!data.ok) { ElMessage.error(data.error || '导出失败'); return }
    if (data.count === 0) { ElMessage.warning('没有可导出的记录'); return }
    ElMessage.success(`已导出 ${data.count} 条记录到 ${data.path}`)
  } catch (e) {
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

async function loadProjects() {
  const res = await api('/projects')
  const data = await res.json()
  if (data.ok) projects.value = data.projects
}

async function loadRecords() {
  loading.value = true
  try {
    const filtered = Object.fromEntries(Object.entries(filters.value).filter(([, v]) => v))
    const params = new URLSearchParams({ page: page.value, pageSize: pageSize.value, ...filtered })
    const res = await api(`/records?${params}`)
    const data = await res.json()
    if (data.ok) { records.value = data.records; total.value = data.total }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function confirmDelete(r) {
  ElMessageBox.confirm(
    `确定删除这条 ${r.type === 'income' ? '收入' : '支出'} 记录？`,
    '确认删除',
    { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' }
  ).then(() => doDelete(r)).catch(() => {})
}

async function doDelete(r) {
  try {
    const res = await api(`/records/${r.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.ok) { ElMessage.success('已删除'); loadRecords() }
    else ElMessage.error(data.error || '删除失败')
  } catch (e) {
    ElMessage.error('删除失败')
  }
}

onMounted(() => { loadProjects(); loadRecords() })
</script>

<style scoped>
.filter-card { margin-bottom: 16px; }
.summary-bar { margin-bottom: 16px; }
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
