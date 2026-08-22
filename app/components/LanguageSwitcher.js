'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const pairs = [
  ['HANOK WAGGA WAGGA · ORDERING SYSTEM','HANOK WAGGA WAGGA · 点餐系统'],
  ['WAGGA WAGGA · STAFF DASHBOARD','WAGGA WAGGA · 员工后台'],
  ['WAGGA WAGGA · MANAGER CONTROL','WAGGA WAGGA · 经理后台'],
  ['WAGGA WAGGA · TABLE MANAGEMENT','WAGGA WAGGA · 桌台管理'],
  ['WAGGA WAGGA · TABLE QR CODES','WAGGA WAGGA · 桌台二维码'],
  ['WAGGA WAGGA · ACCESS & PIN SETTINGS','WAGGA WAGGA · 权限与 PIN 设置'],
  ['ANALYTICS & REPORTS','数据分析与报表'],
  ['MEAT STATION · KDS','肉类档口 · KDS'],
  ['HOT KITCHEN · KDS','热菜厨房 · KDS'],
  ['Staff / Manager Dashboard','员工 / 经理后台'],
  ['Kitchen KDS','厨房 KDS'],
  ['Manager · Access & PIN Settings','经理 · 权限与 PIN 设置'],
  ['Manager · Table Management','经理 · 桌台管理'],
  ['Manager · Table QR Codes','经理 · 桌台二维码'],
  ['Hanok Wagga Wagga','Hanok Wagga Wagga'],
  ['Unlimited Korean BBQ table-ordering and kitchen control system.','韩式烤肉自助桌边点餐与厨房管理系统。'],
  ['Front of House','前厅'],
  ['Staff','员工'],
  ['Open tables, guest counts and dining sessions.','开台、客人数和用餐时段管理。'],
  ['Kitchen','厨房'],
  ['Live production screens for BBQ meat and hot kitchen.','烤肉与热菜厨房实时出餐看板。'],
  ['MEAT KDS','肉类 KDS'],
  ['HOT KDS','热菜 KDS'],
  ['Management','管理'],
  ['Manager','经理'],
  ['Menu, tables, QR, system health, security and analytics.','菜单、桌台、二维码、系统健康、权限和数据分析。'],
  ['Manager Control','经理后台'],
  ['Ordering rules, tables, system health, printing and performance.','点餐规则、桌台、系统健康、打印和经营数据。'],
  ['OVERVIEW','总览'],
  ['MENU & STARTER','菜单与 Starter'],
  ['TABLES','桌台'],
  ['ANALYTICS','数据分析'],
  ['SECURITY','权限'],
  ['QR CODES','二维码'],
  ['Kitchen Printing','厨房打印'],
  ['CHECKING…','检查中…'],
  ['SIGN IN REQUIRED','需要登录'],
  ['SYSTEM READY','系统正常'],
  ['NEEDS ATTENTION','需要处理'],
  ['BRIDGE OFFLINE','Bridge 离线'],
  ['Manager login is required to view live print status.','需要经理登录才能查看实时打印状态。'],
  ['Checking Android Bridge, printers and queue…','正在检查 Android Bridge、打印机和打印队列…'],
  ['Bridge and both printers are online.','Bridge 和两台打印机均在线。'],
  ['Bridge and all three printers are online.','Bridge 和三台打印机均在线。'],
  ['No bridge heartbeat received yet.','尚未收到 Bridge 心跳。'],
  ['Bridge is online, but one or more components need attention.','Bridge 在线，但有一个或多个组件需要处理。'],
  ['CHECK NOW','立即检查'],
  ['SIGN IN','登录'],
  ['Android Bridge','Android Bridge'],
  ['Total Printer','总单打印机'],
  ['Split Printer','分单打印机'],
  ['Bar Rice Printer','吧台米饭打印机'],
  ['Print Queue','打印队列'],
  ['ONLINE','在线'],
  ['OFFLINE','离线'],
  ['NOT SEEN','未检测到'],
  ['NOT CHECKED','未检查'],
  ['HEALTHY','正常'],
  ['WARNING','警告'],
  ['CRITICAL','严重'],
  ['Waiting for first heartbeat','等待首次心跳'],
  ['Pre-Service Readiness','开店前系统检查'],
  ['READY FOR SERVICE','可以营业'],
  ['NOT READY','未就绪'],
  ['NOT RUN YET','尚未运行'],
  ['One read-only check for cloud, database, Bridge, printers, queue, tables and menu.','一次只读检查云端、数据库、Bridge、打印机、队列、桌台和菜单。'],
  ['One read-only check for cloud, database, Bridge, all printers, queue, tables and menu.','一次只读检查云端、数据库、Bridge、全部打印机、队列、桌台和菜单。'],
  ['RUN OPENING CHECK','运行开店检查'],
  ['Run this once before service. It does not create orders or print test tickets.','每天营业前运行一次。不会生成订单或打印测试单。'],
  ['PASS','通过'],
  ['FAIL','失败'],
  ['Quick Controls','快捷控制'],
  ['End-of-service and emergency reset actions.','闭店和紧急重置操作。'],
  ['Dining Room','餐厅桌台'],
  ['Close All Tables','一键关闭所有桌台'],
  ['Ends every active dining session and makes tables available again.','结束所有正在用餐的桌台并恢复为空闲。'],
  ['CLOSE ALL TABLES','关闭所有桌台'],
  ['CLOSING…','关闭中…'],
  ['Kitchen Reset','厨房重置'],
  ['Clear Current Orders','清空当前订单'],
  ['Cancels NEW / PREPARING / READY tickets while preserving history and analytics.','取消新单 / 制作中 / 待取餐订单，同时保留历史和分析数据。'],
  ['CLEAR ALL ORDERS','清空所有订单'],
  ['CLEARING…','清空中…'],
  ['Logout','退出登录'],
  ['Staff Dashboard','员工后台'],
  ['Table Control','桌台控制'],
  ['Start sessions, confirm guest count and manage the 90-minute dining flow.','开台、确认客人数并管理 90 分钟用餐流程。'],
  ['Dining','用餐中'],
  ['Available','空闲'],
  ['Guests','客人数'],
  ['Last Order','最后点餐'],
  ['Click a table to start or manage its session.','点击桌台开始或管理用餐时段。'],
  ['AVAILABLE','空闲'],
  ['LAST ORDER','最后点餐'],
  ['DINING','用餐中'],
  ['Ready to start','可以开台'],
  ['STANDARD STARTER','标准 Starter'],
  ['NO PORK STARTER','无猪肉 Starter'],
  ['SELECTED TABLE','已选择桌台'],
  ['Close','关闭'],
  ['Start New Session','开始新用餐时段'],
  ['Adults','成人'],
  ['Children 8–12','儿童 8–12 岁'],
  ['Children 4–7','儿童 4–7 岁'],
  ['Under 4','4 岁以下'],
  ['Starter Preference','Starter 选择'],
  ['Standard','标准'],
  ['No Pork','无猪肉'],
  ['START 90-MIN SESSION','开始 90 分钟用餐'],
  ['Open Ordering Now','立即开放点餐'],
  ['Edit Guests','修改客人数'],
  ['Move Table','换桌'],
  ['Close Session','结束用餐'],
  ['Manager PIN is required for overrides, guest changes and table moves.','解锁点餐、修改客人数和换桌需要经理 PIN。'],
  ['Customer QR URL','顾客二维码链接'],
  ['Staff or Manager PIN','员工或经理 PIN'],
  ['Signing in…','登录中…'],
  ['Kitchen PIN','厨房 PIN'],
  ['Meat Station','肉类档口'],
  ['Hot Kitchen','热菜厨房'],
  ['Starter platters and BBQ meat orders.','Starter 拼盘和烤肉订单。'],
  ['Hot dishes, Dolsot Bibimbap and Soup.','热菜、石锅拌饭和汤。'],
  ['Switch Station','切换档口'],
  ['NEW','新单'],
  ['PREPARING','制作中'],
  ['READY','待取餐'],
  ['READY / PICKUP','待取餐 / 取餐'],
  ['START','开始制作'],
  ['PICKED UP','已取餐'],
  ['REPRINT','重打'],
  ['No orders','暂无订单'],
  ['Table Management','桌台管理'],
  ['Add, rename, disable or restore dining tables. Table QR tokens remain fixed when a table is renamed.','新增、重命名、停用或恢复桌台。桌名更改后二维码 token 保持不变。'],
  ['Active Tables','启用桌台'],
  ['Disabled Tables','停用桌台'],
  ['Total Records','桌台总数'],
  ['Dining Tables','用餐桌台'],
  ['CANCEL','取消'],
  ['ADD TABLE','新增桌台'],
  ['Table Name','桌台名称'],
  ['Capacity','容量'],
  ['SAVE','保存'],
  ['Cancel','取消'],
  ['ACTIVE','启用'],
  ['DISABLED','停用'],
  ['Edit','编辑'],
  ['Disable','停用'],
  ['Restore','恢复'],
  ['Safe removal:','安全停用：'],
  ['QR Codes','二维码'],
  ['Table QR Codes','桌台二维码'],
  ['50mm Round Table QR Codes','50mm 圆形桌台二维码'],
  ['Centered QR + compact table number layout for all active tables.','所有启用桌台使用居中二维码和紧凑桌号布局。'],
  ['Official QR domain:','官方二维码域名：'],
  ['Print size:','打印尺寸：'],
  ['No active tables found.','未找到启用中的桌台。'],
  ['Manager Menu','经理菜单'],
  ['Analytics & Reports','数据分析与报表'],
  ['Historical operating data. POS revenue is not included.','历史运营数据，不包含 POS 营业额。'],
  ['From','开始日期'],
  ['To','结束日期'],
  ['Run Report','生成报表'],
  ['Last 7 Days','最近 7 天'],
  ['Last 30 Days','最近 30 天'],
  ['Export CSV','导出 CSV'],
  ['The To date is inclusive and uses the device\'s local restaurant date.','结束日期包含当天，并使用设备所在餐厅的本地日期。'],
  ['Table Sessions','用餐桌次'],
  ['Orders','订单'],
  ['Total Meat Serves','肉类总份数'],
  ['Starter Meat Serves','Starter 肉类份数'],
  ['Customer Reorder Meat Serves','顾客加点肉类份数'],
  ['Hot Food Serves','热菜份数'],
  ['Avg Orders / Table','平均每桌订单数'],
  ['Avg Guests / Table','平均每桌客人数'],
  ['Avg Dining Minutes','平均用餐分钟数'],
  ['No Pork Sessions','无猪肉桌次'],
  ['Product Performance','产品表现'],
  ['Total includes Starter + customer reorders. Meat kg is estimated at 100g per serve.','总数包含 Starter 和顾客加点。肉类重量按每份 100g 估算。'],
  ['Product','产品'],
  ['Station','档口'],
  ['Total','总计'],
  ['Starter','Starter'],
  ['Reorders','加点'],
  ['Est. kg','估算 kg'],
  ['Table Performance','桌台表现'],
  ['Table','桌台'],
  ['Sessions','桌次'],
  ['Avg Minutes','平均分钟'],
  ['Access & PIN Settings','权限与 PIN 设置'],
  ['Manager-only control for Staff and Kitchen login PINs.','仅经理可管理员工和厨房登录 PIN。'],
  ['Manager PIN','经理 PIN'],
  ['New PIN','新 PIN'],
  ['Confirm New PIN','确认新 PIN'],
  ['CHANGE STAFF PIN','修改员工 PIN'],
  ['CHANGE KITCHEN PIN','修改厨房 PIN'],
  ['UPDATING…','更新中…'],
  ['STAFF ACCESS','员工权限'],
  ['KITCHEN ACCESS','厨房权限'],
  ['Staff PIN','员工 PIN'],
  ['Used by floor staff to open and manage table sessions.','前厅员工用于开台和管理用餐时段。'],
  ['Used by Meat KDS and Hot Kitchen KDS screens.','用于肉类 KDS 和热菜 KDS 屏幕。'],
  ['Security behavior:','安全机制：'],
  ['Manager PIN changes are intentionally not available on this page to reduce the risk of accidentally locking management out of the system.','本页面不提供经理 PIN 修改，避免误操作导致经理无法登录系统。'],
  ['Manager PIN required.','需要经理 PIN。'],
  ['Checking Manager access…','正在检查经理权限…'],
  ['PRODUCTS','产品'],
  ['STARTER PLATTERS','Starter 拼盘'],
  ['ORDER SETTINGS','点餐设置'],
  ['Active Products','启用产品'],
  ['Hidden Products','隐藏产品'],
  ['Total Products','产品总数'],
  ['Products','产品'],
  ['ADD PRODUCT','新增产品'],
  ['New Product','新产品'],
  ['Kitchen / Internal Name','厨房 / 内部名称'],
  ['Customer Display Name','顾客显示名称'],
  ['Category','分类'],
  ['BBQ Meat','烤肉'],
  ['Hot Dish','热菜'],
  ['Rice & Soup','米饭与汤'],
  ['Portion Label','份量说明'],
  ['Max Portions per Order','每次最多份数'],
  ['Sort Order','排序'],
  ['Description','描述'],
  ['Contains Pork','含猪肉'],
  ['SAVE PRODUCT','保存产品'],
  ['SAVING…','保存中…'],
  ['HIDDEN','隐藏'],
  ['How it works:','使用说明：'],
  ['STANDARD','标准'],
  ['NO PORK','无猪肉'],
  ['STARTER RECIPE','STARTER 配方'],
  ['100g per portion','每份 100g'],
  ['Remove','移除'],
  ['Add Meat','添加肉类'],
  ['Select a meat…','选择一种肉类…'],
  ['ADD TO STARTER','加入 Starter'],
  ['SAVE STARTER','保存 Starter'],
  ['No Pork protection:','无猪肉保护：'],
  ['Meat Reorder Cooldown','肉类加点冷却时间'],
  ['Cooldown (minutes)','冷却时间（分钟）'],
  ['SAVE ORDER SETTINGS','保存点餐设置'],
  ['Single-table override:','单桌临时解锁：'],

  ['Help / Troubleshooting','帮助 / 故障排查'],
  ['Troubleshooting','故障排查'],
  ['Manager login required','需要经理登录'],
  ['Sign in with the Manager PIN, then press CHECK NOW again.','使用经理 PIN 登录，然后再次点击“立即检查”。'],
  ['System is healthy','系统运行正常'],
  ['No action is required. Keep the Bridge phone connected to power, on store Wi-Fi, with Bridge v1.9 running.','无需处理。保持 Bridge 手机持续供电、连接店内 Wi-Fi，并保持 Bridge v1.9 正常运行。'],
  ['Android Bridge is offline','Android Bridge 离线'],
  ['Go to the dedicated Bridge phone. Confirm it is charging, connected to the store Wi-Fi, the screen is kept awake, and Hanok Wagga Print Bridge v1.9 is open. Press START BRIDGE. Do not Force Stop the app.','前往专用 Bridge 手机。确认手机正在充电、连接店内 Wi-Fi、屏幕保持唤醒，并已打开 Hanok Wagga Print Bridge v1.9。点击 START BRIDGE。不要对 App 执行“强行停止 / Force Stop”。'],
  ['Printer status says NOT CHECKED','打印机显示“未检查”'],
  ['Confirm Bridge v1.9 is installed and START BRIDGE is running. Wait up to 30 seconds, then press CHECK NOW.','确认已经安装 Bridge v1.9，并且 START BRIDGE 正在运行。等待最多 30 秒，然后点击“立即检查”。'],
  ['Total Printer is offline','总单打印机离线'],
  ['Check the TOTAL printer is powered on, has paper, and its Ethernet cable is connected. Its IP must be 192.168.8.232. On the Bridge phone use TEST P1, then press CHECK NOW.','检查 TOTAL 打印机是否已开机、有纸，并且网线已连接。IP 必须是 192.168.8.232。在 Bridge 手机上点击 TEST P1，测试成功后再点击“立即检查”。'],
  ['Split Printer is offline','分单打印机离线'],
  ['Check the SPLIT printer is powered on, has paper, and its Ethernet cable is connected. Its IP must be 192.168.8.231. On the Bridge phone use TEST P2, then press CHECK NOW.','检查 SPLIT 打印机是否已开机、有纸，并且网线已连接。IP 必须是 192.168.8.231。在 Bridge 手机上点击 TEST P2，测试成功后再点击“立即检查”。'],
  ['Bar Rice Printer is offline','吧台米饭打印机离线'],
  ['Check the BAR RICE printer is powered on, has paper, and its Ethernet cable is connected. Its IP must be 192.168.8.230. On the Bridge phone use TEST BAR, then press CHECK NOW.','检查 BAR RICE 打印机是否已开机、有纸，并且网线已连接。IP 必须是 192.168.8.230。在 Bridge 手机上点击 TEST BAR，测试成功后再点击“立即检查”。'],
  ['Print Queue is delayed','打印队列延迟'],
  ['Do not submit the same customer order again. First restore any offline Bridge or printer. The queue will retry automatically. When all printers are online, wait 10–20 seconds and press CHECK NOW. Use CLEAR ALL ORDERS only when you intentionally want to cancel active kitchen orders.','不要重复提交同一张顾客订单。先恢复离线的 Bridge 或打印机，系统会自动重试队列。所有打印机恢复在线后等待 10–20 秒，再点击“立即检查”。只有在你确实要取消当前厨房订单时才使用 CLEAR ALL ORDERS。'],
  ['Manager status cannot be loaded','无法读取经理后台状态'],
  ['Check internet access on the Manager device and reload the page. If customer QR ordering is also unavailable, do not rely on the ordering system until connectivity is restored.','检查经理设备的网络连接并重新加载页面。如果顾客扫码点餐页面也无法使用，在网络恢复前不要依赖该点餐系统。'],
  ['Before opening','营业前检查'],
  ['Press RUN OPENING CHECK. If every item shows PASS, the system is ready. If any item shows FAIL, follow the matching instruction below and run the check again.','点击 RUN OPENING CHECK。如果所有项目都显示 PASS，系统即可营业。如果有任何项目显示 FAIL，请按照对应说明处理，然后重新运行检查。'],
  ['All checks passed','所有检查均已通过'],
  ['No corrective action is required. Keep the Bridge phone powered and leave all three printers on.','无需处理。保持 Bridge 手机持续供电，并保持三台打印机全部开机。'],
  ['Cloud & Database failed','云端与数据库检查失败'],
  ['Confirm the Manager device and Bridge phone both have internet access. Reload the Manager page and run the check again. If the customer QR page is also unavailable, do not open QR ordering until service is restored.','确认经理设备和 Bridge 手机都能正常访问互联网。重新加载 Manager 页面后再次运行检查。如果顾客扫码页面也无法打开，在服务恢复前不要启用扫码点餐。'],
  ['Android Bridge failed','Android Bridge 检查失败'],
  ['On the Bridge phone confirm power, store Wi-Fi and Bridge v1.9. Open the app and press START BRIDGE, then wait about 10 seconds and run the opening check again.','在 Bridge 手机上确认供电、店内 Wi-Fi 和 Bridge v1.9。打开 App 后点击 START BRIDGE，等待约 10 秒，再重新运行开店检查。'],
  ['Total Printer failed','总单打印机检查失败'],
  ['Power on the TOTAL printer, confirm paper and Ethernet, and verify IP 192.168.8.232. Use TEST P1 on the Bridge phone. Run the opening check again after the test succeeds.','打开 TOTAL 打印机，确认纸张和网线正常，并确认 IP 为 192.168.8.232。在 Bridge 手机上运行 TEST P1。测试成功后重新运行开店检查。'],
  ['Split Printer failed','分单打印机检查失败'],
  ['Power on the SPLIT printer, confirm paper and Ethernet, and verify IP 192.168.8.231. Use TEST P2 on the Bridge phone. Run the opening check again after the test succeeds.','打开 SPLIT 打印机，确认纸张和网线正常，并确认 IP 为 192.168.8.231。在 Bridge 手机上运行 TEST P2。测试成功后重新运行开店检查。'],
  ['Bar Rice Printer failed','吧台米饭打印机检查失败'],
  ['Power on the BAR RICE printer, confirm paper and Ethernet, and verify IP 192.168.8.230. Use TEST BAR on the Bridge phone. Run the opening check again after the test succeeds.','打开 BAR RICE 打印机，确认纸张和网线正常，并确认 IP 为 192.168.8.230。在 Bridge 手机上运行 TEST BAR。测试成功后重新运行开店检查。'],
  ['Print Queue failed','打印队列检查失败'],
  ['Do not place duplicate test orders. Restore the Bridge and any offline printers first. Wait for pending tickets to clear automatically, then run the opening check again. Only use CLEAR ALL ORDERS if those active orders should truly be cancelled.','不要重复下测试单。先恢复 Bridge 和任何离线打印机，等待待打印订单自动清空，然后重新运行开店检查。只有确定这些活动订单确实需要取消时，才使用 CLEAR ALL ORDERS。'],
  ['Dining Tables failed','桌台检查失败'],
  ['Open Manager → TABLES and make sure at least one dining table is ACTIVE. Restore or add the required tables, then run the opening check again.','进入 Manager → TABLES，确认至少有一张桌台状态为 ACTIVE。恢复或新增所需桌台后，再次运行开店检查。'],
  ['Ordering Menu failed','点餐菜单检查失败'],
  ['Open Manager → MENU & STARTER → PRODUCTS. Confirm at least one BBQ Meat item and at least one Hot Dish item are ACTIVE, then run the opening check again.','进入 Manager → MENU & STARTER → PRODUCTS。确认至少有一个 BBQ Meat 产品和一个 Hot Dish 产品处于 ACTIVE 状态，然后重新运行开店检查。'],
  ['Opening check could not run','无法运行开店检查'],
  ['Check internet access, reload the Manager page, sign in again if required, then retry RUN OPENING CHECK.','检查网络连接，重新加载 Manager 页面，如有需要重新登录，然后再次点击 RUN OPENING CHECK。'],

  ['← System Home','← 系统首页'],
  ['Manager Home','经理首页']
];

const enToZh = new Map(pairs);
const zhToEn = new Map(pairs.map(([en,zh])=>[zh,en]));

function dynamicTranslate(text, lang){
  const rules = lang==='zh' ? [
    [/^(\d+) guests$/, '$1 位客人'],
    [/^(\d+) min remaining$/, '剩余 $1 分钟'],
    [/^(\d+) min$/, '$1 分钟'],
    [/^ROUND (\d+)$/, '第 $1 轮'],
    [/^Capacity (\d+)$/, '容量 $1'],
    [/^Capacity (\d+) · QR token remains permanent$/, '容量 $1 · 二维码 token 永久不变'],
    [/^Heartbeat (\d+)s ago$/, '心跳 $1 秒前'],
    [/^Last seen (\d+)s ago$/, '最后在线 $1 秒前'],
    [/^(\d+) pending · oldest (\d+)s$/, '$1 单待打印 · 最久 $2 秒'],
    [/^(\d+)ms · (\d+)s ago · \.232$/, '$1ms · $2 秒前 · .232'],
    [/^(\d+)ms · (\d+)s ago · \.231$/, '$1ms · $2 秒前 · .231'],
    [/^(\d+)ms · (\d+)s ago · \.230$/, '$1ms · $2 秒前 · .230'],
    [/^(\d+) portions · approx (\d+)g$/, '$1 份 · 约 $2g'],
    [/^(\d+) Person Starter$/, '$1 人 Starter'],
    [/^CURRENT: (\d+) MIN$/, '当前：$1 分钟'],
    [/^PRINT ALL (\d+) ACTIVE TABLES$/, '打印全部 $1 个启用桌台'],
    [/^Guests: (.*)$/, '客人：$1'],
    [/^Starter: (.*)$/, 'Starter：$1'],
    [/^Bridge last seen (\d+)s ago\.$/, 'Bridge 最后在线于 $1 秒前。'],
    [/^Closed (\d+) active table\(s\)\.$/, '已关闭 $1 个正在用餐的桌台。'],
    [/^Cleared (\d+) active kitchen order\(s\)\.$/, '已清空 $1 个厨房活动订单。']
  ] : [
    [/^(\d+) 位客人$/, '$1 guests'],
    [/^剩余 (\d+) 分钟$/, '$1 min remaining'],
    [/^(\d+) 分钟$/, '$1 min'],
    [/^第 (\d+) 轮$/, 'ROUND $1'],
    [/^容量 (\d+)$/, 'Capacity $1'],
    [/^容量 (\d+) · 二维码 token 永久不变$/, 'Capacity $1 · QR token remains permanent'],
    [/^心跳 (\d+) 秒前$/, 'Heartbeat $1s ago'],
    [/^最后在线 (\d+) 秒前$/, 'Last seen $1s ago'],
    [/^(\d+) 单待打印 · 最久 (\d+) 秒$/, '$1 pending · oldest $2s'],
    [/^(\d+)ms · (\d+) 秒前 · \.232$/, '$1ms · $2s ago · .232'],
    [/^(\d+)ms · (\d+) 秒前 · \.231$/, '$1ms · $2s ago · .231'],
    [/^(\d+)ms · (\d+) 秒前 · \.230$/, '$1ms · $2s ago · .230'],
    [/^(\d+) 份 · 约 (\d+)g$/, '$1 portions · approx $2g'],
    [/^(\d+) 人 Starter$/, '$1 Person Starter'],
    [/^当前：(\d+) 分钟$/, 'CURRENT: $1 MIN'],
    [/^打印全部 (\d+) 个启用桌台$/, 'PRINT ALL $1 ACTIVE TABLES'],
    [/^客人：(.*)$/, 'Guests: $1'],
    [/^Starter：(.*)$/, 'Starter: $1'],
    [/^Bridge 最后在线于 (\d+) 秒前。$/, 'Bridge last seen $1s ago.'],
    [/^已关闭 (\d+) 个正在用餐的桌台。$/, 'Closed $1 active table(s).'],
    [/^已清空 (\d+) 个厨房活动订单。$/, 'Cleared $1 active kitchen order(s).']
  ];
  for(const [re,to] of rules) if(re.test(text)) return text.replace(re,to);
  return text;
}

function translateCore(core,lang){
  if(!core)return core;
  const map=lang==='zh'?enToZh:zhToEn;
  if(map.has(core))return map.get(core);
  return dynamicTranslate(core,lang);
}

function translateText(value,lang){
  if(!value||!value.trim())return value;
  const m=value.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const core=m?m[2]:value;
  const translated=translateCore(core,lang);
  return m?m[1]+translated+m[3]:translated;
}

function shouldSkip(el){
  if(!el)return true;
  return !!el.closest?.('.language-switcher,script,style,code,pre,.qr-label,[data-no-translate]');
}

function translateElement(root,lang){
  if(!root)return;
  if(root.nodeType===Node.TEXT_NODE){
    if(!shouldSkip(root.parentElement)){
      const next=translateText(root.nodeValue,lang);
      if(next!==root.nodeValue)root.nodeValue=next;
    }
    return;
  }
  if(root.nodeType!==Node.ELEMENT_NODE)return;
  if(shouldSkip(root))return;
  for(const attr of ['placeholder','title','aria-label']){
    if(root.hasAttribute?.(attr)){
      const old=root.getAttribute(attr);
      const next=translateText(old,lang);
      if(next!==old)root.setAttribute(attr,next);
    }
  }
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
    if(shouldSkip(node.parentElement))continue;
    const next=translateText(node.nodeValue,lang);
    if(next!==node.nodeValue)node.nodeValue=next;
  }
}

export default function LanguageSwitcher(){
  const path=usePathname()||'/';
  const [lang,setLang]=useState('en');
  const observerRef=useRef(null);
  const internal=!path.startsWith('/t/');

  useEffect(()=>{
    if(!internal)return;
    const saved=localStorage.getItem('hanok_backend_lang');
    const initial=saved==='zh'?'zh':'en';
    setLang(initial);
    document.documentElement.lang=initial==='zh'?'zh-CN':'en';
    requestAnimationFrame(()=>translateElement(document.body,initial));
  },[internal,path]);

  useEffect(()=>{
    if(!internal)return;
    observerRef.current?.disconnect?.();
    const observer=new MutationObserver(mutations=>{
      for(const m of mutations){
        if(m.type==='childList')for(const n of m.addedNodes)translateElement(n,lang);
        if(m.type==='characterData')translateElement(m.target,lang);
        if(m.type==='attributes')translateElement(m.target,lang);
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
    observerRef.current=observer;
    return()=>observer.disconnect();
  },[lang,internal]);

  function change(next){
    if(next===lang)return;
    observerRef.current?.disconnect?.();
    localStorage.setItem('hanok_backend_lang',next);
    document.documentElement.lang=next==='zh'?'zh-CN':'en';
    translateElement(document.body,next);
    setLang(next);
  }

  if(!internal)return null;
  return <div className="language-switcher" data-no-translate>
    <button className={lang==='en'?'active':''} onClick={()=>change('en')}>EN</button>
    <button className={lang==='zh'?'active':''} onClick={()=>change('zh')}>中文</button>
  </div>;
}
