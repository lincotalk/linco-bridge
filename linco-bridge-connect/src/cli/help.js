function printHelp(pkg) {
  console.log(`Linco Connect ${pkg.version}

用法:
  linco-connect init --token "appId:appSecret" --agent codex [--channel linco] [--account default] [--force]
  linco-connect init --app-id appId --app-secret appSecret --agent claude [--channel linco-demo] [--account default] [--ws-url wss://...] [--allow-insecure-ws] [--force]
  linco-connect ws-prefix gateway.example.com
  linco-connect ws-prefix --clear
  linco-connect remove-account --agent claude --account default
  linco-connect start [--daemon] [--local-im|--mock-im]
  linco-connect stop
  linco-connect reload
  linco-connect status
  linco-connect doctor

说明:
  init    初始化本地配置；普通用户不需要填写 wsUrl
  ws-prefix  按现有账号写入测试环境 wsUrl，或用 --clear 清除覆盖
  remove-account  删除指定 Agent 下的账号配置（delete-account 同义）
  start   启动本机 Agent 连接器（已运行时会先停止旧进程再启动）
  stop    停止运行中的 Linco Connect
  reload  重新读取配置文件并热重载远端 IM 连接
  status  查看 Linco Connect 是否正在运行
  doctor  检查本地运行环境

Agent:
  --agent   指定 Agent 类型: claude, codex, hermes, openclaw
  --account 指定账号名，默认 default
  --channel 指定 channel key，默认 linco；参考平台使用 linco-demo

init 参数:
  --token "appId:appSecret"  推荐写法，等价于同时提供 --app-id 与 --app-secret
  --app-id <appId>           单独提供 appId
  --app-secret <appSecret>   单独提供 appSecret
  --ws-url <url>             覆盖远端 WebSocket 地址，普通用户通常不需要
  --allow-insecure-ws        允许 ws://，仅建议本地调试使用
  --force                    覆盖已有账号配置
`);
}

module.exports = {
  printHelp,
};
