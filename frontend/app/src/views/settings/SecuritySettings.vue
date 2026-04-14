<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Smartphone, Fingerprint, KeyRound, History } from 'lucide-vue-next'
import { SettingsService } from '../../services/settings'
import { showToast } from '../../composables/useToast'

defineOptions({ name: 'SecuritySettings' })

const router = useRouter()
const data = ref(null)
const loading = ref(false)
const keyForm = reactive({
  currentKey: '',
  newKey: '',
  confirmKey: '',
})

const fetchData = async () => {
  loading.value = true
  try {
    const response = await SettingsService.getSecuritySettings()
    data.value = response.data
  } finally {
    loading.value = false
  }
}

const toggleField = async (field) => {
  if (!data.value) return
  const patch = { [field]: !data.value[field] }
  const response = await SettingsService.updateSecuritySettings(patch)
  data.value = response.data
  showToast('设置已更新')
}

const removeDevice = async (deviceId) => {
  await SettingsService.removeDevice(deviceId)
  await fetchData()
  showToast('设备已移除')
}

const submitChangeSecretKey = async () => {
  if (!keyForm.currentKey || !keyForm.newKey || !keyForm.confirmKey) {
    showToast('请完整填写密钥信息')
    return
  }
  if (keyForm.newKey.length < 6) {
    showToast('新密钥长度不能少于6位')
    return
  }
  if (keyForm.newKey !== keyForm.confirmKey) {
    showToast('两次输入的新密钥不一致')
    return
  }

  try {
    await SettingsService.changeSecretKey(keyForm.currentKey, keyForm.newKey)
    keyForm.currentKey = ''
    keyForm.newKey = ''
    keyForm.confirmKey = ''
    showToast('密钥修改成功，请妥善保管')
  } catch (error) {
    showToast(error.message || '密钥修改失败')
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="fixed inset-0 z-[100] flex flex-col bg-[#0b1520] text-white">
    <header class="flex items-center gap-4 border-b border-[#233242] bg-[#1a2735] px-4 py-3">
      <button @click="router.back()" class="btn-interact text-[#cfd8e3]"><ArrowLeft :size="24" /></button>
      <h2 class="text-lg font-bold">账户安全</h2>
    </header>

    <div class="flex-1 overflow-y-auto py-4 space-y-0" v-if="data">
      <section class="border-y border-[#2b3b4c] bg-[#162331] px-4 py-4">
        <h3 class="text-sm font-bold mb-3">实名认证与安全开关</h3>
        <div class="space-y-0 text-sm border border-[#2b3b4c] bg-[#101b28]">
          <div class="flex items-center justify-between border-b border-[#2b3b4c] px-4 py-3">
            <div class="flex items-center gap-2"><KeyRound :size="16" class="text-[#c99b18]" />实名认证状态</div>
            <span class="text-[#19c58a] font-bold">{{ data.realNameStatus }}</span>
          </div>
          <button @click="toggleField('passwordSet')" class="flex w-full items-center justify-between border-b border-[#2b3b4c] px-4 py-3 btn-interact">
            <span class="flex items-center gap-2"><KeyRound :size="16" class="text-[#c99b18]" />密钥保护</span>
            <span :class="data.passwordSet ? 'text-[#19c58a]' : 'text-[#8e9bb0]'">{{ data.passwordSet ? '已开启' : '未开启' }}</span>
          </button>
          <button @click="toggleField('biometricEnabled')" class="flex w-full items-center justify-between px-4 py-3 btn-interact">
            <span class="flex items-center gap-2"><Fingerprint :size="16" class="text-[#c99b18]" />指纹/生物识别</span>
            <span :class="data.biometricEnabled ? 'text-[#19c58a]' : 'text-[#8e9bb0]'">{{ data.biometricEnabled ? '已开启' : '未开启' }}</span>
          </button>
        </div>
      </section>

      <section class="border-b border-[#2b3b4c] bg-[#162331] px-4 py-4">
        <h3 class="text-sm font-bold mb-3">设备管理</h3>
        <div class="space-y-0 border border-[#2b3b4c] bg-[#101b28]">
          <div v-for="item in data.devices" :key="item.id" class="border-b border-[#2b3b4c] px-4 py-3 last:border-b-0">
            <div class="flex items-center justify-between">
              <p class="font-bold text-sm flex items-center gap-2"><Smartphone :size="14" class="text-[#7f90a4]" />{{ item.name }}</p>
              <button @click="removeDevice(item.id)" class="text-xs text-[#ff7d75] btn-interact">移除</button>
            </div>
            <p class="mt-1 text-xs text-[#8e9bb0]">{{ item.location }} · {{ item.lastActive }}</p>
          </div>
        </div>
      </section>

      <section class="border-b border-[#2b3b4c] bg-[#162331] px-4 py-4">
        <h3 class="text-sm font-bold mb-3">修改密钥</h3>
        <div class="space-y-3 border border-[#2b3b4c] bg-[#101b28] p-4">
          <label class="block text-xs text-[#8e9bb0]">
            旧密钥
            <input
              v-model="keyForm.currentKey"
              type="password"
              placeholder="请输入旧密钥"
              class="mt-1 w-full border border-[#2b3b4c] bg-[#0d1926] px-3 py-2 text-sm text-[#dbe6f2] outline-none focus:border-[#c99b18]"
            />
          </label>
          <label class="block text-xs text-[#8e9bb0]">
            新密钥
            <input
              v-model="keyForm.newKey"
              type="password"
              placeholder="请输入新密钥（至少6位）"
              class="mt-1 w-full border border-[#2b3b4c] bg-[#0d1926] px-3 py-2 text-sm text-[#dbe6f2] outline-none focus:border-[#c99b18]"
            />
          </label>
          <label class="block text-xs text-[#8e9bb0]">
            确认新密钥
            <input
              v-model="keyForm.confirmKey"
              type="password"
              placeholder="请再次输入新密钥"
              class="mt-1 w-full border border-[#2b3b4c] bg-[#0d1926] px-3 py-2 text-sm text-[#dbe6f2] outline-none focus:border-[#c99b18]"
            />
          </label>
          <p class="text-[11px] text-[#7f90a4]">
            密钥由用户自行设置、自行保管。支持数字、字母、符号自由组合，长度至少6位。
          </p>
          <button
            @click="submitChangeSecretKey"
            class="w-full border border-[#3a5169] bg-[#1c2d3e] px-3 py-2 text-sm font-bold text-[#ecf2f9] btn-interact hover:bg-[#22374d]"
          >
            确认修改密钥
          </button>
        </div>
      </section>

      <section class="border-b border-[#2b3b4c] bg-[#162331] px-4 py-4">
        <h3 class="text-sm font-bold mb-3 flex items-center gap-2"><History :size="14" class="text-[#7f90a4]" />登录日志</h3>
        <div class="space-y-0 border border-[#2b3b4c] bg-[#101b28]">
          <div v-for="log in data.loginLogs" :key="log.id" class="border-b border-[#2b3b4c] px-4 py-3 text-xs last:border-b-0">
            <div class="flex justify-between"><span>{{ log.time }}</span><span :class="log.result === '成功' ? 'text-[#19c58a]' : 'text-[#ff7d75]'">{{ log.result }}</span></div>
            <p class="mt-1 text-[#8e9bb0]">IP：{{ log.ip }}</p>
          </div>
        </div>
        <p class="mt-3 text-[11px] text-[#7f90a4]">
          本端不提供自助找回密钥。若遗忘密钥，请联系人工客服并走后台审核流程处理。
        </p>
      </section>
    </div>

    <div v-else class="flex-1 flex items-center justify-center text-[#8e9bb0]">{{ loading ? '加载中...' : '暂无数据' }}</div>
  </div>
</template>
