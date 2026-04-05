import { reactive, toRefs } from 'vue'

const state = reactive({
  message: '',
  visible: false,
  duration: 2000
})

export const showToast = (msg, time = 2000) => {
  state.message = msg
  state.duration = time
  state.visible = true
}

export function useToast() {
  return {
    ...toRefs(state),
    showToast
  }
}