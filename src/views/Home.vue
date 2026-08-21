<template>
  <div>
    <!-- 顶部：项目切换（左上角） -->
    <div class="home-header">
      <div class="project-switch">
        <span class="proj-label"><el-icon><Briefcase /></el-icon> 项目</span>
        <el-select
          v-model="selectedProjectId"
          placeholder="选择项目查看"
          style="width: 240px"
          @change="onProjectChange"
        >
          <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>
      </div>
      <el-alert
        v-if="projects.length === 0"
        type="warning"
        :closable="false"
        class="proj-tip"
      >请先<router-link to="/projects">创建项目</router-link>后再查看首页数据</el-alert>
    </div>

    <!-- 全局统计卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card stat-income">
          <div class="stat-inner">
            <el-icon class="stat-ic"><ArrowUp /></el-icon>
            <div class="stat-body">
              <div class="stat-label">总收入</div>
              <el-statistic prefix="¥" :value="allStats.income" :precision="2" />
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card stat-expense">
          <div class="stat-inner">
            <el-icon class="stat-ic"><ArrowDown /></el-icon>
            <div class="stat-body">
              <div class="stat-label">总支出</div>
              <el-statistic prefix="¥" :value="allStats.expense" :precision="2" />
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card stat-balance">
          <div class="stat-inner">
            <el-icon class="stat-ic"><Wallet /></el-icon>
            <div class="stat-body">
              <div class="stat-label">剩余金额</div>
              <el-statistic prefix="¥" :value="allStats.balance" :precision="2" :value-style="balanceStyle" />
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 月份切换 + 本月统计 -->
    <el-row :gutter="16" class="mid-row">
      <!-- 收支趋势图 -->
      <el-col :span="17">
        <el-card class="chart-card">
          <div class="card-title-row">
            <span class="card-title-text"><el-icon><DataLine /></el-icon> 近 6 个月收支趋势</span>
          </div>
          <div class="bar-chart">
            <div v-for="m in sixMonths" :key="m.key" class="bar-group">
              <div class="bars">
                <div class="bar income-bar" :style="{ height: (m.maxH > 0 ? (m.income / m.maxH * 120) : 0) + 'px' }"></div>
                <div class="bar expense-bar" :style="{ height: (m.maxH > 0 ? (m.expense / m.maxH * 120) : 0) + 'px' }"></div>
              </div>
              <span class="bar-label">{{ m.label }}</span>
            </div>
          </div>
          <div class="chart-legend">
            <span class="legend-item legend-income">● 收入</span>
            <span class="legend-item legend-expense">● 支出</span>
          </div>
        </el-card>
      </el-col>

      <!-- 本月概览 -->
      <el-col :span="7">
        <el-card class="month-summary">
          <div class="card-title-row" style="margin-bottom:16px">
            <span class="card-title-text"><el-icon><Calendar /></el-icon> {{ monthLabel }} 收支</span>
            <div class="month-switch">
              <el-button-group>
                <el-button circle @click="prevMonth"><el-icon><ArrowLeft /></el-icon></el-button>
                <el-button circle @click="nextMonth"><el-icon><ArrowRight /></el-icon></el-button>
              </el-button-group>
              <el-button v-if="!isCurrentMonth" size="small" @click="goCurrent">本月</el-button>
            </div>
          </div>
          <div class="month-stat-item">
            <span class="month-stat-label">本月收入</span>
            <span class="month-stat-value stat-income-text">+¥{{ fmt(stats.income) }}</span>
          </div>
          <div class="month-stat-item">
            <span class="month-stat-label">本月支出</span>
            <span class="month-stat-value stat-expense-text">-¥{{ fmt(stats.expense) }}</span>
          </div>
          <div class="month-stat-divider"></div>
          <div class="month-stat-item">
            <span class="month-stat-label" style="font-weight:700">本月结余</span>
            <span class="month-stat-value" :class="stats.balance >= 0 ? 'stat-income-text' : 'stat-expense-text'" style="font-weight:700">
              {{ stats.balance >= 0 ? '+' : '' }}¥{{ fmt(stats.balance) }}
            </span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最近记录 -->
    <el-card>
      <div class="section-header">
        <span class="card-title-text"><el-icon><Clock /></el-icon> 最近记录</span>
        <el-button text type="primary" @click="$router.push('/records')">查看全部 ›</el-button>
      </div>
      <el-empty v-if="recent.length === 0" description="暂无记录，开始记账吧！" />
      <el-table v-else :data="recent" stripe>
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="类型" width="90">
          <template #default="{ row }">
            <el-tag :type="row.type === 'income' ? 'success' : 'danger'" effect="light">
              {{ row.type === 'income' ? '收入' : '支出' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="类别" width="120" />
        <el-table-column label="说明" min-width="160">
          <template #default="{ row }">
            <el-tag v-if="row.project_name" type="primary" effect="plain" size="small">{{ row.project_name }}</el-tag>
            <span v-else style="color:var(--el-text-color-secondary);font-size:12px">—</span>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="140" align="right">
          <template #default="{ row }">
            <span :style="{ color: row.type === 'income' ? 'var(--el-color-success)' : 'var(--el-color-danger)', fontWeight: 700 }">
              {{ row.type === 'income' ? '+' : '-' }}¥{{ fmt(row.amount) }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '@/api'

const now = new Date()
const cy = ref(now.getFullYear())
const cm = ref(now.getMonth() + 1)

const monthLabel = computed(() => `${cy.value}年 ${cm.value}月`)
const isCurrentMonth = computed(() => cy.value === now.getFullYear() && cm.value === now.getMonth() + 1)
const balanceStyle = computed(() => ({
  color: allStats.value.balance >= 0 ? 'var(--el-color-success)' : 'var(--el-color-danger)',
}))

const stats = ref({ income: 0, expense: 0, balance: 0 })
const allStats = ref({ income: 0, expense: 0, balance: 0 })
const recent = ref([])
const sixMonths = ref([])
const projects = ref([])
const selectedProjectId = ref(null)

function fmt(n) {
  return (n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function prevMonth() {
  if (cm.value === 1) { cm.value = 12; cy.value-- } else cm.value--
}
function nextMonth() {
  if (cm.value === 12) { cm.value = 1; cy.value++ } else cm.value++
}
function goCurrent() { cy.value = now.getFullYear(); cm.value = now.getMonth() + 1 }

async function loadHome() {
  try {
    const params = new URLSearchParams({ year: cy.value, month: cm.value })
    if (selectedProjectId.value) params.set('projectId', selectedProjectId.value)
    const res = await api(`/records/stats?${params}`)
    const data = await res.json()
    if (data.ok) {
      stats.value = data.stats
      recent.value = data.recent || []
      sixMonths.value = data.sixMonths || []
    }
  } catch (e) {
    console.error('loadHome error', e)
  }
}

async function loadAllStats() {
  try {
    const params = new URLSearchParams()
    if (selectedProjectId.value) params.set('projectId', selectedProjectId.value)
    const res = await api(`/records/all-stats?${params}`)
    const data = await res.json()
    if (data.ok) allStats.value = data.stats
  } catch (e) {
    console.error('loadAllStats error', e)
  }
}

function onProjectChange() {
  loadHome()
  loadAllStats()
}

async function loadProjects() {
  try {
    const res = await api('/projects')
    const data = await res.json()
    if (data.ok) {
      projects.value = data.projects || []
      // 默认选中第一个项目，确保首页默认展示某个项目的数据
      if (projects.value.length && !selectedProjectId.value) {
        selectedProjectId.value = projects.value[0].id
      }
    }
  } catch (e) {
    console.error('loadProjects error', e)
  } finally {
    await Promise.all([loadHome(), loadAllStats()])
  }
}

watch([cy, cm], loadHome)
onMounted(loadProjects)
</script>

<style scoped>
/* ===== 统计卡片布局 ===== */
.stat-row { margin-bottom: 16px; }
.stat-card { border-radius: 14px; }
.el-card { border-radius: 14px; }
.stat-inner { display: flex; align-items: center; gap: 16px; }
.stat-ic {
  width: 52px; height: 52px;
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; flex-shrink: 0;
}
.stat-income .stat-ic { background: #D1FAE5; color: #059669; }
.stat-expense .stat-ic { background: #FEE2E2; color: #DC2626; }
.stat-balance .stat-ic { background: #EEF2FF; color: #4F46E5; }
.stat-label { font-size: 13px; color: var(--el-text-color-secondary); margin-bottom: 4px; }

/* ===== 两栏布局 ===== */
.mid-row { margin-bottom: 16px; }

/* ===== 图表 ===== */
.chart-card { padding: 0; height: 280px; }
.card-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.card-title-text { font-size: 15px; font-weight: 700; color: var(--el-text-color-primary); display: inline-flex; align-items: center; gap: 6px; }
.month-switch { display: flex; align-items: center; gap: 8px; }
.bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 140px; }
.bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; }
.bars { display: flex; align-items: flex-end; gap: 3px; flex: 1; width: 100%; justify-content: center; }
.bar { width: 20px; border-radius: 6px 6px 0 0; transition: height 0.5s ease; min-height: 4px; }
.income-bar { background: linear-gradient(180deg, #34D399, #059669); }
.expense-bar { background: linear-gradient(180deg, #F87171, #DC2626); }
.bar-label { font-size: 11px; color: var(--el-text-color-secondary); white-space: nowrap; }
.chart-legend { display: flex; gap: 16px; margin-top: 12px; font-size: 12px; justify-content: center; }
.legend-income { color: #059669; }
.legend-expense { color: #DC2626; }

/* ===== 本月概览 ===== */
.month-summary { padding: 0; height: 280px; }
.month-stat-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; }
.month-stat-label { font-size: 14px; color: var(--el-text-color-secondary); }
.month-stat-value { font-size: 15px; font-weight: 700; }
.month-stat-divider { height: 1px; background: var(--el-border-color); margin: 4px 0; }
.stat-income-text { color: #059669; }
.stat-expense-text { color: #DC2626; }

/* ===== Section header ===== */
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }

/* ===== 顶部项目切换 ===== */
.home-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
.project-switch { display: inline-flex; align-items: center; gap: 8px; }
.proj-label { font-size: 14px; font-weight: 600; color: var(--el-text-color-primary); display: inline-flex; align-items: center; gap: 6px; }
.proj-tip { flex: 1; min-width: 240px; }
.proj-tip :deep(a) { color: var(--el-color-primary); font-weight: 600; }
</style>
