// 事件内容总注册
import { registerEvents } from '../../systems/events'
import { OPPORTUNITY_EVENTS } from './opportunity'
import { CRISIS_EVENTS } from './crisis'
import { PERSONNEL_EVENTS } from './personnel'
import { CHAIN_EVENTS } from './chains'
import { MISC_EVENTS } from './misc'
import { STRATEGY_EVENTS } from './strategy'
import { DAILY_EVENTS } from './daily'
import { MINGTU_EVENTS } from './mingtu'
import { PACK_DAILY2_EVENTS } from './pack_daily2'
import { PACK_JIANGHU_EVENTS } from './pack_jianghu'
import { PACK_RENQING_EVENTS } from './pack_renqing'
import { PACK_QIYU_EVENTS } from './pack_qiyu'
import { PACK_ZAIE_EVENTS } from './pack_zaie'
import { PACK_XINJING_EVENTS } from './pack_xinjing'
import { PACK_SHUWU_EVENTS } from './pack_shuwu'
import { PACK_WAISHI_EVENTS } from './pack_waishi'

let registered = false
export function registerAllEvents(): void {
  if (registered) return
  registered = true
  registerEvents(OPPORTUNITY_EVENTS)
  registerEvents(CRISIS_EVENTS)
  registerEvents(PERSONNEL_EVENTS)
  registerEvents(CHAIN_EVENTS)
  registerEvents(MISC_EVENTS)
  registerEvents(STRATEGY_EVENTS)
  registerEvents(DAILY_EVENTS)
  registerEvents(MINGTU_EVENTS)
  registerEvents(PACK_DAILY2_EVENTS)
  registerEvents(PACK_JIANGHU_EVENTS)
  registerEvents(PACK_RENQING_EVENTS)
  registerEvents(PACK_QIYU_EVENTS)
  registerEvents(PACK_ZAIE_EVENTS)
  registerEvents(PACK_XINJING_EVENTS)
  registerEvents(PACK_SHUWU_EVENTS)
  registerEvents(PACK_WAISHI_EVENTS)
}
